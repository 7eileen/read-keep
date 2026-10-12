(function(root){
  'use strict';
  const words=/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g;
  function tokenize(text){const out=[];let last=0;for(const m of text.matchAll(words)){if(m.index>last)out.push({text:text.slice(last,m.index),start:last,end:m.index,word:false});out.push({text:m[0],start:m.index,end:m.index+m[0].length,word:true});last=m.index+m[0].length;}if(last<text.length)out.push({text:text.slice(last),start:last,end:text.length,word:false});return out;}
  function paragraphs(text){return text.replace(/\r\n?/g,'\n').replace(/\u0000/g,'').trim().split(/\n\s*\n+/).map(p=>p.replace(/\s*\n\s*/g,' ').replace(/[ \t]+/g,' ').trim()).filter(Boolean);}
  function sentenceAt(text,start,end){
    if(typeof Intl!=='undefined'&&Intl.Segmenter){const segments=[];for(const item of new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)){const previous=segments.at(-1);if(previous&&/\b(?:Dr|Mr|Mrs|Ms|Prof|St|e\.g|i\.e)\.\s*$/i.test(previous.segment))previous.segment+=item.segment;else segments.push({index:item.index,segment:item.segment});}const picked=segments.filter(s=>s.index<end&&s.index+s.segment.length>start);if(picked.length)return picked.map(s=>s.segment).join('').trim();}
    let a=start,b=end;while(a>0&&!/[.!?]/.test(text[a-1]))a--;while(b<text.length&&!/[.!?]/.test(text[b]))b++;if(b<text.length)b++;return text.slice(a,b).trim();
  }
  function selection(text,start,end){let a=Math.max(0,Math.min(start,end)),b=Math.min(text.length,Math.max(start,end));while(a<b&&/\s/.test(text[a]))a++;while(b>a&&/\s/.test(text[b-1]))b--;const word=text.slice(a,b);if(!/[A-Za-z]/.test(word))throw new Error('请选择英文单词或短语。');if(word.length>100||(word.match(words)||[]).length>12)throw new Error('一次最多收录 12 个词组成的短语。');return {word,start:a,end:b,sentence:sentenceAt(text,a,b)};}
  function locationKey(articleId,paragraph,start,end){return [articleId,paragraph,start,end].join(':');}
  function querySlice(text,focus='',maxBytes=480){if(new TextEncoder().encode(text).length<=maxBytes)return {text,shortened:false};const pos=Math.max(0,text.toLowerCase().indexOf(focus.toLowerCase()));let start=Math.max(0,pos-120);let result=text.slice(start,start+maxBytes);while(new TextEncoder().encode(result).length>maxBytes)result=result.slice(0,-1);return {text:result,shortened:true};}
  function acceptsTranslation(entry,snapshot){return Boolean(entry&&!entry.meaningEdited&&entry.word===snapshot.word&&entry.sentence===snapshot.sentence&&entry.translationVersion===snapshot.translationVersion);}
  function renameArticle(state,id,value){
    const title=String(value??'').trim();
    if(!title)throw new Error('请输入文章名称。');
    if(title.length>150)throw new Error('文章名称最多 150 个字符。');
    if(!state.articles.some(a=>a.id===id))throw new Error('这篇文章已不存在，请关闭后刷新列表。');
    return {...state,articles:state.articles.map(a=>a.id===id?{...a,title,revision:(a.revision||0)+1}:a),entries:state.entries.map(e=>e.articleId===id?{...e,source:title}:e)};
  }
  function removeArticle(state,id){
    return {...state,articles:state.articles.filter(a=>a.id!==id),activeArticle:state.activeArticle===id?null:state.activeArticle};
  }
  function normalizedOffsets(text){let value='';const starts=[],ends=[];for(const m of text.matchAll(/\s+|[^\s]/g)){value+=/\s/.test(m[0])?' ':m[0];starts.push(m.index);ends.push(m.index+m[0].length);}return {value,starts,ends};}
  function occurrences(text,needle){const out=[];if(!needle)return out;for(let i=text.indexOf(needle);i!==-1;i=text.indexOf(needle,i+needle.length))out.push(i);return out;}
  function editArticle(state,id,title,body){
    const article=state.articles.find(a=>a.id===id);if(!article)throw new Error('这篇文章已不存在，请关闭后刷新列表。');
    const text=String(body??'').replace(/\r\n?/g,'\n').replace(/\u0000/g,'').trim();
    if(!/[A-Za-z]{2}/.test(text))throw new Error('请保留有效的英文正文。');
    if(text.length>60000)throw new Error('正文最多 60,000 个字符，请分篇保存。');
    const renamed=renameArticle(state,id,title);
    const texts=text.split(/\n\s*\n+/).map(p=>p.trim()).filter(Boolean);
    if(texts.length===article.paragraphs.length&&texts.every((t,i)=>t===article.paragraphs[i].text))return renamed;
    const oldMaps=article.paragraphs.map(p=>normalizedOffsets(p.text)),newMaps=texts.map(normalizedOffsets);
    const parts=texts.map((text,i)=>{const matches=oldMaps.map((m,j)=>m.value===newMaps[i].value?j:-1).filter(j=>j>=0);const page=matches.length===1?article.paragraphs[matches[0]].page:null;return {text,...(page?{page}:{})};});
    const entries=renamed.entries.map(e=>{
      if(e.articleId!==id)return e;
      const candidates=[],old=oldMaps[e.paragraphIndex],word=normalizedOffsets(e.word).value;
      if(old&&!e.locationStale){const start=old.starts.indexOf(e.rangeStart),end=old.ends.indexOf(e.rangeEnd);if(start>=0&&end>=start&&old.value.slice(start,end+1)===word)newMaps.forEach((m,p)=>{if(m.value===old.value)candidates.push({p,start:m.starts[start],end:m.ends[end]});});}
      if(!candidates.length){const sentence=normalizedOffsets((e.sentence||'').trim()).value;const terms=occurrences(sentence,word).filter(i=>(!/^[A-Za-z]/.test(word)||!/[A-Za-z]/.test(sentence[i-1]||''))&&(!/[A-Za-z]$/.test(word)||!/[A-Za-z]/.test(sentence[i+word.length]||'')));newMaps.forEach((m,p)=>{for(const offset of occurrences(m.value,sentence))for(const term of terms)candidates.push({p,start:m.starts[offset+term],end:m.ends[offset+term+word.length-1]});});}
      if(candidates.length!==1)return {...e,locationStale:true};
      const hit=candidates[0];return {...e,paragraphIndex:hit.p,rangeStart:hit.start,rangeEnd:hit.end,locationKey:locationKey(id,hit.p,hit.start,hit.end),sourcePage:parts[hit.p].page||null,locationStale:false};
    });
    return {...renamed,articles:renamed.articles.map(a=>a.id===id?{...a,paragraphs:parts,edited:true}:a),entries};
  }
  const api={tokenize,paragraphs,sentenceAt,selection,locationKey,querySlice,acceptsTranslation,renameArticle,removeArticle,editArticle};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArticleCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
