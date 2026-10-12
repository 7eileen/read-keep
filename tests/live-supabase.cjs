// Explicit integration run: node tests/live-supabase.cjs
// Dedicated confirmed QA users only; no administrator key is used.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
for(const file of ['.env','.env.qa'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
 const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]??=m[2];
}
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
const make=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.any([...(opts?.signal?[opts.signal]:[]),AbortSignal.timeout(20000)])})}});
const clients=[make(),make()],anon=make(),tables=['articles','entries','preferences'];
const ok=result=>{assert.ifError(result.error);return result.data;};
const payloads={articles:{id:'qa-article',title:'QA article',created:'2026-10-12',kind:'粘贴文本',paragraphs:[{id:'p-1',text:'Cities adapt.'}]},entries:{id:'qa-entry',word:'adapt',meaning:'适应',source:'QA article',sentence:'Cities adapt.',created:'2026-10-12',due:'2026-10-13',reviews:0,star:false,note:'',level:'new'},preferences:{interval:3,batch:5,autoTranslate:false}};
const id=t=>t==='preferences'?'settings':payloads[t].id;
(async()=>{
 const users=[];
 for(let i=0;i<2;i++){
   const email=process.env[i?'QA_B_EMAIL':'QA_A_EMAIL'],password=process.env[i?'QA_B_PASSWORD':'QA_A_PASSWORD'];
   assert.ok(/^qa\.sync\.[ab]\./.test(email||''),'Only dedicated QA users may run this suite');
   users.push(ok(await clients[i].auth.signInWithPassword({email,password})).user);
   for(const t of tables)ok(await clients[i].from(t).delete().eq('owner_id',users[i].id));
 }
 const [a,b]=clients,[ua,ub]=users;
 for(const t of tables){
   assert.ok((await anon.from(t).select('*')).error,'Anonymous table reads denied: '+t);
   const row=ok(await a.from(t).insert({id:id(t),payload:payloads[t]}).select().single());
   assert.equal(row.owner_id,ua.id);assert.equal(row.version,1);
   assert.equal(ok(await b.from(t).select('*').eq('owner_id',ua.id)).length,0,'B cannot read A: '+t);
   assert.ok((await b.from(t).insert({owner_id:ua.id,id:id(t),payload:payloads[t]})).error,'B cannot insert under A: '+t);
   assert.equal(ok(await b.from(t).update({payload:{...payloads[t],qa:'attack'}}).eq('owner_id',ua.id).select()).length,0,'B cannot edit A: '+t);
   assert.equal(ok(await b.from(t).delete().eq('owner_id',ua.id).select()).length,0,'B cannot delete A: '+t);
   assert.ok((await a.from(t).update({owner_id:ub.id}).eq('id',id(t))).error,'Ownership cannot be transferred: '+t);
   const changed=ok(await a.from(t).update({payload:{...payloads[t],qa:'updated'}}).eq('id',id(t)).select().single());
   assert.equal(changed.version,2);assert.equal(changed.payload.qa,'updated');
   ok(await b.from(t).insert({id:id(t),payload:{...payloads[t],qa:'B'}}));
   assert.equal(ok(await b.from(t).select('*')).length,1);
 }
 console.log('PASS: authenticated CRUD and SELECT/INSERT/UPDATE/DELETE isolation on all three tables.');
 const aDevice2=make();ok(await aDevice2.auth.signInWithPassword({email:process.env.QA_A_EMAIL,password:process.env.QA_A_PASSWORD}));
 let snapshot=ok(await aDevice2.rpc('journal_load'));
 assert.equal(snapshot.entries[0].payload.qa,'updated');
 assert.equal(ok(await b.rpc('journal_load')).entries[0].payload.qa,'B');
 assert.ok((await anon.rpc('journal_load')).error);
 snapshot=ok(await a.rpc('journal_apply',{changes:[{table:'entries',id:'qa-entry',version:2,data:{...payloads.entries,note:'synced'}}]}));
 assert.equal(snapshot.entries[0].version,3);assert.equal(snapshot.entries[0].payload.note,'synced');
 assert.equal(ok(await aDevice2.rpc('journal_load')).entries[0].payload.note,'synced');
 const conflict=await a.rpc('journal_apply',{changes:[{table:'articles',id:'qa-article',version:2,data:{...payloads.articles,title:'Should rollback'}},{table:'entries',id:'qa-entry',version:1,data:{...payloads.entries,note:'stale'}}]});
 assert.equal(conflict.error?.code,'PT409',JSON.stringify({error:conflict.error,status:conflict.status}));
 assert.equal(conflict.status,409);
 assert.equal(ok(await a.rpc('journal_load')).articles[0].payload.title,'QA article','A failed batch rolls back earlier changes');
 ok(await a.rpc('journal_apply',{changes:[{table:'entries',id:'qa-entry',version:3,data:null}]}));
 assert.equal(ok(await aDevice2.rpc('journal_load')).entries.length,0,'Deletion propagates to another client');
 assert.equal(ok(await b.rpc('journal_load')).entries.length,1,'A deletion preserves B data');
 ok(await a.rpc('journal_apply',{changes:[{table:'entries',id:'qa-new',version:null,data:{...payloads.entries,id:'qa-new'}}]}));
 assert.equal(ok(await aDevice2.rpc('journal_load')).entries[0].id,'qa-new','New RPC records persist');
 console.log('PASS: independent authenticated client reads, RPC create/update/delete, optimistic conflicts and atomic rollback.');
 for(let i=0;i<2;i++)for(const t of tables)ok(await clients[i].from(t).delete().eq('owner_id',users[i].id));
 await Promise.all([a.auth.signOut({scope:'local'}),b.auth.signOut({scope:'local'}),aDevice2.auth.signOut({scope:'local'})]);
 console.log('QA data cleaned. All live Supabase checks passed.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
