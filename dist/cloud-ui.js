'use strict';
(function(){
  const CC=CloudCore,config=window.READ_KEEP_CONFIG||{};
  let client=null,user=null,engine=null,epoch=0,timer=null,booting=true,authMode='login',recovery=false;
  const configured=Boolean(config.url&&config.publishableKey&&window.ReadKeepSupabase);
  const captions={loading:'正在读取账号数据',syncing:'正在同步',synced:'已同步到云端',pending:'已保存在本机，待同步',error:'同步失败，记录仍保留在本机',conflict:'发现跨设备修改冲突'};
  function caption(){return user?(captions[engine?.status]||'正在读取账号数据'):'访客模式 · 仅此浏览器保存';}
  function refreshStatus(){
    const button=$('#account-button'),bar=$('#sync-bar');
    if(button){button.innerHTML=(user?icon('user'):'')+`<span>${user?'我的账号':'登录'}</span>`;button.dataset.guest=String(!user);button.title=user?.email||'登录后跨设备保存';}
    const badge=$('#guest-badge');if(badge)badge.hidden=Boolean(user)||booting;
    if(bar){bar.hidden=!user&&!booting;bar.dataset.status=booting?'loading':user?(engine?.status||'loading'):'guest';bar.innerHTML=bar.hidden?'':`<span>${icon(user?'cloud':'user')}${esc(booting?'正在检查登录状态…':caption())}</span>${user?'<button class="text-link" data-cloud="sync">同步</button>':''}${engine?.status==='conflict'?'<button class="text-link" data-cloud="account">处理冲突</button>':''}`;}
    document.querySelectorAll('[data-sync-caption]').forEach(el=>el.textContent=caption());
    const locked=booting||Boolean(user&&!engine?.ready);
    $('#main').inert=locked;
    document.querySelectorAll('.record-button').forEach(el=>el.disabled=locked);
    if($('#account-sync-status'))$('#account-sync-status').textContent=caption()+(engine?.error?'：'+engine.error:'');
  }
  function resetTransient(){
    for(const job of translationJobs.values())job.abort();translationJobs.clear();
    importTicket++;articleDraft={title:'',text:'',pages:[],fileName:'',kind:'粘贴文本',error:'',busy:false};
    draft={mode:'batch',source:'',batch:'',paragraph:'',selected:{}};
    session=null;query='';sourceFilter='';filter='all';bulkMode=false;bulkSelected.clear();bulkPending=[];
    phraseAnchor=null;nativePhrase=null;readerFocus=null;
    if($('#modal').open)closeDialog();
  }
  function guestState(){
    const raw=localStorage.getItem(KEY);
    const value=raw?JSON.parse(raw):{...CC.empty(),entries:C.seed()};
    if(!Array.isArray(value.entries)||!Array.isArray(value.articles||[]))throw new Error('访客记录格式异常，请保留备份');
    return value;
  }
  function applyState(next){
    const changed=!CC.same(state,next);state=next;persistedState=CC.copy(next);
    if(changed){session=null;render();}
    refreshStatus();
  }
  function remoteFor(userId){
    async function request(name,args){
      const sessionResult=await client.auth.getSession();
      const sessionValue=sessionResult.data.session;
      if(sessionResult.error||sessionValue?.user.id!==userId)throw new Error('登录账号已改变，请重新同步');
      // Pin the request to the account which owns this queue, even if another tab signs out.
      const {data,error}=await client.rpc(name,args).setHeader('Authorization','Bearer '+sessionValue.access_token);
      if(error)throw error;return CC.decode(data);
    }
    return {read:()=>request('journal_load'),apply:changes=>request('journal_apply',{changes})};
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>engine?.sync(),600);}
  async function switchUser(next){
    if(!booting&&next?.id===user?.id){if(recovery)authDialog('recovery');return;}
    const generation=++epoch;clearTimeout(timer);engine?.dispose();engine=null;user=next;resetTransient();
    state=CC.empty();persistedState=CC.copy(state);render();refreshStatus();
    try{
      if(!next){applyState(guestState());initializeReader();persistedState=CC.copy(state);}
      else{
        const active=new SyncEngine({userId:next.id,storage:localStorage,remote:remoteFor(next.id),
          onState:value=>{if(generation===epoch)applyState(value);},
          onStatus:()=>{if(generation===epoch)refreshStatus();}
        });
        engine=active;
        // A matching cache is shown only after Supabase has established this account's session.
        applyState(CC.copy(active.local));await active.sync();
      }
    }catch(error){toast('读取失败：'+error.message);}
    finally{if(generation===epoch){booting=false;render();refreshStatus();if(recovery)authDialog('recovery');}}
  }
  window.CloudSession={
    caption,refreshStatus,
    save(next){
      if(booting)throw new Error('登录状态检查中，请稍后再试');
      if(user){if(!engine)throw new Error('账号数据尚未加载');engine.save(next);schedule();}
      else localStorage.setItem(KEY,JSON.stringify(next));
      return true;
    },
    ownsGuest(){return !user&&!booting;}
  };
  function authDialog(mode='login'){
    authMode=mode;dialogState='account';
    if(!configured){showDialog('账号同步尚未配置','<p class="dialog-subtitle">当前仍可在本浏览器记录。完成 Supabase 和网站配置后即可登录同步。</p>');return;}
    if(user&&mode!=='recovery'){
      let count=0;try{count=(guestState().entries||[]).filter(e=>!e.sample).length;}catch{}
      showDialog('我的账号',`<p class="account-email">${esc(user.email)}</p><div class="account-info"><p id="account-sync-status">${esc(caption())}</p><p>在其他设备登录同一账号即可读取已同步记录。</p></div><div class="account-actions"><button class="btn primary" data-cloud="sync">立即同步</button><button class="btn" data-action="export">导出当前记录</button></div>${engine?.status==='conflict'?'<div class="account-conflict"><p>同一记录在本机和云端都被修改。请先导出当前记录，再选择冲突记录采用哪个版本；其他记录会继续合并。</p><button class="btn" data-cloud="resolve-local">冲突记录采用本机版本</button><button class="btn" data-cloud="resolve-remote">冲突记录采用云端版本</button></div>':''}<div class="account-info"><p>本机有 ${count} 条访客生词。迁移后加入当前账号，重复记录会跳过。</p><button class="btn" data-cloud="migrate">迁移访客记录</button></div><p id="auth-message" role="status"></p><button class="text-link" data-cloud="logout">退出当前设备</button>`);
    }else{
      const title=mode==='signup'?'注册':mode==='reset'?'找回密码':mode==='recovery'?'设置新密码':'登录';
      showDialog(title,`<form id="auth-form">${mode==='recovery'?'':'<div class="form-row"><label for="auth-email">邮箱</label><input id="auth-email" name="email" type="email" autocomplete="email" required maxlength="254"></div>'}${mode==='reset'?'':`<div class="form-row"><label for="auth-password">${mode==='recovery'?'新密码':'密码'}</label><input id="auth-password" placeholder="至少 8 位" name="password" type="password" autocomplete="${mode==='login'?'current-password':'new-password'}" minlength="8" maxlength="128" required></div>`}<p id="auth-message" role="status"></p><button class="btn primary" id="auth-submit" type="submit">${mode==='signup'?'注册':mode==='reset'?'发送重置邮件':mode==='recovery'?'保存新密码':'登录'}</button></form>${mode==='recovery'?'':`<div class="account-actions"><button class="text-link" data-cloud="${mode==='signup'?'login':'signup'}">${mode==='signup'?'返回登录':'创建账号'}</button><button class="text-link" data-cloud="${mode==='reset'?'login':'reset'}">${mode==='reset'?'返回登录':'忘记密码'}</button></div>`}`);
    }
    refreshStatus();
  }
  function message(text){if($('#auth-message'))$('#auth-message').textContent=text;else toast(text);}
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='auth-form')return;event.preventDefault();
    const form=event.target,data=new FormData(form),email=String(data.get('email')||'').trim(),password=String(data.get('password')||''),mode=authMode;
    const submit=form.querySelector('button[type="submit"]');submit.disabled=true;message('正在处理…');
    try{
      let result;
      if(mode==='signup')result=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/'}});
      else if(mode==='reset')result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/'});
      else if(mode==='recovery')result=await client.auth.updateUser({password});
      else result=await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      if(mode==='signup')message('请查收验证邮件，验证后再登录。没有收到时请联系站点管理员确认邮件服务。');
      else if(mode==='reset')message('如果该邮箱已注册，会收到重置密码邮件。');
      else if(mode==='recovery'){recovery=false;authDialog();message('新密码已保存');}
      else{if($('#modal').open)closeDialog();toast('登录成功，正在读取你的记录');}
    }catch(error){message(error.message==='Invalid login credentials'?'邮箱或密码不正确':error.message==='Email not confirmed'?'请先完成邮箱验证':error.message);}
    finally{if(submit.isConnected)submit.disabled=false;}
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-cloud]');if(!button)return;const action=button.dataset.cloud;
    if(['account','login','signup','reset'].includes(action)){authDialog(action==='account'?'login':action);return;}
    if(!engine||!user)return;
    const active=engine,generation=epoch;button.disabled=true;
    try{
      if(action==='sync'){await active.sync();if(generation===epoch&&active.status==='conflict')authDialog();}
      if(action==='resolve-local'||action==='resolve-remote'){await active.sync(action==='resolve-local'?'local':'remote');if(generation===epoch)authDialog();}
      if(action==='migrate'){
        active.save(CC.migrate(active.local,guestState()));applyState(CC.copy(active.local));await active.sync();
        if(generation===epoch)message(active.status==='synced'?'访客记录已迁入当前账号，原访客记录仍保留。':'记录已加入待同步队列，请检查同步状态。');
      }
      if(action==='logout'){
        if(active.pending()){await active.sync();if(active.pending())throw new Error('仍有未同步记录，请先同步成功或导出备份，暂不退出以免丢失。');}
        const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
        localStorage.removeItem(active.key);
      }
    }catch(error){message(error.message);}finally{if(button.isConnected)button.disabled=false;refreshStatus();}
  });
  window.addEventListener('online',()=>engine?.sync());
  window.addEventListener('focus',()=>{if(!$('#modal').open)engine?.sync();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!$('#modal').open)engine?.sync();});
  window.addEventListener('storage',event=>{
    if(engine&&event.key===engine.key&&event.newValue){
      // Another tab's local pending writes must not be silently overwritten.
      if(engine.pending()){engine.notify('conflict','同一浏览器另一个页面也有修改，请先保留当前记录并同步。');return;}
      try{const saved=JSON.parse(event.newValue);if(saved.userId===user.id){engine.base=saved.base;engine.local=saved.local;engine.versions=saved.versions;applyState(CC.copy(saved.local));schedule();}}catch{}
    }
  });
  refreshStatus();
  if(!configured){booting=false;refreshStatus();return;}
  client=window.ReadKeepSupabase.createClient(config.url,config.publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
    global:{fetch:async(url,options={})=>{
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
      const cancel=()=>controller.abort();options.signal?.addEventListener('abort',cancel,{once:true});
      if(options.signal?.aborted)cancel();
      try{return await fetch(url,{...options,signal:controller.signal});}
      finally{clearTimeout(timeout);options.signal?.removeEventListener('abort',cancel);}
    }}
  });
  client.auth.onAuthStateChange((event,sessionValue)=>{
    if(event==='PASSWORD_RECOVERY')recovery=true;
    // Run outside the auth callback lock; RPC may need the refreshed access token.
    setTimeout(()=>switchUser(sessionValue?.user||null),0);
  });
})();
