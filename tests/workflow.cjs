// Exercise real app actions with a minimal browser adapter; no extra test dependencies.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Engine=require('../engine.js'),storage=new Map(),elements=new Map(),listeners={};
const element=()=>({textContent:'',innerHTML:'',value:'',checked:false,disabled:false,open:false,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},focus(){},close(){},showModal(){}});
const doc={querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s)},querySelectorAll(){return []},addEventListener(k,fn){listeners[k]=fn},body:{classList:{add(){},remove(){},toggle(){}}}};
let scrollCalls=0;
const ctx=vm.createContext({Engine,document:doc,window:{scrollTo(){scrollCalls++},addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},setInterval:()=>1,clearInterval(){},console,Blob,URL});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/init\(\);\s*$/,''),ctx);
const run=s=>vm.runInContext(s,ctx),get=s=>JSON.parse(JSON.stringify(run(s)));
run(`revealFeedback=()=>{};drawQuestion=()=>{};mountPractice=()=>{};drawCard=()=>{};closeCard=()=>{};bindHeading=()=>{};pageView=()=>{};
bank.communication=[
 {id:'communication-test-single',type:'single',stem:'single',options:{A:'a',B:'b'},answer:['B']},
 {id:'communication-test-multi',type:'multiple',stem:'multi',options:{A:'a',B:'b',C:'c'},answer:['A','C']},
 {id:'communication-test-judge',type:'judge',stem:'judge',options:{A:'正确',B:'错误'},answer:['A']}
];course=courses.find(c=>c.id==='communication');allIds=new Set(bank.communication.map(q=>q.id));`);
function reset(kind='sequence',index=0){run(`state=E.blank();prefs.quick=true;beginRun(bank.communication.map(q=>q.id),'${kind}');run.index=${index};persistRun()`)}
reset();run(`choose('B');submit();choose('A')`);assert.equal(get(`state.answers[run.ids[0]].attempts`),1);assert.equal(get(`run.submitted[run.ids[0]].correct`),true);
reset();run(`prefs.quick=false;choose('B')`);assert.equal(get('Object.keys(state.answers).length'),0);run('next()');assert.equal(get('run.index'),0);assert.equal(get('Object.keys(state.answers).length'),1);scrollCalls=0;run('next()');assert.equal(get('run.index'),1);assert.equal(scrollCalls,0,'Changing question must not scroll the page');
reset('sequence',1);run(`choose('A');choose('C')`);assert.equal(get('Object.keys(state.answers).length'),0);run('next()');assert.equal(get('run.index'),1);assert.equal(get('run.submitted[run.ids[1]].correct'),true);run('next()');assert.equal(get('run.index'),2);
reset('sequence',1);run(`choose('A');submit()`);assert.equal(get('run.submitted[run.ids[1]].correct'),false);
reset('sequence',2);run(`choose('A')`);assert.equal(get('run.submitted[run.ids[2]].correct'),true);
// Every mode keeps its own position. Legacy single-slot backups are upgraded on read.
reset();run(`run.index=2;persistRun();beginRun(bank.communication.map(q=>q.id),'exam');choose('B')`);
assert.equal(get(`state.sessions.communication.index`),2);assert.equal(get(`state.sessions['communication:exam'].submitted[run.ids[0]].answer`)[0],'B');assert.equal(get('Object.keys(state.answers).length'),0);
let persisted=JSON.parse(storage.get(Engine.KEY));assert.equal(persisted.sessions['communication:exam'].submitted['communication-test-single'].answer[0],'B');
run(`choose('A')`);assert.deepEqual(get(`run.submitted[run.ids[0]].answer`),['A']);
run(`jump(1);choose('A');choose('C');choose('A');choose('C')`);assert.equal(get(`Object.keys(run.submitted).length`),1,'Clearing a multiple choice removes its saved answer');
run('finishExam(false)');assert.equal(get('run.finished'),true);assert.equal(get('state.exams.length'),1);assert.equal(get('state.exams[0].total'),3);assert.equal(get('state.exams[0].correct'),0);assert.equal(get('state.sessions.communication.index'),2);assert.equal(get(`!!state.sessions['communication:exam']`),false);run('finishExam(false)');assert.equal(get('state.exams.length'),1,'Submission must be idempotent');
// The deadline is checked before a late answer can be accepted.
reset('exam');run(`choose('B');run.deadline=Date.now()-1;choose('A')`);assert.equal(get('run.finished'),true);assert.equal(get('state.exams[0].correct'),1);assert.deepEqual(get(`state.answers['communication-test-single'].selected`),['B']);
reset('exam');run(`run.drafts[run.ids[0]]=['B'];run.submitted={};persistRun();mode='exam';resume()`);assert.deepEqual(get(`run.submitted[run.ids[0]].answer`),['B'],'Selected answers from older tests survive resume');
const ids=new Set(['communication-test-single']);
const legacy=Engine.blank();legacy.sessions.communication={mode:'exam',ids:[...ids],index:0,started:1,deadline:9999999999999,submitted:{},drafts:{}};
const migrated=Engine.validate(legacy,ids);assert(migrated.sessions['communication:exam']);assert(!migrated.sessions.communication);
const backup=Engine.blank();backup.sessions.communication={mode:'sequence',ids:[...ids],index:0,started:1,submitted:{},drafts:{}};backup.sessions['communication:exam']={...legacy.sessions.communication};
assert.equal(Object.keys(Engine.validate(backup,ids).sessions).length,2);
console.log('PASS workflow: quick/manual answers, multiple choice, no page scroll, independent progress, instant test saving, deadline enforcement, idempotent grading, legacy backup migration');
