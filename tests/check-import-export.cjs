const assert=require('node:assert/strict'),I=require('../dist/import-core.js');
assert.deepEqual(I.parse('word,meaning,sentence\r\ncover,"覆盖,遮盖","Trees cover\nthe hill."','csv'),[{word:'cover',meaning:'覆盖,遮盖',sentence:'Trees cover\nthe hill.'}]);
assert.equal(I.parse('\uFEFFword,meaning\na,"A ""quote"""','csv')[0].meaning,'A "quote"');
assert.equal(I.parse('urban | 城市的\ncover | 覆盖','txt').length,2);
assert.throws(()=>I.parse('a,"unfinished','csv'),/引号/);
assert.throws(()=>I.parse('a,b,c,d','csv'),/列/);
assert.ok(I.csv([{word:'=1+1',meaning:'safe',sentence:'@foo',source:'a,b'}]).includes("'=1+1"));
console.log('import/export: CSV quoting, BOM, multiline, TXT, malformed input and formula escaping passed');
