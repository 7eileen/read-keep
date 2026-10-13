'use strict';
const RC=ArticleCore;
let articleDraft={title:'',text:'',pages:[],fileName:'',kind:'粘贴文本',error:'',busy:false};
let readerMode='word',phraseAnchor=null,nativePhrase=null,readerFocus=null,importTicket=0;
const translationJobs=new Map();
const sampleArticle={title:'The future of our cities',text:'Cities are growing at an unprecedented pace. As more people move into urban areas, planners must find ways to sustain communities without putting excessive pressure on the environment. A resilient city can adapt to change while protecting the people who live there.\n\nOne important challenge is urban sprawl. When a city spreads into the surrounding countryside, natural habitats become fragmented. Trees and green spaces can help mitigate the effects of extreme heat, retain rainwater and support biodiversity.\n\nLocal authorities need to allocate resources carefully. In response to rising temperatures, some neighbourhoods have created small public gardens. These spaces provide shelter for wildlife and give residents a place to meet.\n\nIn the long run, the success of these projects depends on participation. Even when financial resources are scarce, communities can make meaningful improvements by sharing knowledge and working together.'};
function initializeReader(){
  if(!Array.isArray(state.articles))state.articles=[];
  if(state.settings.autoTranslate===undefined)state.settings.autoTranslate=true;
  state.entries.forEach(e=>{if(e.translationStatus==='pending'){e.translationStatus='error';e.translationError='上次翻译已中断，点击重试即可继续。';}});
}
function currentArticle(){return state.articles.find(a=>a.id===state.activeArticle)||null;}
function articleEntries(article,todayOnly=false,unknownOnly=true){return state.entries.filter(e=>e.articleId===article.id&&(!unknownOnly||V.isUnknown(state,e.word))&&(!todayOnly||e.created===today()));}
function readerPage(){
  const article=currentArticle();
  if(!article)return readerLanding();
  const selections=articleEntries(article).filter(e=>!e.locationStale);
  return `<div class="reader-breadcrumb"><button class="text-link" data-reader="shelf">${icon('book')}我的文章</button><span>/</span><span>${esc(article.title)}</span></div><div class="reader-layout"><section class="reading-paper"><div class="reader-paper-top"><div class="reader-paper-actions"><button class="text-link" data-reader="edit-article" data-id="${esc(article.id)}">${icon('edit')}编辑文章</button><button class="text-link" data-reader="import">${icon('plus')}导入文章</button></div></div><h1 class="article-title">${esc(article.title)}</h1><div class="article-meta"><span>${esc(article.kind)}</span>${article.edited?'<span>已编辑</span>':''}<span>${article.paragraphs.reduce((n,p)=>n+(p.text.match(/[A-Za-z]+/g)||[]).length,0)} 词</span><span>${shortDate(article.created)}导入</span>${article.sample?'<span>自拟示例</span>':''}</div><div class="reader-controls"><div class="reader-mode"><button class="${readerMode==='word'?'active':''}" data-reader="mode" data-mode="word" aria-pressed="${readerMode==='word'}">点选单词</button><button class="${readerMode==='phrase'?'active':''}" data-reader="mode" data-mode="phrase" aria-pressed="${readerMode==='phrase'}">选取短语</button></div><span class="reader-tip" id="reader-tip">${readerMode==='phrase'?'依次点选短语的第一个词和最后一个词':'点选加入生词本 · 再点移出'}</span></div><div class="reader-body" id="reader-body">${article.paragraphs.map((p,i)=>`<section class="reader-paragraph" id="paragraph-${i}"><div class="paragraph-marker">${String(i+1).padStart(2,'0')}${p.page?`<span>P.${p.page}</span>`:''}</div><p data-paragraph="${i}">${RC.tokenize(p.text).map(t=>{if(!t.word)return esc(t.text);const selected=selections.some(e=>e.paragraphIndex===i&&e.rangeStart<=t.start&&e.rangeEnd>=t.end);return `<span class="reader-word ${selected?'kept':''}" role="button" tabindex="0" data-reader="word" data-p="${i}" data-start="${t.start}" data-end="${t.end}" aria-label="${selected?'取消选择':'收录'} ${esc(t.text)}" aria-pressed="${selected}">${esc(t.text)}</span>`;}).join('')}</p></section>`).join('')}</div></section><aside class="reader-sidebar" aria-label="已收录的词"><div id="reader-picked">${pickedPanel(article)}</div></aside></div><div class="reader-mobile-dock"><button data-reader="picked" class="btn primary">${icon('book')}<span id="mobile-picked-count">已选生词 ${articleEntries(article).length} 个词</span></button><a class="btn" href="#library">去生词本 ${icon('arrow')}</a></div><div class="phrase-popover" id="phrase-popover" hidden></div>${footer()}`;
}
function articleShelfCard(a){return `<article class="article-shelf-card"><button class="article-shelf-open" data-reader="open" data-id="${esc(a.id)}" aria-label="阅读 ${esc(a.title)}"><span class="shelf-icon">${icon('book')}</span><span class="article-shelf-copy"><strong>${esc(a.title)}</strong><small>${shortDate(a.created)} · ${esc(a.kind)} · 已收录 ${articleEntries(a,false,false).length} 条</small></span>${icon('arrow')}</button><div class="article-shelf-actions"><button class="text-link" data-reader="rename" data-id="${esc(a.id)}" aria-label="修改文章名：${esc(a.title)}">${icon('edit')}改名</button><button class="text-link article-delete-action" data-reader="delete-article" data-id="${esc(a.id)}" aria-label="删除文章：${esc(a.title)}">${icon('trash')}删除</button></div></article>`;}
function articleRenameDialog(id){
  const a=state.articles.find(a=>a.id===id);if(!a)return;
  dialogState='rename-article';
  showDialog('修改文章名',`<form id="article-rename-form" data-id="${esc(id)}"><p class="dialog-subtitle">新名称会同步到这篇文章已收录的生词中。</p><div class="form-row"><label for="article-new-title">文章名称</label><input id="article-new-title" name="title" value="${esc(a.title)}" maxlength="150" required autofocus></div><p id="article-rename-error" class="error" role="alert"></p><div class="form-footer"><button class="btn primary" type="submit">${icon('check')}保存名称</button></div></form>`);
}
function articleEditDialog(id){
  const a=state.articles.find(a=>a.id===id);if(!a)return;
  dialogState='edit-article';
  showDialog('编辑文章',`<form id="article-edit-form" data-id="${esc(id)}" data-revision="${a.revision||0}"><div class="form-row"><label for="article-edit-title">文章名称</label><input id="article-edit-title" name="title" value="${esc(a.title)}" maxlength="150" required></div><div class="form-row"><label for="article-edit-body">文章正文</label><textarea id="article-edit-body" name="body" rows="12" maxlength="60000" required spellcheck="false">${esc(a.paragraphs.map(p=>p.text).join('\n\n'))}</textarea><p class="field-hint">回车换行，空行分段。</p></div><div class="article-edit-note">生词与原句会保留；改动正文后，部分高亮位置可能失效。</div><p id="article-edit-error" class="error" role="alert"></p><div class="article-confirm-actions"><button type="submit" class="btn primary">${icon('check')}保存文章</button></div></form>`);
}
document.addEventListener('submit',ev=>{
  if(ev.target.id!=='article-edit-form')return;ev.preventDefault();
  const id=ev.target.dataset.id,article=state.articles.find(a=>a.id===id),previous=state;
  if(!article||(article.revision||0)!==Number(ev.target.dataset.revision)){$('#article-edit-error').textContent='文章已在其他页面更新，请关闭后重新打开编辑。';return;}
  const form=new FormData(ev.target);
  try{state=RC.editArticle(state,id,form.get('title'),form.get('body'));}catch(error){$('#article-edit-error').textContent=error.message;return;}
  if(!persist()){state=previous;$('#article-edit-error').textContent='暂时无法保存，请保留编辑窗口并稍后重试。';return;}
  if(session)session.history=session.history.map(old=>{if(old.articleId!==id)return old;const current=state.entries.find(e=>e.id===old.id);if(!current)return old;return {...old,source:current.source,paragraphIndex:current.paragraphIndex,rangeStart:current.rangeStart,rangeEnd:current.rangeEnd,locationKey:current.locationKey,locationStale:current.locationStale,sourcePage:current.sourcePage};});
  if(sourceFilter===article.title&&!state.entries.some(e=>e.source===article.title))sourceFilter=state.articles.find(a=>a.id===id).title;
  phraseAnchor=null;nativePhrase=null;readerFocus=null;closeDialog();render();toast('文章已保存');
});
function articleDeleteDialog(id){
  const a=state.articles.find(a=>a.id===id);if(!a)return;
  const count=articleEntries(a,false,false).length;dialogState='delete-article';
  showDialog('删除这篇文章？',`<p class="dialog-subtitle">将删除「${esc(a.title)}」的正文，删除后无法恢复全文阅读。</p><div class="info-box">${count?`已收录的 ${count} 条来源记录、释义、原句、笔记和学习历史保留。`:'这篇文章尚未收录词汇。'}关联词汇册及生词标记不变。</div><p id="article-delete-error" class="error" role="alert"></p><div class="article-confirm-actions"><button class="btn danger" data-reader="confirm-delete-article" data-id="${esc(id)}">${icon('trash')}确认删除文章</button></div>`);
}
function deleteSavedArticle(id){
  if(dialogState!=='delete-article')return;
  if(!state.articles.some(a=>a.id===id)){closeDialog();render();toast('这篇文章已经被删除');return;}
  const previous=state;state=RC.removeArticle(state,id);
  if(!persist()){state=previous;$('#article-delete-error').textContent='暂时无法保存，文章尚未删除。请稍后重试。';return;}
  phraseAnchor=null;nativePhrase=null;readerFocus=null;closeDialog();render();toast('文章已删除，生词记录已保留');
}
document.addEventListener('submit',ev=>{
  if(ev.target.id!=='article-rename-form')return;ev.preventDefault();
  const id=ev.target.dataset.id,previous=state,oldTitle=state.articles.find(a=>a.id===id)?.title;
  try{state=RC.renameArticle(state,id,new FormData(ev.target).get('title'));}catch(error){$('#article-rename-error').textContent=error.message;return;}
  if(!persist()){state=previous;$('#article-rename-error').textContent='暂时无法保存，名称尚未修改。请稍后重试。';return;}
  const title=state.articles.find(a=>a.id===id).title;
  if(session)session.history=session.history.map(e=>e.articleId===id?{...e,source:title}:e);
  if(sourceFilter===oldTitle&&!state.entries.some(e=>e.source===oldTitle))sourceFilter=title;
  closeDialog();render();toast('文章名已更新');
});
function readerLanding(){return `${intro('','文章','',`<button class="btn primary" data-reader="import">${icon('plus')}导入文章</button>`)}${state.articles.length?`<div class="article-shelf">${state.articles.map(articleShelfCard).join('')}</div>`:empty('暂无文章','PDF / Word / TXT / 粘贴正文','导入文章','import-article')}<details class="translation-disclosure"><summary>翻译与数据说明</summary><p>词语和原句发送至词典与翻译服务；文章文件在本机解析，登录后正文同步到云端。</p></details>${footer()}`;}

function translationStatus(e){if(e.meaningEdited)return '<span class="translation-label manual">已手动确认</span>';if(e.translationStatus==='pending')return '<span class="translation-label"><i class="tiny-spinner"></i>翻译中</span>';if(e.translationStatus==='error')return '<span class="translation-label issue">待补充译文</span>';if(e.translationStatus==='partial')return '<span class="translation-label issue">部分译文待补充</span>';if(e.translationStatus==='ready')return `<span class="translation-label">${e.meaningSource==='dictionary'?'词典释义 · 机译参考':'机器翻译 · 参考'}</span>`;return '<span class="translation-label">待翻译</span>';}
function pickedCard(e){return `<article class="picked-word" data-picked="${e.id}"><div class="picked-word-top"><button class="picked-title" data-reader="locate" data-id="${e.id}">${esc(e.word)}</button><button class="icon-btn" data-reader="undo" data-id="${e.id}" aria-label="撤销收录 ${esc(e.word)}">${icon('undo')}</button></div>${translationStatus(e)}<p class="picked-meaning">${esc(e.meaning)||'已保存，释义稍后补齐'}</p>${lexicalInfo(e,true)}${e.translationError?`<p class="translation-error">${esc(e.translationError)}</p>`:''}<div class="picked-actions"><span>${e.locationStale?'原文位置已变化':`第 ${e.paragraphIndex+1} 段${e.sourcePage?` · P.${e.sourcePage}`:''}`}</span><span>${e.lexicon?.status==='ready'&&e.translationStatus!=='pending'&&!e.meaningEdited&&e.translationStatus!=='ready'?`<button data-reader="retry" data-id="${e.id}">重试翻译</button>`:''}<button data-action="edit" data-id="${e.id}">编辑</button></span></div></article>`;}
function pickedPanel(article){const entries=articleEntries(article);return `<div class="picked-panel-heading"><h2>已选生词 <span>${entries.length}</span></h2></div><label class="auto-translate-switch"><span>${icon('spark')}自动翻译</span><input type="checkbox" id="reader-auto" ${state.settings.autoTranslate?'checked':''} aria-label="自动翻译所选词及原句"></label><div class="picked-list">${entries.length?entries.map(pickedCard).join(''):`<div class="picked-empty">${icon('leaf')}<h3>暂无生词</h3></div>`}</div><details class="reader-service-note"><summary>翻译说明</summary><p>词语、原句及词典释义和例句会发送至翻译服务，不发送全文。机器翻译需结合原文核对。</p></details><a class="btn reader-to-notebook" href="#library">打开生词本 ${icon('arrow')}</a>`;}
function readerRefresh(){
  if(dialogState==='detail'&&$('#modal').open)detail($('#modal').dataset.entry);
  if(route!=='read'){render();return;}
  const article=currentArticle();if(!article)return;
  const entries=articleEntries(article).filter(e=>!e.locationStale);
  document.querySelectorAll('.reader-word').forEach(el=>{const p=Number(el.dataset.p),s=Number(el.dataset.start),end=Number(el.dataset.end);const hit=entries.some(e=>e.paragraphIndex===p&&e.rangeStart<=s&&e.rangeEnd>=end);el.classList.toggle('kept',hit);el.setAttribute('aria-pressed',String(hit));el.setAttribute('aria-label',(hit?'取消选择 ':'收录 ')+el.textContent);});
  if($('#reader-picked'))$('#reader-picked').innerHTML=pickedPanel(article);
  if($('#mobile-picked-count'))$('#mobile-picked-count').textContent=`已选生词 ${articleEntries(article).length} 个词`;
  if(dialogState==='picked'&&$('#picked-dialog-list'))$('#picked-dialog-list').innerHTML=articleEntries(article).map(pickedCard).join('')||'<p class="muted">还没有收录生词。</p>';
}
function readerAfterRender(){
  if(route!=='read')return;
  const article=currentArticle();if(article&&state.settings.autoTranslate)articleEntries(article).filter(e=>!e.lexicon&&e.translationStatus!=='pending'&&!translationJobs.has(e.id)).slice(0,3).forEach(e=>translateEntry(e.id));
  if(readerFocus){const pending=readerFocus;readerFocus=null;requestAnimationFrame(()=>{const section=$('#paragraph-'+pending.p);section?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});section?.classList.add('paragraph-flash');setTimeout(()=>section?.classList.remove('paragraph-flash'),1800);});}
}
function importDialog(){dialogState='import';showDialog('导入文章',`<form id="article-form"><label class="file-upload-zone" for="article-file">${icon('plus')}<strong>选择 PDF、Word 或 TXT 文件</strong><span>文字版 PDF · 最多 10 MB / 40 页</span><input id="article-file" type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label><div id="file-progress" class="file-progress" role="status">${articleDraft.busy?'正在读取文章…':esc(articleDraft.fileName)}</div><div class="form-row"><label for="article-title">文章名称</label><input id="article-title" maxlength="150" placeholder="输入文章名称" value="${esc(articleDraft.title)}"></div><div class="form-row"><label for="article-text">文章正文 <small>也可以直接粘贴</small></label><textarea id="article-text" rows="7" maxlength="60000" placeholder="在这里粘贴英文全文。不同段落之间留一个空行。">${esc(articleDraft.text)}</textarea><p class="field-hint">暂不支持扫描版 PDF；导入后可修改文字。</p></div><p id="article-error" class="error" role="alert">${esc(articleDraft.error)}</p><div class="form-footer"><button id="article-submit" type="submit" class="btn primary" ${articleDraft.busy?'disabled':''}>开始阅读 ${icon('arrow')}</button></div></form>`);}
function captureArticleDraft(){if(dialogState!=='import')return;articleDraft.title=$('#article-title')?.value||articleDraft.title;articleDraft.text=$('#article-text')?.value??articleDraft.text;}
async function readArticleFile(file){
  if(!file)return;captureArticleDraft();const ticket=++importTicket;articleDraft.error='';
  if(file.size>10*1024*1024){$('#article-error').textContent='文件超过 10 MB，请导出需要阅读的页面后再导入。';return;}
  if(!/\.(pdf|txt|docx)$/i.test(file.name)){$('#article-error').textContent='目前支持 PDF、DOCX 和 TXT 文件，也可以直接粘贴文章。';return;}
  articleDraft.busy=true;$('#article-submit').disabled=true;$('#file-progress').textContent='正在读取 '+file.name+'…';
  try{
    let pages=[],text='';const buffer=await file.arrayBuffer();
    if(/\.pdf$/i.test(file.name)){
      const base=globalThis.ReaderPDFBase||new URL('vendor/',document.baseURI).href;
      const pdfjs=await import(base+'pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=base+'pdf.worker.mjs';
      const task=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true});
      try{
        const pdf=await task.promise;
        if(pdf.numPages>40)throw new Error('这份 PDF 超过 40 页，请先导出需要阅读的文章页面。');
        for(let page=1;page<=pdf.numPages;page++){
          if(ticket!==importTicket)return;
          if($('#file-progress')&&dialogState==='import')$('#file-progress').textContent=`正在提取第 ${page} / ${pdf.numPages} 页…`;
          const content=await (await pdf.getPage(page)).getTextContent();let pageText='',previousY=null;
          for(const item of content.items){if(typeof item.str!=='string')continue;const y=item.transform?.[5];if(previousY!==null&&y!==undefined&&Math.abs(y-previousY)>Math.max(12,(item.height||10)*1.8))pageText+='\n\n';pageText+=item.str+(item.hasEOL?'\n':' ');if(y!==undefined)previousY=y;}
          const pieces=RC.paragraphs(pageText);pieces.forEach(p=>pages.push({text:p,page}));
        }
      }finally{await task.destroy();}
      text=pages.map(p=>p.text).join('\n\n');
      if(text.replace(/\s/g,'').length<15)throw new Error('没有提取到可选文字。这可能是扫描版 PDF，请先转换为文字，或粘贴文章全文。');
    }else if(/\.docx$/i.test(file.name)){const {extractDocx}=await import('./vendor/docx.js');text=await extractDocx(buffer);}else{text=new TextDecoder('utf-8').decode(buffer);if(text.includes('\uFFFD'))text=new TextDecoder('gb18030').decode(buffer);}
    if(text.length>60000)throw new Error('文章文字超过 60,000 字符，请分成几篇导入。');
    if(!/[A-Za-z]{2}/.test(text))throw new Error('未检测到英文正文，请检查文件或直接粘贴英文内容。');
    if(ticket!==importTicket)return;
    articleDraft={...articleDraft,title:file.name.replace(/\.(pdf|txt|docx)$/i,''),text,pages,fileName:file.name,kind:/\.pdf$/i.test(file.name)?'PDF':/\.docx$/i.test(file.name)?'Word':'TXT',error:'',busy:false};
    if(dialogState==='import'){$('#article-title').value=articleDraft.title;$('#article-text').value=text;$('#file-progress').textContent=`已读取 ${file.name} · ${pages.length?pages[pages.length-1].page+' 页 · ':''}${text.length.toLocaleString()} 字符`;$ ('#article-error').textContent='';}
  }catch(error){if(ticket===importTicket&&dialogState==='import'){$('#article-error').textContent=error.name==='PasswordException'?'PDF 有密码保护，请先解锁后再导入。':error.message.includes('fetch')?'PDF 解析组件加载失败，请联网后重试，或先粘贴正文。':error.message||'无法读取这份文件，请尝试粘贴正文。';}}
  finally{if(ticket===importTicket){articleDraft.busy=false;if($('#article-submit')&&dialogState==='import')$('#article-submit').disabled=false;}}
}
function saveArticle(data){const title=V.validateTitle(state,data.title),parts=data.pages?.length?data.pages:RC.paragraphs(data.text).map(text=>({text})),id='article-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),now=new Date().toISOString();const article={id,title,kind:data.kind||'粘贴文本',created:today(),importedAt:now,paragraphs:parts};const previous=state;state={...state,articles:[article,...state.articles],notebooks:[{id:'book-'+id,title,createdAt:now,kind:'文章词汇',articleId:id},...state.notebooks],activeArticle:id};if(!persist()){state=previous;return null;}readerMode='word';phraseAnchor=null;return article;}

function currentPositionEntry(article,p,range){const key=RC.locationKey(article.id,p,range.start,range.end);return state.entries.find(e=>!e.locationStale&&e.locationKey===key);}
function collectRange(p,start,end){
  const article=currentArticle();if(!article?.paragraphs[p])return;
  let range;try{range=RC.selection(article.paragraphs[p].text,start,end);}catch(error){toast(error.message);return;}
  const existing=currentPositionEntry(article,p,range);if(existing){if(V.isUnknown(state,existing.word))uncollectEntry(existing.id);else{const previous=state;state=V.mark(state,[existing.word],true);if(!persist()){state=previous;return;}readerRefresh();}return;}
  const e={id:'word-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),...range,rangeStart:range.start,rangeEnd:range.end,articleId:article.id,articleImportedAt:article.importedAt||article.created,paragraphIndex:p,locationKey:RC.locationKey(article.id,p,range.start,range.end),sourcePage:article.paragraphs[p].page||null,source:article.title,created:today(),due:C.addDays(today(),1),reviews:0,note:'',meaning:'',meaningEdited:false,level:'new',translationStatus:'idle',translationVersion:0};
  const previous=state;let book=state.notebooks.find(b=>b.articleId===article.id);if(!book){let title=article.title,n=2;while(state.notebooks.some(b=>V.key(b.title)===V.key(title)))title=article.title+'（'+n+++'）';book={id:V.uid(),title,createdAt:new Date().toISOString(),kind:'文章词汇',articleId:article.id};state={...state,notebooks:[book,...state.notebooks]};}e.notebookId=book.id;state={...state,entries:[e,...state.entries],lastEntry:e.id};state=V.mark(state,[e.word],true);if(!persist()){state=previous;return;}readerRefresh();toast(`已将 ${range.word} 收录到今日生词本`);
  if(state.settings.autoTranslate)translateEntry(e.id);
}
async function translateEntry(id){
  const e=state.entries.find(e=>e.id===id);if(!e)return;
  translationJobs.get(id)?.abort();const controller=new AbortController();translationJobs.set(id,controller);
  e.translationVersion=(e.translationVersion||0)+1;e.translationStatus='pending';e.translationError='';const snapshot={word:e.word,sentence:e.sentence,translationVersion:e.translationVersion};persist();readerRefresh();
  try{
    const result=await WordTranslation.translate(e.word,e.sentence,{signal:controller.signal,manualMeaning:e.meaningEdited,onLexicon:lexicon=>{const current=state.entries.find(e=>e.id===id);if(WordLexicon.accepts(current,snapshot)){current.lexicon=lexicon;persist();readerRefresh();}}});const current=state.entries.find(e=>e.id===id);
    if(!WordLexicon.accepts(current,snapshot))return;
    if(!current.meaningEdited)current.meaning=result.meaning||current.meaning;current.lexicon=result.lexicon;current.meaningSource=result.meaningSource;current.sentenceTranslation=result.sentenceTranslation;current.translationShortened=result.shortened;current.translationProvider=result.provider;current.translationError=result.error;current.translationStatus=current.meaning&&result.sentenceTranslation?'ready':current.meaning||result.sentenceTranslation?'partial':'error';persist();readerRefresh();
  }catch(error){if(error.name==='AbortError')return;const current=state.entries.find(e=>e.id===id);if(!WordLexicon.accepts(current,snapshot))return;current.lexicon=current.lexicon||{status:'error'};current.translationStatus='error';current.translationError='暂时无法连接翻译服务，记录已保存，可以重试或手动编辑。';persist();readerRefresh();}
  finally{if(translationJobs.get(id)===controller)translationJobs.delete(id);}
}
function uncollectEntry(id){const ids=Array.isArray(id)?id:[id],words=state.entries.filter(e=>ids.includes(e.id)).map(e=>e.word),previous=state;state=V.mark(state,words,false);if(!persist()){state=previous;return;}phraseAnchor=null;nativePhrase=null;document.querySelectorAll('.phrase-start').forEach(n=>n.classList.remove('phrase-start'));if($('#phrase-popover'))$('#phrase-popover').hidden=true;readerRefresh();toast('已移出生词本，来源和学习记录保留');}

function cancelEntryTranslation(id){translationJobs.get(id)?.abort();translationJobs.delete(id);}
function readerDetailExtra(e){if(!e.articleId)return lexicalInfo(e);return `${lexicalInfo(e)}<div class="entry-translation-detail">${translationStatus(e)}${e.sentenceTranslation?`<p class="context-label">原句参考译文${e.translationShortened?'（节选）':''}</p><p>${esc(e.sentenceTranslation)}</p>`:''}${e.translationError?`<p class="translation-error">${esc(e.translationError)}</p>`:''}${state.articles.some(a=>a.id===e.articleId)&&!e.locationStale?`<button class="text-link" data-reader="return" data-id="${e.id}">${icon('book')}回到文章第 ${e.paragraphIndex+1} 段 ${icon('arrow')}</button>`:`<p class="article-removed-note">${state.articles.some(a=>a.id===e.articleId)?'正文已修改，原文位置已变化；保留收录时的原句和释义。':'原文章已删除，已保存的原句和生词记录仍保留。'}</p>`}${e.lexicon?.status==='ready'&&e.translationStatus!=='pending'&&!e.meaningEdited&&e.translationStatus!=='ready'?`<button class="text-link" data-reader="retry" data-id="${e.id}">${icon('repeat')}重试翻译</button>`:''}</div>`;}
function pickedDialog(){dialogState='picked';const a=currentArticle();showDialog('已选生词的词',`<p class="dialog-subtitle">已经存进生词本，可编辑释义或撤销收录。</p><div id="picked-dialog-list">${articleEntries(a).map(pickedCard).join('')||'<p class="muted">点选文章中的词语，它们会出现在这里。</p>'}</div><a class="btn primary" href="#library" data-reader="close-picked">去生词本 ${icon('arrow')}</a>`);}
document.addEventListener('click',ev=>{
  const el=ev.target.closest('[data-reader]');if(!el)return;const action=el.dataset.reader,id=el.dataset.id;
  if(action==='import'){importDialog();return;}
  if(action==='rename'){articleRenameDialog(id);return;}
  if(action==='edit-article'){articleEditDialog(id);return;}
  if(action==='delete-article'){articleDeleteDialog(id);return;}
  if(action==='confirm-delete-article'){deleteSavedArticle(id);return;}

  if(action==='open'){state.activeArticle=id;persist();readerMode='word';phraseAnchor=null;render();return;}
  if(action==='shelf'){state.activeArticle=null;persist();render();return;}
  if(action==='mode'){readerMode=el.dataset.mode;phraseAnchor=null;nativePhrase=null;const y=scrollY;render();scrollTo({top:y,behavior:'instant'});return;}
  if(action==='word'){
    if(getSelection()?.toString().trim()){if(ev.detail>1)getSelection().removeAllRanges();else return;}
    const p=Number(el.dataset.p),start=Number(el.dataset.start),end=Number(el.dataset.end);
    const selected=articleEntries(currentArticle()).filter(e=>!e.locationStale&&e.paragraphIndex===p&&e.rangeStart<=start&&e.rangeEnd>=end);
    if(selected.length&&!phraseAnchor){uncollectEntry(selected.map(e=>e.id));return;}
    if(readerMode==='word')collectRange(p,start,end);
    else if(!phraseAnchor){phraseAnchor={p,start,end};el.classList.add('phrase-start');$('#reader-tip').textContent='已选起始词，再点短语的最后一个词';}
    else {if(phraseAnchor.p!==p){toast('请在同一个段落内选择短语');return;}collectRange(p,Math.min(start,phraseAnchor.start),Math.max(end,phraseAnchor.end));phraseAnchor=null;document.querySelectorAll('.phrase-start').forEach(n=>n.classList.remove('phrase-start'));$('#reader-tip').textContent='依次点选短语的第一个词和最后一个词';}return;
  }
  if(action==='native-collect'){if(nativePhrase){collectRange(nativePhrase.p,nativePhrase.start,nativePhrase.end);getSelection()?.removeAllRanges();nativePhrase=null;$('#phrase-popover').hidden=true;}return;}
  if(action==='dismiss-phrase'){nativePhrase=null;getSelection()?.removeAllRanges();$('#phrase-popover').hidden=true;return;}
  if(action==='picked'){pickedDialog();return;}
  if(action==='close-picked'){closeDialog();return;}
  if(action==='retry'){translateEntry(id);return;}
  if(action==='undo'){uncollectEntry(id);return;}
  if(action==='return'||action==='locate'){const e=state.entries.find(e=>e.id===id);if(!e)return;if(e.locationStale){detail(id);return;}if(!state.articles.some(a=>a.id===e.articleId)){toast('当前学习空间中没有这篇原文章');return;}if($('#modal').open)closeDialog();state.activeArticle=e.articleId;readerFocus={p:e.paragraphIndex};persist();navigate('read');return;}
});
document.addEventListener('keydown',ev=>{if(ev.target.matches?.('.reader-word')&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();ev.target.click();}});
document.addEventListener('pointerup',()=>{
  if(route!=='read')return;
  requestAnimationFrame(()=>{const sel=getSelection();if(!sel?.rangeCount||!sel.toString().trim())return;const range=sel.getRangeAt(0);const startEl=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;const endEl=range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement;const para=startEl.closest?.('p[data-paragraph]');if(!para||endEl.closest?.('p[data-paragraph]')!==para)return;const before=range.cloneRange();before.selectNodeContents(para);before.setEnd(range.startContainer,range.startOffset);const start=before.toString().length;nativePhrase={p:Number(para.dataset.paragraph),start,end:start+range.toString().length};const pop=$('#phrase-popover');if(!pop)return;pop.innerHTML=`<button class="btn primary" data-reader="native-collect">收录「${esc(sel.toString().trim().slice(0,45))}」</button><button class="icon-btn" data-reader="dismiss-phrase" aria-label="关闭选词提示">${icon('close')}</button>`;pop.hidden=false;});
});
document.addEventListener('change',ev=>{if(ev.target.id==='article-file')readArticleFile(ev.target.files[0]);if(ev.target.id==='reader-auto'){state.settings.autoTranslate=ev.target.checked;persist();toast(state.settings.autoTranslate?'新收录的词将自动翻译':'已关闭自动翻译，仍会保存词语和原句');}});
document.addEventListener('input',ev=>{if(ev.target.id==='article-title')articleDraft.title=ev.target.value;if(ev.target.id==='article-text'){articleDraft.text=ev.target.value;articleDraft.pages=[];}});
document.addEventListener('submit',ev=>{if(ev.target.id!=='article-form')return;ev.preventDefault();captureArticleDraft();if(articleDraft.busy)return;if(!/[A-Za-z]{2}/.test(articleDraft.text)){$('#article-error').textContent='请先上传文章，或粘贴英文正文。';return;}try{if(!saveArticle(articleDraft)){$('#article-error').textContent='文章尚未保存，请保留正文并重试。';return;}}catch(error){$('#article-error').textContent=error.message;return;}articleDraft={title:'',text:'',pages:[],fileName:'',kind:'粘贴文本',error:'',busy:false};closeDialog();navigate('read');toast('文章已导入');});
