(function(root){'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.WordJournal;
 function parse(text,format='txt'){
   text=String(text).replace(/^\uFEFF/,'');if(text.length>500000)throw new Error('一次最多导入 500,000 字符。');
   if(format!=='csv'){const rows=C.parseBatch(text);if(rows.length>1000)throw new Error('每册最多导入 1,000 条。');return rows;}
   const lines=[];let row=[],field='',quoted=false;
   for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||!field)quoted=!quoted;else throw new Error('CSV 引号格式错误。');}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))lines.push(row);row=[];field='';}else field+=c;}
   if(quoted)throw new Error('CSV 引号未闭合。');row.push(field);if(row.some(x=>x.trim()))lines.push(row);
   if(/^(word|词汇|单词)$/i.test(lines[0]?.[0].trim()||''))lines.shift();
   if(lines.length>1000)throw new Error('每册最多导入 1,000 条。');
   if(lines.some(r=>r.length>3))throw new Error('CSV 依次填写词汇、释义、原句三列；含逗号的内容请用引号包住。');
   return lines.map(r=>({word:r[0].trim(),meaning:(r[1]||'').trim(),sentence:(r[2]||'').trim()}));
 }
 function cell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function csv(entries){return '\uFEFF'+[['词汇','释义','原句','来源','词汇册','笔记'],...entries.map(e=>[e.word,e.meaning,e.sentence,e.source,e.notebookTitle,e.note])].map(r=>r.map(cell).join(',')).join('\r\n');}
 const api={parse,csv};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ImportCore=api;
})(globalThis);
