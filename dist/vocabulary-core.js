(function(root){
  'use strict';
  const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.WordJournal;
  const key=word=>C.normalize(String(word||''));
  const uid=()=> 'book-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
  function legacyId(value){let a=2166136261,b=5381;for(const ch of value){a=Math.imul(a^ch.charCodeAt(0),16777619);b=Math.imul(b,33)^ch.charCodeAt(0);}return 'legacy-'+(a>>>0).toString(16)+(b>>>0).toString(16);}
  function validateTitle(state,value,except=''){
    const title=String(value||'').trim().replace(/\s+/g,' ');
    if(!title)throw new Error('请输入词汇册名称。');
    if(title.length>150)throw new Error('词汇册名称最多 150 个字符。');
    if((state.notebooks||[]).some(b=>b.id!==except&&key(b.title)===key(title)))throw new Error('已有同名词汇册，请修改名称。');
    return title;
  }
  function upgrade(input){
    const legacy=!Array.isArray(input?.notebooks),state=JSON.parse(JSON.stringify(input||{}));
    state.entries=(state.entries||[]).filter(e=>!e.sample);
    state.articles=(state.articles||[]).filter(a=>!a.sample||state.entries.some(e=>e.articleId===a.id));
    state.notebooks=(state.notebooks||[]).filter(b=>!b.sample||state.entries.some(e=>e.notebookId===b.id));
    state.vocabulary=(state.vocabulary||[]).filter(v=>!v.sample);
    state.settings={interval:3,batch:5,autoTranslate:true,...state.settings,dataVersion:2};
    const books=new Map(state.notebooks.map(b=>[b.id,b])),words=new Map(state.vocabulary.map(v=>[v.id,v]));
    function ensure(id,title,created,kind,articleId){
      if(books.has(id))return books.get(id);
      const base=String(title||'未命名词汇册').trim().slice(0,140);let name=base,index=2;
      while([...books.values()].some(b=>key(b.title)===key(name)))name=base+'（'+index+++'）';
      const book={id,title:name,createdAt:created||'1970-01-01',kind:kind||'历史记录',...(articleId?{articleId}:{})};books.set(id,book);return book;
    }
    if(legacy)for(const article of state.articles){const existing=[...books.values()].find(b=>b.articleId===article.id);ensure(existing?.id||'book-'+article.id,article.title,article.importedAt||article.created,article.kind,article.id);}
    for(const entry of state.entries){
      delete entry.star;
      const articleBook=[...books.values()].find(b=>b.articleId===entry.articleId&&entry.articleId);
      const id=entry.notebookId||articleBook?.id||(entry.articleId?'book-'+entry.articleId:entry.batch?.id?'book-'+entry.batch.id:legacyId(JSON.stringify([entry.source,entry.created])));
      ensure(id,entry.batch?.title||entry.source,entry.articleImportedAt||entry.batch?.createdAt||entry.created,entry.articleId?'文章词汇':entry.batch?'批量录入':'历史记录');entry.notebookId=id;
      const word=key(entry.word);if(!words.has(word))words.set(word,{id:word,isUnknown:true});
    }
    state.notebooks=[...books.values()];state.vocabulary=[...words.values()];
    if(!state.articles.some(a=>a.id===state.activeArticle))state.activeArticle=null;
    if(!state.entries.some(e=>e.id===state.lastEntry))state.lastEntry=null;
    return state;
  }
  function isUnknown(state,word){return Boolean((state.vocabulary||[]).find(v=>v.id===key(word))?.isUnknown);}
  function mark(state,words,value){
    const wanted=new Set(words.map(key)),map=new Map((state.vocabulary||[]).map(v=>[v.id,{...v}]));
    for(const e of state.entries||[])if(wanted.has(key(e.word)))map.set(key(e.word),{...map.get(key(e.word)),id:key(e.word),isUnknown:Boolean(value)});
    return {...state,vocabulary:[...map.values()]};
  }
  function books(state){return (state.notebooks||[]).map(b=>({...b,created:String(b.createdAt).slice(0,10),articleId:(state.articles||[]).some(a=>a.id===b.articleId)?b.articleId:null,entries:(state.entries||[]).filter(e=>e.notebookId===b.id)})).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))||a.id.localeCompare(b.id));}
  function groups(state,unknownOnly=false,entries=state.entries||[]){
    const map=new Map();for(const e of entries){const k=key(e.word);if(unknownOnly&&!isUnknown(state,k))continue;if(!map.has(k))map.set(k,{key:k,word:e.word,entries:[]});map.get(k).entries.push(e);}return [...map.values()];
  }
  function renameBook(state,id,value){
    if(!(state.notebooks||[]).some(b=>b.id===id))throw new Error('词汇册不存在。');
    const title=validateTitle(state,value,id);return {...state,notebooks:state.notebooks.map(b=>b.id===id?{...b,title}:b)};
  }
  function importWords(state,value,rows,{now=new Date().toISOString(),date=C.dateKey(),id=uid()}={}){
    const title=validateTitle(state,value);if(state.notebooks.some(b=>b.id===id))throw new Error('这次导入已保存。');
    if(rows.some(r=>!key(r.word)||String(r.word).length>150))throw new Error('词汇不能为空，且每条最多 150 个字符。');
    const batch={id,title,createdAt:now};const result=C.addEntries([],rows,title,date,batch);
    const entries=result.entries.map(e=>{const {star,batch,...rest}=e;return {...rest,notebookId:id};});
    const vocabulary=new Map((state.vocabulary||[]).map(v=>[v.id,v]));for(const e of entries)if(!vocabulary.has(key(e.word)))vocabulary.set(key(e.word),{id:key(e.word),isUnknown:false});
    return {...state,notebooks:[{id,title,createdAt:now,kind:'词汇导入'},...state.notebooks],entries:[...entries,...state.entries],vocabulary:[...vocabulary.values()]};
  }
  function removeRecords(state,ids){const remove=new Set(ids),entries=state.entries.filter(e=>!remove.has(e.id)),keys=new Set(entries.map(e=>key(e.word)));return {...state,entries,vocabulary:state.vocabulary.map(v=>keys.has(v.id)?v:{...v,isUnknown:false}),lastEntry:remove.has(state.lastEntry)?null:state.lastEntry};}
  const api={key,uid,upgrade,validateTitle,isUnknown,mark,books,groups,renameBook,importWords,removeRecords};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VocabularyCore=api;
})(globalThis);
