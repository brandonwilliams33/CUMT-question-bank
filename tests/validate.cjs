const assert=require('node:assert/strict'),E=require('../engine.js'),fs=require('node:fs'),path=require('node:path');
const courses=['party','china','reform','communication'];
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
console.log('PASS',qs.length,'questions across',courses.length,'courses; scoring, records, backup validation, shuffle, new course session persistence');
