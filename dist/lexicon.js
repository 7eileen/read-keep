(function(root){
  'use strict';
  const posNames={noun:'n. 名词',verb:'v. 动词',adjective:'adj. 形容词',adverb:'adv. 副词',pronoun:'pron. 代词',preposition:'prep. 介词',conjunction:'conj. 连词',interjection:'interj. 感叹词',determiner:'限定词',numeral:'数词',article:'冠词',phrase:'短语'};
  const excluded=new Set(['archaic','obsolete','nonstandard','dialectal','rare','dated']);
  const stop=new Set('the a an of to in on and or as is are was were be been being it its they them that this these those for from with by at about which who what when where why how can could would should will may might have has had do does did not some all more most one into than such also other their there our your you we i'.split(' '));
  function tokens(text){return [...new Set((String(text).toLowerCase().match(/[a-z]{3,}/g)||[]).filter(w=>!stop.has(w)))];}
  function standard(item){return !(item.tags||[]).some(t=>excluded.has(t));}
  function flatten(senses){return (senses||[]).flatMap(s=>[s,...flatten(s.subsenses)]).filter(standard);}
  function formLabel(tags){const t=new Set(tags||[]);if(t.has('participle'))return t.has('past')?'过去分词':t.has('present')?'现在分词':'分词';if(t.has('past'))return '过去式';if(t.has('third-person'))return '第三人称单数';if(t.has('plural'))return '复数';if(t.has('comparative'))return '比较级';if(t.has('superlative'))return '最高级';return '';}
  function normalize(data,word,sentence=''){
    const entries=(data.entries||[]).filter(e=>e.language?.code==='en'&&flatten(e.senses).length);
    if(!entries.length)return {status:'missing',headword:word,parts:[],forms:[],examples:[]};
    const context=new Set(tokens(sentence).filter(t=>!tokens(word).includes(t)));
    const senses=entries.flatMap((entry,index)=>flatten(entry.senses).filter(s=>s.definition).map(s=>({s,entry,index,score:tokens(s.definition).filter(t=>context.has(t)).length})));
    senses.sort((a,b)=>b.score-a.score||a.index-b.index);
    const chosen=senses[0],ordered=chosen?[chosen.entry,...entries.filter(e=>e!==chosen.entry)]:entries;
    const forms=[];
    for(const e of ordered.filter(e=>e.partOfSpeech===chosen?.entry.partOfSpeech))for(const f of e.forms||[]){const label=formLabel(f.tags);if(label&&standard(f)&&/[a-z]/i.test(f.word||'')&&f.word.toLowerCase()!==word.toLowerCase()&&!forms.some(x=>x.word===f.word&&x.label===label))forms.push({word:f.word,label,part:e.partOfSpeech});}
    const examples=[...new Set(chosen?.s.examples||[])].filter(x=>typeof x==='string'&&x.length<=500).slice(0,2);
    const definition=chosen?.s.definition||'';
    const lemma=definition.match(/^(?:(?:simple )?past(?: tense)?(?: and past participle)?|past participle|present participle|third-person singular (?:simple )?present(?: indicative)?|plural) of ([a-z]+(?:[-'][a-z]+)*)[.]?$/i)?.[1]||'';
    return {status:'ready',headword:word,parts:chosen?[chosen.entry.partOfSpeech]:[],forms:forms.slice(0,10),definition,contextMatch:Boolean(chosen?.score),examples:examples.map(text=>({text})),lemma,sourceWords:[word]};
  }
  const cache=new Map();let active=0;const queue=[];
  async function request(word,signal){
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    if(cache.has(word))return cache.get(word);
    await new Promise(resolve=>{if(active<3){active++;resolve();}else queue.push(resolve);});
    const ctrl=new AbortController(),abort=()=>ctrl.abort(),timer=setTimeout(abort,12000);signal?.addEventListener('abort',abort,{once:true});
    try{if(signal?.aborted)throw new DOMException('Aborted','AbortError');const response=await fetch('https://freedictionaryapi.com/api/v1/entries/en/'+encodeURIComponent(word)+'?translations=false',{signal:ctrl.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(response.status===404)return {entries:[]};if(!response.ok)throw new Error('词典暂不可用');const data=await response.json();cache.set(word,data);return data;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(queue.length)queue.shift()();else active--;}
  }
  async function lookup(word,sentence,{signal}={}){
    const term=word.trim().toLowerCase();
    try{const result=normalize(await request(term,signal),term,sentence);if(result.lemma&&result.lemma!==term){const base=normalize(await request(result.lemma,signal),result.lemma,sentence);if(base.status==='ready')return {...base,inflected:term,inflection:result.definition,sourceWords:[term,result.lemma]};}return result;}
    catch(error){if(signal?.aborted)throw new DOMException('Aborted','AbortError');return {status:'error',headword:term,parts:[],forms:[],examples:[]};}
  }
  function accepts(entry,snapshot){return Boolean(entry&&entry.word===snapshot.word&&entry.sentence===snapshot.sentence&&entry.translationVersion===snapshot.translationVersion);}
  const api={normalize,lookup,formLabel,posNames,accepts};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordLexicon=api;
})(globalThis);
