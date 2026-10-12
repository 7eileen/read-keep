(function(root){
  'use strict';
  const cache=new Map();let running=0;const waiting=[];
  function acquire(){return new Promise(resolve=>{if(running<2){running++;resolve();}else waiting.push(resolve);});}
  function release(){if(waiting.length)waiting.shift()();else running--;}
  function decode(text){const el=document.createElement('textarea');el.innerHTML=text;return el.value;}
  async function request(text,signal){
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    if(cache.has(text))return cache.get(text);
    await acquire();
    const ctrl=new AbortController();const abort=()=>ctrl.abort();signal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>ctrl.abort(),15000);
    try{
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');
      const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',text);url.searchParams.set('langpair','en|zh-CN');
      const response=await fetch(url,{signal:ctrl.signal,referrerPolicy:'no-referrer',credentials:'omit'});
      if(!response.ok)throw new Error('翻译服务暂不可用，请稍后重试。');
      const data=await response.json();
      if(Number(data.responseStatus)!==200||data.quotaFinished)throw new Error('翻译服务额度暂不可用，词语已保存，可稍后重试。');
      const result=decode(data.responseData?.translatedText||'').trim();
      if(!result||!/[\u3400-\u9fff]/.test(result))throw new Error('未获得可靠的中文译文，可以手动补充或重试。');
      cache.set(text,result);return result;
    }catch(error){if(signal?.aborted)throw new DOMException('Aborted','AbortError');if(error.name==='AbortError')throw new Error('翻译超时，词语已保存，请稍后重试。');throw error;}
    finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);release();}
  }
  async function translate(word,sentence,{signal,manualMeaning=false,onLexicon}={}){
    const snippet=root.ArticleCore.querySlice(sentence,word);
    const contextJob=snippet.text?request(snippet.text,signal).then(value=>({value}),error=>({error})):Promise.resolve({value:''});
    const lexicon=await root.WordLexicon.lookup(word,sentence,{signal});
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    onLexicon?.(lexicon);
    const query=lexicon.contextMatch&&lexicon.definition&&new TextEncoder().encode(lexicon.definition).length<=480?lexicon.definition:word;
    const [term,context,example]=await Promise.allSettled([manualMeaning?Promise.resolve(''):request(query,signal),contextJob.then(r=>{if(r.error)throw r.error;return r.value;}),lexicon.examples[0]?request(lexicon.examples[0].text,signal):Promise.resolve('')]);
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    if(lexicon.examples[0]&&example.status==='fulfilled')lexicon.examples[0].translation=example.value;
    return {lexicon,meaning:term.status==='fulfilled'?term.value:'',sentenceTranslation:context.status==='fulfilled'?context.value:'',shortened:snippet.shortened,provider:'MyMemory',meaningSource:query===word?'word':'dictionary',error:term.status==='rejected'?term.reason.message:context.status==='rejected'?context.reason.message:''};
  }
  root.WordTranslation={translate};
})(globalThis);
