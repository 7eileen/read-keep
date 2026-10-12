(function(root){
  'use strict';
  const C=typeof module!=='undefined'&&module.exports?require('./cloud-core.js'):root.CloudCore;
  class SyncEngine {
    constructor({userId,storage,remote,onState=()=>{},onStatus=()=>{}}){
      this.userId=userId;this.storage=storage;this.remote=remote;this.onState=onState;this.onStatus=onStatus;
      this.key=C.accountKey(userId);this.base=C.empty();this.local=C.empty();this.versions={};this.status='loading';this.disposed=false;this.ready=false;
      const raw=storage.getItem(this.key);
      if(raw){const saved=JSON.parse(raw);if(saved.userId!==userId)throw new Error('账号缓存不匹配');this.base=saved.base;this.local=saved.local;this.versions=saved.versions;}
    }
    cache(local=this.local){this.storage.setItem(this.key,JSON.stringify({userId:this.userId,base:this.base,local,versions:this.versions}));}
    notify(status,error=''){this.status=status;this.error=error;this.onStatus(status,error);}
    save(state){
      if(this.disposed||!this.ready)throw new Error('账号数据尚未加载，请先同步');
      const next=C.copy(state);this.cache(next);this.local=next;this.notify('pending');
    }
    pending(){return C.changes(this.base,this.local,this.versions).length>0;}
    dispose(){this.disposed=true;}
    sync(preference){
      if(this.disposed)return Promise.resolve();
      if(this.running)return this.running;
      this.running=this.perform(preference).finally(()=>{this.running=null;});return this.running;
    }
    async perform(preference){
      this.notify('syncing');
      try{
        for(let round=0;round<8;round++){
          const current=await this.remote.read();if(this.disposed)return;
          const merge=C.merge(this.base,this.local,current.state,preference);
          if(merge.conflicts.length&&!preference){this.conflicts=merge.conflicts;this.ready=true;this.notify('conflict','这些记录已在另一设备修改：'+merge.conflicts.length+' 条');return;}
          const changes=C.changes(current.state,merge.state,current.versions);
          const before=C.copy(this.local);
          const saved=changes.length?await this.remote.apply(changes):current;
          if(this.disposed)return;
          // Only changes made after this request started override its acknowledgement.
          this.local=C.merge(before,this.local,changes.length?saved.state:merge.state,'local').state;
          this.base=C.copy(saved.state);this.versions=saved.versions;this.ready=true;this.cache();this.onState(C.copy(this.local));
          if(!this.pending()){this.conflicts=[];this.notify('synced');return;}
          preference=undefined;
        }
        this.notify('pending');
      }catch(error){if(!this.disposed)this.notify(error.code==='PT409'?'conflict':'error',error.message||'同步失败，稍后重试');}
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=SyncEngine;else root.SyncEngine=SyncEngine;
})(globalThis);
