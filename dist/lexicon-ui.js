'use strict';
function lexicalInfo(e,compact=false){
  const d=e.lexicon;
  let body='';
  if(d?.status==='ready'){
    body=`<div class="lexical-pos">${d.parts.map(p=>`<span>${esc(WordLexicon.posNames[p]||p)}</span>`).join('')}</div>${d.inflected?`<p class="lexical-base">词形还原：<strong>${esc(d.headword)}</strong><small>${esc(d.inflection)}</small></p>`:''}<div class="lexical-section"><h4>常见词形</h4>${d.forms.length?`<div class="lexical-forms">${d.forms.map(f=>`<span><small>${esc(f.label)}</small><b>${esc(f.word)}</b></span>`).join('')}</div>`:'<p class="lexical-muted">词典未提供词形变化。</p>'}</div>`;
  }else body=`<p class="lexical-muted">${e.translationStatus==='pending'&&!d?'正在查询词性与词形…':d?.status==='missing'?'暂未找到这个词或短语的词性、词形资料。':d?.status==='error'?'词典暂时无法连接，可稍后重试。':'词性、词形与词典例句待补充。'}</p>`;
  if(compact&&e.sentence)body+=`<div class="lexical-example"><h4>原文例句</h4><p lang="en">${sentenceHTML(e)}</p>${e.sentenceTranslation?`<p class="lexical-zh">${esc(e.sentenceTranslation)}${e.translationShortened?'（节选译文）':''}</p>`:''}</div>`;
  if(d?.status==='ready')body+=`<details class="lexical-more" ${compact?'':'open'}><summary>词典释义与例句${d.examples.length?' · '+d.examples.length:''}</summary><p class="lexical-muted">以下为词典参考义项，请结合原文核对。</p><p class="lexical-definition" lang="en">${esc(d.definition)}</p>${d.examples.length?d.examples.map(x=>`<div class="lexical-example"><h4>词典例句</h4><p lang="en">${esc(x.text)}</p>${x.translation?`<p class="lexical-zh">${esc(x.translation)}</p>`:''}</div>`).join(''):'<p class="lexical-muted">这一义项暂无词典例句，可参考已保存的原文。</p>'}<p class="lexical-credit">词典：<a href="https://freedictionaryapi.com/" target="_blank" rel="noopener noreferrer">FreeDictionaryAPI</a> · ${d.sourceWords.map(w=>`<a href="https://en.wiktionary.org/wiki/${encodeURIComponent(w)}" target="_blank" rel="noopener noreferrer">Wiktionary</a>`).join(' / ')} · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a><br>内容经筛选与整理；中文为机器翻译参考。</p></details>`;
  if(e.translationStatus!=='pending'&&(!d||d.status!=='ready'))body+=`<button class="text-link lexical-retry" data-reader="retry" data-id="${e.id}">补充词性、词形和例句</button>`;
  return `<div class="lexical-info">${body}</div>`;
}
