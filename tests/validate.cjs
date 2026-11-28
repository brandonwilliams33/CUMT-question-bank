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
assert.equal(banks.business.length,288);assert.equal(banks.physics.length,388);
assert(banks.physics.every(q=>typeof q.explain==='string'&&q.explain.trim()),'Every physics question needs a non-empty explain');
assert.equal(new Set(banks.physics.map(q=>q.chapter)).size,88);
assert.equal(new Set(banks.business.filter(q=>q.id.startsWith('business-fd-')).map(q=>q.chapter)).size,63);
for(const [type,count] of [['single',182],['judge',106]])assert.equal(banks.business.filter(q=>q.id.startsWith('business-fd-')&&q.type===type).length,count);
for(const [type,count] of [['single',190],['multiple',38],['judge',160]])assert.equal(banks.physics.filter(q=>q.type===type).length,count);
for(const id of ['business-001','business-002','business-005','business-006'])assert.equal(banks.business.find(q=>q.id===id),undefined);
assert.deepEqual(banks.physics.slice(0,7).map(q=>q.id),['physics-001','physics-002','physics-003','physics-004','physics-005','physics-006','physics-007']);
assert.deepEqual(banks.physics.slice(0,7).map(q=>q.answer),[['D'],['D'],['B','C','D'],['B'],['A'],['D'],['A','B','D']]);
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../sources/import-full-20261024.json')));
assert.equal(manifest.questions.length,manifest.coverage.business.activeQuestions+manifest.coverage.physics.providedDocumentQuestions);
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
function extractFunctions(source,names){
 const bodies=[];
 for(const name of names){
  const start=source.indexOf('function '+name+'(');
  assert(start>=0,name+' missing from app.js');
  let i=source.indexOf('{',start),depth=0;
  for(;i<source.length;i++){
   const c=source[i];
   if(c==='{')depth++;
   else if(c==='}'){depth--;if(!depth){i++;break}}
  }
  bodies.push(source.slice(start,i));
 }
 return new Function(bodies.join('\n')+'\nreturn {'+names.join(',')+'};')();
}
const appSource=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const {judgeMark,judgeSplit,matchType,filterRecord}=extractFunctions(appSource,['judgeMark','judgeSplit','matchType','filterRecord']);
const physicsJudges=banks.physics.filter(q=>q.type==='judge');
assert.equal(physicsJudges.length,160);
assert(physicsJudges.every(q=>q.options.A==='正确'&&q.options.B==='错误'&&q.answer.length===1));
assert.equal(physicsJudges.filter(q=>judgeMark(q)==='right').length,100);
assert.equal(physicsJudges.filter(q=>judgeMark(q)==='wrong').length,60);
assert.equal(physicsJudges.filter(q=>q.answer[0]==='A'&&judgeMark(q)!=='right').length,0);
assert.equal(banks.physics.filter(q=>matchType(q,'single','')).length,190);
assert.equal(banks.physics.filter(q=>matchType(q,'single','right')).length,190,'A saved 对/错 choice must not narrow 单选题');
assert.equal(banks.physics.filter(q=>matchType(q,'multiple','')).length,38);
assert.equal(banks.physics.filter(q=>matchType(q,'judge','')).length,160);
assert.equal(banks.physics.filter(q=>matchType(q,'judge','right')).length,100);
assert.equal(banks.physics.filter(q=>matchType(q,'judge','wrong')).length,60);
assert(banks.physics.filter(q=>matchType(q,'judge','right')).every(q=>q.type==='judge'&&q.answer[0]==='A'));
assert(banks.physics.filter(q=>matchType(q,'judge','wrong')).every(q=>q.type==='judge'&&q.answer[0]==='B'));
for(const c of courses){
 const split=judgeSplit(banks[c]);
 assert.equal(split.judge,banks[c].filter(q=>q.type==='judge').length);
 assert.equal(split.right+split.wrong,split.judge,c+' 判断题 should all be 正确/错误');
 assert.equal(split.enabled,split.judge>0);
}
const singlePref=filterRecord('sequence','物理是文化','single','伽利略',false,'right');
assert.deepEqual(singlePref,{mode:'sequence',chapter:'物理是文化',type:'single',search:'伽利略',unanswered:false});
assert.equal(Object.hasOwn(singlePref,'judgeSide'),false);
const judgePref=filterRecord('random','','judge','',true,'');
assert.equal(judgePref.type,'judge');
assert.equal(Object.hasOwn(judgePref,'judgeSide'),false,'Missing 对/错 means all 判断题');
assert.equal(filterRecord('sequence','','judge','',false,'right').judgeSide,'right');
assert.equal(filterRecord('sequence','','judge','',false,'wrong').judgeSide,'wrong');
assert.equal(filterRecord('sequence','','judge-right','',false,'right').type,'');
assert.equal(filterRecord('sequence','','judge','',false,'A').judgeSide,undefined);
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert(html.includes('app.js?v=20261128-judgefilter'));
assert(html.includes('style.css?v=20261128-judgefilter'));
assert(html.includes('engine.js?v=20261024-full2'));
assert(appSource.includes("const PREF_KEY='cumt-practice-preferences-v1'"));
assert(appSource.includes("fetch('data/'+c.id+'.json'+(c.id==='physics'?'?v=20261128-physics388':'')"));
assert(!appSource.includes('localStorage.removeItem'));
assert.equal(E.KEY,'cumt-history-v1');
console.log('PASS',qs.length,'questions across',courses.length,'courses; scoring, records, backup validation, shuffle, new course session persistence');
