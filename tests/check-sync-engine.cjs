const assert=require('node:assert/strict'),fs=require('node:fs');
assert.ok(fs.existsSync(require('node:path').join(__dirname,'../dist/sync-engine.js')),'Sync engine exists');
const C=require('../dist/cloud-core.js'),Engine=require('../dist/sync-engine.js');
const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
let server=C.empty(),versions={},fail=false,delay=null;
const remote={read:async()=>({state:C.copy(server),versions:{...versions}}),apply:async changes=>{
  if(fail)throw new Error('offline');
  if(delay)await delay;
  for(const op of changes){const key=op.table+':'+op.id;assert.equal(op.version,versions[key]??null);
    if(op.table==='preferences')server.settings=op.data;else server[op.table]=server[op.table].filter(r=>r.id!==op.id).concat(op.data?[op.data]:[]);
    if(op.data)versions[key]=(versions[key]||0)+1;else delete versions[key];
  }
  return {state:C.copy(server),versions:{...versions}};
}};
(async()=>{
 const a=new Engine({userId:'A',storage,remote}); await a.sync();
 a.save({...a.local,entries:[{id:'one',word:'one',due:'2026-10-13'}]}); fail=true;
 await a.sync(); assert.equal(a.status,'error'); assert.equal(a.local.entries.length,1); assert.equal(server.entries.length,0);
 const resumed=new Engine({userId:'A',storage,remote}); assert.equal(resumed.local.entries.length,1);
 fail=false;await resumed.sync(); assert.equal(server.entries.length,1);
 const b=new Engine({userId:'B',storage,remote}); assert.equal(b.local.entries.length,0,'Account B never restores A cache');
 const quota=new Engine({userId:'quota',storage:{getItem:()=>null,setItem:()=>{throw new Error('quota');}},remote});
 quota.ready=true;assert.throws(()=>quota.save({...quota.local,entries:[{id:'unsaved'}]}),/quota/);
 assert.equal(quota.local.entries.length,0,'A failed local queue write is not reported as a saved change');
 let release; delay=new Promise(resolve=>release=resolve);
 resumed.save({...resumed.local,entries:[{...resumed.local.entries[0],note:'first'}]});
 const pending=resumed.sync();await new Promise(resolve=>setImmediate(resolve));
 resumed.save({...resumed.local,entries:[{...resumed.local.entries[0],note:'second'}]});delay=null;release();await pending;
 assert.equal(server.entries[0].note,'second','In-flight edits are sent after first acknowledgement');
 server.entries[0].note='remote';versions['entries:one']++;
 resumed.save({...resumed.local,entries:[{...resumed.local.entries[0],note:'local'}]});await resumed.sync();assert.equal(resumed.status,'conflict');assert.equal(server.entries[0].note,'remote');
 await resumed.sync('remote');assert.equal(resumed.local.entries[0].note,'remote');
 const conflictEngine=new Engine({userId:'conflict',storage,remote:{read:async()=>{throw Object.assign(new Error('SYNC_CONFLICT'),{code:'PT409'});}}});
 await conflictEngine.sync();assert.equal(conflictEngine.status,'conflict','HTTP 409 is an application conflict, not a retryable server failure');
 const stale=new Engine({userId:'A',storage,remote,onState:()=>{throw new Error('Disposed engine must not expose state');}});stale.dispose();await stale.sync();
 console.log('PASS: queued writes, offline recovery, account cache isolation, in-flight edits, conflicts and disposal.');
})().catch(e=>{console.error(e);process.exitCode=1;});
