(function(root){
  'use strict';
  const V=typeof module!=='undefined'&&module.exports?require('./vocabulary-core.js'):root.VocabularyCore;
  const copy=x=>JSON.parse(JSON.stringify(x)),DAY=86400000;
  const modes=['english','meaning','cloze'],scopes=['all','unknown'];
  // A fixed study-day timezone keeps daily counts consistent across devices.
  const day=now=>new Date(new Date(now).getTime()+8*3600000).toISOString().slice(0,10);
  function upgrade(input){
    const s=V.upgrade(input);s.review_events=s.review_events||[];s.study_sessions=s.study_sessions||[];
    s.settings={dailyAmount:20,studyScope:'unknown',studyMode:'english',...s.settings,dataVersion:3};
    s.vocabulary=s.vocabulary.map(v=>{
      if(v.progress)return v;
      const old=s.entries.filter(e=>V.key(e.word)===v.id).sort((a,b)=>(b.reviews||0)-(a.reviews||0))[0];
      return {...v,progress:{reviews:old?.reviews||0,streak:old?.reviews||0,ease:2.5,interval:old?.reviews?3:0,due:old?.reviews?old.due+'T00:00:00+08:00':'1970-01-01T00:00:00.000Z',lastReviewed:null}};
    });return s;
  }
  function progress(state,word){
    let p=state.vocabulary.find(v=>v.id===V.key(word))?.progress||{reviews:0,streak:0,ease:2.5,interval:0,due:'1970-01-01T00:00:00.000Z'};
    // Replaying immutable events also converges after offline edits on two devices.
    for(const e of (state.review_events||[]).filter(e=>e.wordId===V.key(word)).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)))p=schedule(p,e.grade,e.at);
    return p;
  }
  function schedule(p,grade,now){
    if(!['forgot','vague','remember'].includes(grade))throw new Error('请选择学习反馈。');
    const q={forgot:1,vague:3,remember:5}[grade],ease=Math.max(1.3,Math.min(3.2,(p.ease||2.5)+.1-(5-q)*(.08+(5-q)*.02)));
    const interval=grade==='forgot'?1:grade==='vague'?Math.max(2,Math.ceil((p.interval||1)*1.2)):p.streak?Math.max(6,Math.ceil((p.interval||1)*ease)):3;
    return {reviews:(p.reviews||0)+1,streak:grade==='forgot'?0:(p.streak||0)+1,ease,interval:Math.min(365,interval),due:new Date(new Date(now).getTime()+Math.min(365,interval)*DAY).toISOString(),lastReviewed:now};
  }
  function cloze(entry){const escaped=entry.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return String(entry.sentence||'').replace(new RegExp('(?<![A-Za-z])'+escaped+'(?![A-Za-z])','gi'),'______');}
  function eligible(entry,mode){return Boolean(entry.meaning?.trim())&&(mode!=='cloze'||(entry.sentence&&cloze(entry)!==entry.sentence));}
  function queue(state,scope='unknown',mode='english',now=new Date().toISOString()){
    const groups=V.groups(state,scope==='unknown').filter(g=>g.entries.some(e=>eligible(e,mode))&&new Date(progress(state,g.key).due)<=new Date(now));
    groups.sort((a,b)=>new Date(progress(state,a.key).due)-new Date(progress(state,b.key).due)||a.key.localeCompare(b.key));
    const done=new Set((state.review_events||[]).filter(e=>day(e.at)===day(now)).map(e=>e.wordId));
    const remaining=Math.max(0,(Number(state.settings.dailyAmount)||20)-done.size);
    return groups.slice(0,remaining);
  }
  function active(state){return (state.study_sessions||[]).find(s=>s.id==='active');}
  function current(state){
    const s=active(state);if(!s)return null;
    if(stats(state,s.startedAt).reviewed>=Number(state.settings.dailyAmount||20))return null;
    for(let index=s.index;index<s.items.length;index++){
      const item=s.items[index];if(s.scope==='unknown'&&!V.isUnknown(state,item.wordId))continue;
      if((state.review_events||[]).some(e=>e.wordId===item.wordId&&e.at>=s.startedAt))continue;
      const entry=state.entries.find(e=>e.id===item.entryId&&V.key(e.word)===item.wordId&&eligible(e,s.mode))||state.entries.find(e=>V.key(e.word)===item.wordId&&eligible(e,s.mode));
      if(entry)return {session:s,item,entry,index};
    }return null;
  }
  function start(input,{scope='unknown',mode='english',now=new Date().toISOString(),id=V.uid()}={}){
    if(!scopes.includes(scope)||!modes.includes(mode))throw new Error('学习选项无效。');
    const state=upgrade(input),old=active(state);
    if(old&&old.scope===scope&&old.mode===mode&&current(state)&&day(old.startedAt)===day(now))return state;
    const items=queue(state,scope,mode,now).map(g=>{const sources=g.entries.filter(e=>eligible(e,mode)).sort((a,b)=>a.id.localeCompare(b.id));return {wordId:g.key,entryId:sources[progress(state,g.key).reviews%sources.length].id};});
    state.study_sessions=[{id:'active',sessionId:id,scope,mode,startedAt:now,items,index:0}];return state;
  }
  function answer(input,grade,now=new Date().toISOString()){
    const state=copy(input),c=current(state);if(!c)return state;
    const id=c.session.sessionId+':'+c.index;
    if(!state.review_events.some(e=>e.id===id))state.review_events.push({id,wordId:c.item.wordId,entryId:c.entry.id,at:now,mode:c.session.mode,scope:c.session.scope,grade});
    c.session.index=c.index+1;return state;
  }
  function activity(state,date){return state.entries.some(e=>e.created===date)||(state.review_events||[]).some(e=>day(e.at)===date);}
  function stats(state,now=new Date().toISOString()){
    const date=day(now),first=new Map();for(const e of state.entries){const k=V.key(e.word);if(!first.has(k)||e.created<first.get(k))first.set(k,e.created);}
    const reviewed=new Set((state.review_events||[]).filter(e=>day(e.at)===date).map(e=>e.wordId)).size;
    return {added:[...first.values()].filter(d=>d===date).length,reviewed,total:first.size,records:state.entries.length,articles:state.articles.length,goal:Number(state.settings.dailyAmount)||20};
  }
  const api={upgrade,day,progress,schedule,queue,start,current,active,answer,stats,activity,cloze,eligible,modes,scopes};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudyCore=api;
})(globalThis);
