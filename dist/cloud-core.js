(function(root){
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const empty = () => ({articles:[],entries:[],settings:{interval:3,batch:5,autoTranslate:true},activeArticle:null,lastEntry:null});
  const stable = value => JSON.stringify(value, function(key, item){
    return item && !Array.isArray(item) && typeof item === 'object'
      ? Object.keys(item).sort().reduce((o,k)=>(o[k]=item[k],o),{}) : item;
  });
  const same = (a,b) => stable(a) === stable(b);
  function rows(state){
    const result=new Map();
    for(const table of ['articles','entries']) for(const item of state[table]||[]) result.set(table+':'+item.id,{table,id:item.id,data:item});
    result.set('preferences:settings',{table:'preferences',id:'settings',data:state.settings||empty().settings});
    return result;
  }
  function merge(base,local,remote,preference){
    const b=rows(base),l=rows(local),r=rows(remote),out=new Map(),conflicts=[];
    for(const key of new Set([...l.keys(),...r.keys(),...b.keys()])){
      const before=b.get(key),mine=l.get(key),theirs=r.get(key);
      let value;
      if(same(mine,before)) value=theirs;
      else if(same(theirs,before)||same(mine,theirs)) value=mine;
      else {conflicts.push(key);value=preference==='remote'?theirs:mine;}
      if(value)out.set(key,value);
    }
    const state={...copy(local),articles:[],entries:[]};
    for(const value of out.values())if(value.table==='preferences')state.settings=copy(value.data);else state[value.table].push(copy(value.data));
    if(!state.articles.some(a=>a.id===state.activeArticle))state.activeArticle=null;
    if(!state.entries.some(e=>e.id===state.lastEntry))state.lastEntry=null;
    return {state,conflicts};
  }
  function changes(base,local,versions){
    const a=rows(base),b=rows(local),result=[];
    for(const key of new Set([...a.keys(),...b.keys()])){
      if(same(a.get(key),b.get(key)))continue;
      const item=b.get(key)||a.get(key);
      result.push({table:item.table,id:item.id,version:versions[key]??null,data:b.has(key)?copy(item.data):null});
    }
    return result;
  }
  function migrate(account,guest){
    const result=copy(account);
    for(const table of ['articles','entries']){
      const map=new Map((result[table]||[]).map(x=>[x.id,x]));
      for(const item of guest[table]||[]){
        if(item.sample)continue;
        if(map.has(item.id)&&!same(map.get(item.id),item))throw new Error('本机记录与账号记录冲突，请先导出备份并核对。');
        map.set(item.id,copy(item));
      }
      result[table]=[...map.values()];
    }
    return result;
  }
  function decode(result){
    const state=empty(),versions={};
    for(const table of ['articles','entries','preferences'])for(const row of result[table]||[]){
      versions[table+':'+row.id]=row.version;
      if(table==='preferences')state.settings=row.payload;else state[table].push(row.payload);
    }
    return {state,versions};
  }
  const accountKey = id => 'read-keep-account-v1:'+id;
  const api={copy,empty,same,merge,changes,migrate,decode,accountKey};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CloudCore=api;
})(globalThis);
