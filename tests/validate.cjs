const assert=require('node:assert/strict'),E=require('../engine.js'),fs=require('node:fs'),path=require('node:path');
const courses=['party','china','reform','communication','business','physics'];
const banks=Object.fromEntries(courses.map(c=>[c,JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+c+'.json')))]));
const qs=Object.values(banks).flat(),ids=new Set(qs.map(q=>q.id));
assert.equal(ids.size,qs.length,'Question IDs must be globally unique');
for(const c of courses)for(const q of banks[c]){
  assert(q.id.startsWith(c+'-'));assert(q.chapter.trim());assert(q.stem.trim());
  assert(['single','multiple','judge'].includes(q.type));assert(Object.keys(q.options).length>=2);
  assert(Object.values(q.options).every(v=>typeof v==='string'&&v.trim()));
  assert(q.answer.length>0);assert.equal(new Set(q.answer).size,q.answer.length);
  assert(q.answer.every(a=>a in q.options));assert(q.type!=='single'||q.answer.length===1);
  assert(q.type!=='judge'||(Object.keys(q.options).length===2&&q.answer.length===1));
}
let q=qs.find(q=>q.type==='multiple'),s=E.blank();assert(E.correct(q,[...q.answer].reverse()));assert(!E.correct(q,[]));
E.record(s,q,[]);assert.equal(s.answers[q.id].lastCorrect,false);E.record(s,q,q.answer);assert.equal(s.answers[q.id].lastCorrect,true);assert.equal(s.answers[q.id].attempts,2);assert.equal(s.answers[q.id].correct,1);
assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s)),ids),s);assert.throws(()=>E.validate({version:9},ids));
s.sessions.party={ids:['reform-fake'],mode:'exam',index:0};assert.equal(Object.keys(E.validate(s,ids).sessions).length,0);
assert.equal(new Set(E.shuffle(qs).map(q=>q.id)).size,qs.length);
const communication=banks.communication;
assert.equal(communication.length,87);assert.equal(new Set(communication.map(q=>q.chapter)).size,25);
for(const [type,count] of [['single',23],['multiple',4],['judge',60]])assert.equal(communication.filter(q=>q.type===type).length,count);
for(const mode of ['sequence','random','wrong','star','read','exam']){
  const q=communication.find(q=>q.type==='multiple'),backup=E.blank();
  E.record(backup,q,q.answer);backup.stars=[q.id];
  backup.sessions[mode==='sequence'?'communication':'communication:'+mode]={mode,ids:[q.id],index:0,started:Date.now(),deadline:mode==='exam'?Date.now()+1800000:null,submitted:{[q.id]:{answer:q.answer,correct:true}},drafts:{[q.id]:q.answer}};
  const restored=E.validate(JSON.parse(JSON.stringify(backup)),ids);
  assert.deepEqual(restored,backup,`Communication ${mode} session survives reload and backup import`);
}
const multi=communication.find(q=>q.type==='multiple');assert(!E.correct(multi,multi.answer.slice(1)));
for(const q of communication.filter(q=>q.type==='judge')){assert(E.correct(q,q.answer));assert(!E.correct(q,[q.answer[0]==='A'?'B':'A']))}
// All new source question marks have been cross-checked against the original documents.
assert.equal(banks.business.length,385);assert.equal(banks.physics.length,388);
assert.equal(new Set(banks.physics.map(q=>q.chapter)).size,88);
assert.equal(new Set(banks.business.filter(q=>q.id.startsWith('business-fd-')).map(q=>q.chapter)).size,63);
for(const [type,count] of [['single',241],['judge',140]])assert.equal(banks.business.filter(q=>q.id.startsWith('business-fd-')&&q.type===type).length,count);
for(const [type,count] of [['single',190],['multiple',38],['judge',160]])assert.equal(banks.physics.filter(q=>q.type===type).length,count);
for(const [id,answer] of [['business-001',['D']],['business-002',['B']],['business-005',['A']],['business-006',['B']]])assert.deepEqual(banks.business.find(q=>q.id===id).answer,answer);
assert.deepEqual(banks.physics.slice(0,7).map(q=>q.id),['physics-001','physics-002','physics-003','physics-004','physics-005','physics-006','physics-007']);
assert.deepEqual(banks.physics.slice(0,7).map(q=>q.answer),[['D'],['D'],['B','C','D'],['B'],['A'],['D'],['A','B','D']]);
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../sources/import-full-20261024.json')));
assert.equal(manifest.questions.length,banks.business.length+banks.physics.length);
assert.equal(manifest.crosscheck.business.exactIndependentMatches,381);
assert.equal(manifest.crosscheck.physics.contentAndAnswerMatches,388);
assert(manifest.coverage.business.allProvidedQuestionsIncluded&&manifest.coverage.physics.allProvidedQuestionsIncluded);
const crypto=require('node:crypto');
for(const asset of manifest.files){
 const bytes=fs.readFileSync(path.join(__dirname,'..',asset.path));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256,'Source file changed: '+asset.path);
}
for(const [course,expected] of Object.entries(manifest.baseBankHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../data/'+course+'.json'))).digest('hex'),expected,'Existing bank changed: '+course);
for(const c of ['business','physics']){
 const signatures=new Set();
 for(const q of banks[c]){
  const sourcePath=q.sourceDocument||q.sourceImage;
  assert(sourcePath.startsWith('sources/'+c+'/'));
  assert(fs.existsSync(path.join(__dirname,'..',sourcePath.split('#')[0])));
  const record=manifest.questions.find(r=>r.id===q.id);assert(record);
  assert.deepEqual(record.mappedAnswer,q.answer);assert.equal(record.source,sourcePath);
  assert(!/[（(][A-H]{1,4}[）)]/.test(q.stem),'Reference answer leaked in stem');
  assert(!/此题参考答案|本题是单项选择题|本题是多项选择题/.test(q.stem),'Source formatting leaked into question');
  const signature=JSON.stringify([q.chapter,q.stem,q.options,q.answer]);assert(!signatures.has(signature),'Exact duplicate: '+q.id);signatures.add(signature);
 }
 for(const mode of ['sequence','random','wrong','star','read','exam']){
  const q=banks[c][0],backup=E.blank(),key=mode==='sequence'?c:c+':'+mode;
  E.record(backup,q,q.answer);backup.stars=[q.id];
  backup.sessions[key]={mode,ids:banks[c].map(q=>q.id),index:0,started:Date.now(),deadline:mode==='exam'?Date.now()+1800000:null,submitted:{[q.id]:{answer:q.answer,correct:true}},drafts:{[q.id]:q.answer}};
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(backup)),ids),backup,`${c} ${mode} progress must survive restore`);
 }
}
console.log('PASS',qs.length,'questions across',courses.length,'courses; scoring, records, backup validation, shuffle, new course session persistence');
