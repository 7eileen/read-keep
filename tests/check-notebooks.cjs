const assert = require('node:assert/strict');
const C = require('../dist/core.js');
const CC = require('../dist/cloud-core.js');
const RC = require('../dist/reader-core.js');

const date = '2026-10-13';
const rows = [{word:'retain',meaning:'保留',sentence:'Soil can retain water.'},{word:'adapt',meaning:'适应'}];
const batchA = {id:'upload-a',title:'Reading notes',createdAt:'2026-10-13T08:00:00.000Z'};
const batchB = {id:'upload-b',title:'Reading notes',createdAt:'2026-10-13T09:00:00.000Z'};
const first = C.addEntries([], [...rows, rows[0]], 'Reading notes', date, batchA);
assert.equal(first.added,2,'Duplicates inside one upload are collapsed');
const second = C.addEntries(first.entries, rows, 'Reading notes', date, batchB);
assert.equal(second.added,2,'A separate upload with identical words stays a separate notebook');
assert.equal(C.addEntries(second.entries, rows, 'Reading notes', date, batchB).added,0,'Retrying the same batch does not duplicate entries');
assert.deepEqual(first.entries[0].batch,batchA,'Batch identity and upload time are persisted on entries');

const state = {
  ...CC.empty(),
  articles:[
    {id:'article-a',title:'Same title',created:'2026-10-11',importedAt:'2026-10-11T01:00:00.000Z',kind:'PDF',paragraphs:[]},
    {id:'article-b',title:'Same title',created:date,importedAt:'2026-10-13T10:00:00.000Z',kind:'TXT',paragraphs:[]},
    {id:'article-empty',title:'No words yet',created:date,importedAt:'2026-10-13T11:00:00.000Z',kind:'TXT',paragraphs:[]}
  ],
  entries:[...second.entries,
    ...Array.from({length:9},(_,i)=>({id:'article-word-'+i,word:'word'+i,articleId:'article-a',source:'Same title',created:i%2?date:'2026-10-11',due:date})),
    {id:'other-article',word:'retain',articleId:'article-b',source:'Same title',created:date,due:date},
    {id:'old-a',word:'sustain',source:'Old notes',created:'2026-10-09',due:date},
    {id:'old-b',word:'mitigate',source:'Old notes',created:'2026-10-09',due:date},
    {id:'old-c',word:'sustain',source:'Old notes',created:'2026-10-10',due:date}
  ]
};
const before = CC.copy(state);
const books = C.notebooks(state);
assert.equal(books.length,7,'Three articles, two explicit batches and two legacy dates remain separate');
assert.equal(books[0].id,'article:article-empty','Newest upload sorts first even before a word is collected');
assert.equal(books[0].entries.length,0);
assert.equal(books.find(b=>b.id==='article:article-a').entries.length,9,'A notebook exposes all vocabulary across collection dates, not a six-word preview');
assert.deepEqual(books.find(b=>b.id==='article:article-b').entries.map(e=>e.id),['other-article'],'Same title never mixes two uploaded articles');
assert.equal(books.find(b=>b.id==='batch:upload-a').entries.length,2);
assert.equal(books.find(b=>b.id==='batch:upload-b').entries.length,2);
assert.equal(books.filter(b=>b.legacy).length,2);
assert.deepEqual(state,before,'Grouping does not migrate or mutate existing records');

const renamed = RC.renameArticle(state,'article-a','Updated article');
assert.equal(C.notebooks(renamed).find(b=>b.id==='article:article-a').title,'Updated article');
const deleted = RC.removeArticle(renamed,'article-a');
assert.equal(C.notebooks(deleted).find(b=>b.id==='article:article-a').entries.length,9,'Removing article text retains its vocabulary notebook');
assert.equal(C.notebooks(deleted).find(b=>b.id==='article:article-a').title,'Updated article');
const edited = CC.copy(state);
edited.entries.find(e=>e.batch?.id==='upload-a').source='A single edited source';
assert.equal(C.notebooks(edited).find(b=>b.id==='batch:upload-a').title,'Reading notes','Editing one word does not rename or split the upload');

const saved = {articles:[],entries:[],preferences:[]};
for(const change of CC.changes(CC.empty(),state,{})) saved[change.table].push({id:change.id,payload:change.data,version:1});
const restored = CC.decode(JSON.parse(JSON.stringify(saved))).state;
assert.deepEqual(C.notebooks(restored).map(b=>[b.id,b.entries.map(e=>e.id).sort()]),books.map(b=>[b.id,b.entries.map(e=>e.id).sort()]),'Batch membership survives cloud payload serialization and device reload');
assert.equal(C.notebooks(CC.migrate(CC.empty(),state)).length,7,'Guest migration preserves notebooks');
assert.equal(C.notebooks(CC.empty()).length,0,'An empty other account exposes no notebook from the current account');
assert.equal(C.notebooks({entries:C.seed(date),articles:[]}).length,3,'Existing demo data has three readable legacy notebooks');
console.log('PASS: upload batch identity, independent same-name uploads, full vocabulary, legacy grouping, article edits/removal and cloud round-trip.');
