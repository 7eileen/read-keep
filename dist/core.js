(function(root){
  'use strict';
  const DAY=86400000;
  function dateKey(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
  function addDays(key,days){const [y,m,d]=key.split('-').map(Number);return dateKey(new Date(y,m-1,d+Number(days),12));}
  function normalize(word){return word.trim().toLocaleLowerCase().replace(/\s+/g,' ');}
  function parseBatch(text){return text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const [word,meaning='',...sentence]=line.split(/[|｜\t]/).map(x=>x.trim());return {word,meaning,sentence:sentence.join(' | ')};}).filter(x=>x.word);}
  function addEntries(existing,rows,source,today=dateKey(),batch=null){
    const next=existing.slice();let added=0;
    rows.forEach((row,i)=>{
      const word=row.word.trim(),sentence=(row.sentence||'').trim();
      if(!word || next.some(x=>normalize(x.word)===normalize(word)&&x.sentence===sentence&&(batch?x.batch?.id===batch.id:x.source===source&&x.created===today)))return;
      next.unshift({id:'e-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,6),word,meaning:(row.meaning||'').trim(),sentence,source:source.trim()||'未命名阅读',created:today,due:addDays(today,1),reviews:0,star:false,note:'',level:'new',...(batch?{batch:{...batch}}:{})});added++;
    });return {entries:next,added};
  }
  function notebooks(state){
    const groups=new Map();
    for(const a of state.articles||[])groups.set('article:'+a.id,{id:'article:'+a.id,articleId:a.id,title:a.title,created:a.created,createdAt:a.importedAt||a.created,kind:a.kind||'文章',legacy:false,entries:[]});
    for(const e of state.entries||[]){
      const id=e.articleId?'article:'+e.articleId:e.batch?.id?'batch:'+e.batch.id:'legacy:'+JSON.stringify([e.source,e.created]);
      const createdAt=e.articleImportedAt||e.batch?.createdAt||e.created;
      if(!groups.has(id))groups.set(id,{id,articleId:null,title:e.articleId?e.source:e.batch?.title||e.source,created:e.created,createdAt,kind:e.articleId?'文章词汇':e.batch?'批量录入':e.sample?'示例词汇':'历史记录',legacy:!e.articleId&&!e.batch?.id,entries:[]});
      const group=groups.get(id);group.entries.push(e);
      if(!group.articleId&&createdAt<group.createdAt){group.createdAt=createdAt;group.created=e.created;}
    }
    return [...groups.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))||a.id.localeCompare(b.id));
  }
  function dueEntries(entries,today=dateKey()){return entries.filter(e=>e.due<=today).sort((a,b)=>Number(b.star)-Number(a.star)||a.due.localeCompare(b.due)||a.created.localeCompare(b.created));}
  function removeEntries(entries,ids,session=null){
    const selected=new Set(ids),removed=entries.filter(e=>selected.has(e.id));
    const nextSession=session?{...session,ids:session.ids.filter(id=>!selected.has(id)),index:session.ids.slice(0,session.index).filter(id=>!selected.has(id)).length,history:session.history.filter(e=>!selected.has(e.id))}:null;
    return {entries:entries.filter(e=>!selected.has(e.id)),removed,session:nextSession};
  }
  function reviewed(entry,choice,interval=3,today=dateKey()){
    const days=choice==='again'?1:choice==='less'?7:interval;
    return {...entry,due:addDays(today,days),lastReviewed:today,reviews:entry.reviews+1,level:choice==='less'?'familiar':choice==='again'?'again':'reviewed',star:choice==='again'?true:choice==='less'?false:entry.star};
  }
  function seed(today=dateKey()){
    const rows=[
      ['sustain','维持；支撑','The region cannot sustain its current population.','The future of our cities',0,-1,'/səˈsteɪn/','这里是维持、支撑的意思。'],
      ['urban sprawl','城市蔓延','Urban sprawl has put increasing pressure on natural habitats.','The future of our cities',0,1,'/ˈɜːrbən sprɔːl/','注意这是一个完整词组。'],
      ['resilient','有韧性的；能恢复的','A resilient city can adapt to environmental change.','The future of our cities',0,-1,'/rɪˈzɪliənt/',''],
      ['allocate','分配；划拨','Planners must allocate more space to public transport.','The future of our cities',0,1,'/ˈæləkeɪt/','allocate something to something'],
      ['biodiversity','生物多样性','Even a small urban garden can support biodiversity.','The future of our cities',0,1,'/ˌbaɪoʊdaɪˈvɜːrsəti/',''],
      ['mitigate','减轻；缓解','Trees can help mitigate the effects of extreme heat.','The future of our cities',0,-1,'/ˈmɪtɪɡeɪt/','mitigate the effects of ...'],
      ['deteriorate','恶化；退化','Without regular care, the quality of the soil may deteriorate.','The secret life of soil',-1,-1,'/dɪˈtɪəriəreɪt/',''],
      ['retain','保留；保持','Healthy soil can retain water for longer periods.','The secret life of soil',-1,-1,'/rɪˈteɪn/','retain water：保持水分'],
      ['abundant','大量的；丰富的','Microorganisms are abundant in healthy soil.','The secret life of soil',-1,2,'/əˈbʌndənt/',''],
      ['in the long run','从长远来看','In the long run, restoring the land benefits the whole community.','The secret life of soil',-1,2,'',''],
      ['sustain','维持；使持续','Regular practice helps sustain attention over time.','How we learn',-3,3,'/səˈsteɪn/','又遇见了一次 sustain。'],
      ['retrieve','提取；找回','A familiar context can help us retrieve information.','How we learn',-3,3,'/rɪˈtriːv/',''],
      ['encounter','遇见；碰到','Readers often encounter the same word in different contexts.','How we learn',-3,4,'/ɪnˈkaʊntər/',''],
      ['underlying','潜在的；根本的','The study explored the underlying causes of the difference.','How we learn',-3,4,'/ˌʌndərˈlaɪɪŋ/','']
    ];
    return rows.map((r,i)=>({id:'sample-'+i,word:r[0],meaning:r[1],sentence:r[2],source:r[3],created:addDays(today,r[4]),due:addDays(today,r[5]),phonetic:r[6],note:r[7],reviews:r[4]<-1?1:0,level:r[4]<-1?'reviewed':'new',star:i===0||i===6,sample:true}));
  }
  const api={dateKey,addDays,normalize,parseBatch,addEntries,notebooks,dueEntries,reviewed,removeEntries,seed};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordJournal=api;
})(typeof globalThis!=='undefined'?globalThis:this);
