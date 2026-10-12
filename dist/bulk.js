'use strict';
let bulkMode=false;
const bulkSelected=new Set();
let bulkPending=[];
function bulkPrune(entries){const visible=new Set(entries.map(e=>e.id));for(const id of bulkSelected)if(!visible.has(id))bulkSelected.delete(id);}
function librarySourceOptions(){const groups=sourceGroups();if(sourceFilter&&!groups.some(g=>g.name===sourceFilter))groups.push({name:sourceFilter});return groups;}
function bulkControls(entries){
  bulkPrune(entries);
  return `<div class="bulk-bar" role="region" aria-label="批量管理工具"><label class="bulk-select-all"><input id="bulk-all" type="checkbox" ${!entries.length?'disabled':''}><span>全选当前结果 <small>(${entries.length} 条)</small></span></label><span class="bulk-count" id="bulk-count" role="status">已选 ${bulkSelected.size} 条</span><button class="btn danger" id="bulk-delete" data-bulk="delete" ${!bulkSelected.size?'disabled':''}>${icon('trash')}删除所选</button><p class="bulk-hint">仅选择当前筛选结果；切换筛选会取消隐藏记录的选择。</p></div>`;
}
function bulkSync(){
  if(route!=='library'||!bulkMode)return;
  const entries=filteredEntries();bulkPrune(entries);
  const all=$('#bulk-all');if(all){all.checked=entries.length>0&&bulkSelected.size===entries.length;all.indeterminate=bulkSelected.size>0&&bulkSelected.size<entries.length;all.disabled=!entries.length;}
  if($('#bulk-count'))$('#bulk-count').textContent=`已选 ${bulkSelected.size} 条`;
  if($('#bulk-delete'))$('#bulk-delete').disabled=!bulkSelected.size;
  document.querySelectorAll('[data-bulk-entry]').forEach(input=>{const selected=bulkSelected.has(input.dataset.bulkEntry);input.checked=selected;input.closest('.word-card').classList.toggle('bulk-selected',selected);});
}
function bulkAfterRender(){
  if(route!=='library'){bulkMode=false;bulkSelected.clear();}
  document.body.classList.toggle('bulk-managing',route==='library'&&bulkMode);bulkSync();
}
function bulkConfirm(){
  bulkPrune(filteredEntries());const entries=state.entries.filter(e=>bulkSelected.has(e.id));if(!entries.length)return;
  bulkPending=entries.map(e=>e.id);dialogState='bulk-delete';
  showDialog(`删除所选的 ${entries.length} 条记录？`,`<p class="dialog-subtitle">将删除以下词条及对应的释义、笔记和回顾进度。文章原文会保留，同一个词在其他原句中的记录也会保留。</p><div class="bulk-preview">${entries.map(e=>`<div><strong>${esc(e.word)}</strong><span>${esc(e.source)} · ${shortDate(e.created)}</span><p>${esc(e.sentence)||'未保存原句'}</p></div>`).join('')}</div><p class="bulk-delete-note">删除后无法撤销，请确认所选记录。</p><div class="bulk-confirm-actions"><button class="btn danger" data-bulk="confirm">${icon('trash')}确认删除 ${entries.length} 条</button></div>`);
}
function deleteRecordIds(ids){
  const result=C.removeEntries(state.entries,ids,session);if(!result.removed.length)return 0;
  const previousEntries=state.entries,previousLast=state.lastEntry,previousSession=session;
  state.entries=result.entries;session=result.session;
  if(result.removed.some(e=>e.id===state.lastEntry))state.lastEntry=null;
  if(!persist()){state.entries=previousEntries;state.lastEntry=previousLast;session=previousSession;return null;}
  result.removed.forEach(e=>{cancelEntryTranslation(e.id);bulkSelected.delete(e.id);});
  return result.removed.length;
}
document.addEventListener('click',ev=>{
  const el=ev.target.closest('[data-bulk]');if(!el)return;
  if(el.dataset.bulk==='toggle'){bulkMode=!bulkMode;bulkSelected.clear();render();return;}
  if(el.dataset.bulk==='delete'){bulkConfirm();return;}
  if(el.dataset.bulk==='confirm'){
    if(dialogState!=='bulk-delete')return;
    const count=deleteRecordIds(bulkPending);if(count===null)return;
    bulkPending=[];closeDialog();render();toast(count?`已删除 ${count} 条阅读记录`:'这些记录已被移除');
  }
});
document.addEventListener('change',ev=>{
  if(!bulkMode||route!=='library')return;
  if(ev.target.id==='bulk-all'){const entries=filteredEntries();bulkPrune(entries);entries.forEach(e=>ev.target.checked?bulkSelected.add(e.id):bulkSelected.delete(e.id));bulkSync();}
  if(ev.target.dataset.bulkEntry){const id=ev.target.dataset.bulkEntry;ev.target.checked?bulkSelected.add(id):bulkSelected.delete(id);bulkSync();}
});
