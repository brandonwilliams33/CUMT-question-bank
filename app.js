'use strict';
const courses=[{id:'party',name:'党史',desc:'学习通课后内容',color:'#954951',mark:'党',detail:'题库来源：学习通课后内容。原扫描件标注的是“我的答案”，未逐题核实正确性；文字识别可能存在误差。可在题目下打开原文核对，欢迎纠错。'},{id:'china',name:'新中国史',desc:'学习通课后内容',color:'#194e67',mark:'国',detail:'题库来源：学习通课后内容（吉林大学课程）。答案沿用所提供材料，题目中的年份和政策表述以原课程语境为准。'},{id:'reform',name:'改革开放史',desc:'综合学习通、智慧马院题库',color:'#36756d',mark:'改',detail:'题库来源：综合学习通、智慧马院题库整理。答案沿用所提供材料，欢迎反馈题目或答案问题。'},{id:'communication',name:'有效沟通技巧',desc:'章节测试 · 单选、多选与判断',color:'#94652e',mark:'沟',detail:'题库来源：用户提供的《有效沟通技巧》章节测试文档，涵盖六个单元。参考答案沿用原材料，未独立核验；原文未提供详细解析，欢迎纠错。'}];
const app=document.querySelector('#app'),E=Engine;let state=E.blank(),bank={},allIds=new Set(),course=null,run=null,mode='sequence',timer=null,toastTimer,rawBackup=null;
const PREF_KEY='cumt-practice-preferences-v1';
let prefs={quick:true,filters:{}};
try{const saved=JSON.parse(localStorage.getItem(PREF_KEY));if(saved&&typeof saved==='object'){prefs.quick=saved.quick!==false;prefs.filters=saved.filters&&typeof saved.filters==='object'?saved.filters:{}}}catch(e){}
function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs))}catch(e){}}
function sessionKey(id,kind){return kind==='sequence'?id:id+':'+kind}
function savedSession(id,kind){return state.sessions[sessionKey(id,kind)]}
function latestSession(id){return Object.values(state.sessions).filter(r=>r.ids?.[0]?.startsWith(id+'-')).sort((a,b)=>(b.updated||b.started)-(a.updated||a.started))[0]}
function pageView(){document.body.classList.remove('practicing');window.scrollTo(0,0)}
function scrollQuestion(){const el=document.querySelector('#questionScroll');if(el)el.scrollTop=0}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={single:'单选题',multiple:'多选题',judge:'判断题'},modeNames={sequence:'顺序练习',random:'随机练习',wrong:'错题复习',star:'收藏练习',read:'背题模式',exam:'模拟测试'};
function toast(t){const el=document.querySelector('#toast');el.textContent=t;el.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.display='none',3500)}
function save(){if(rawBackup!==null){toast('旧记录无法读取，暂未覆盖。请在记录管理中导出原始记录，再导入有效备份或清空记录。');return}try{localStorage.setItem(E.KEY,JSON.stringify(state));document.querySelector('#saveStatus').textContent='本机记录已保存'}catch(e){document.querySelector('#saveStatus').textContent='记录保存失败';toast('浏览器无法保存记录，请导出备份，检查存储空间或浏览器设置。')}}
function applyTheme(){document.body.classList.toggle('dark',state.theme==='dark');document.querySelector('#theme').textContent=state.theme==='dark'?'浅色':'深色'}
function summary(qs){let answered=qs.filter(q=>state.answers[q.id]),right=answered.filter(q=>state.answers[q.id].lastCorrect),wrong=answered.filter(q=>!state.answers[q.id].lastCorrect),stars=qs.filter(q=>state.stars.includes(q.id));return {done:answered.length,right:right.length,wrong:wrong.length,stars:stars.length,rate:answered.length?Math.round(right.length/answered.length*100):0}}
function home(){pageView();stopTimer();course=null;run=null;let qs=Object.values(bank).flat(),s=summary(qs),day=new Date().toLocaleDateString('sv-SE');app.innerHTML=`<div class="intro"><div><h1>把每一道题，学扎实。</h1><p>四门课程，一处练习。接着上次的位置，开始今天的学习。</p></div><div class="study-note">进度跟着这台设备走。<br>每次作答自动保存，随时回来继续。</div></div><div class="stats"><div class="stat"><b>${s.done}</b><span>已练习 / ${qs.length} 题</span></div><div class="stat"><b>${s.rate}%</b><span>最近作答正确率</span></div><div class="stat"><b>${s.wrong}</b><span>待复习错题</span></div><div class="stat"><b>${state.days[day]||0}</b><span>今日作答次数</span></div></div><div class="section-head"><h2>选择一门课程</h2><span class="muted">学习进度自动保存</span></div><div class="courses">${courses.map(c=>{let ss=summary(bank[c.id]);return `<article class="course-card" style="--course:${c.color}"><div class="course-code"><span>${bank[c.id].length} 题 · ${new Set(bank[c.id].map(q=>q.chapter)).size} 个章节</span><span class="book">${c.mark}</span></div><h3>${c.name}</h3><p class="source">${c.desc}</p><div class="bar"><i style="width:${ss.done/bank[c.id].length*100}%"></i></div><div class="progress-text"><span>已练 ${ss.done} 题</span><span>错题 ${ss.wrong} · 收藏 ${ss.stars}</span></div>${latestSession(c.id)?`<button data-continue="${c.id}">继续${modeNames[latestSession(c.id).mode]} · 第 ${latestSession(c.id).index+1} 题</button><button class="quiet" data-course="${c.id}">选择练习方式</button>`:`<button data-course="${c.id}">进入练习</button>`}</article>`}).join('')}</div><div class="home-bottom"><p>支持单选、多选和判断题，先作答，再核对。</p><p>无需登录 · 当前浏览器保存 · 可导出学习备份</p></div>`;app.querySelectorAll('[data-course]').forEach(b=>b.onclick=()=>openCourse(b.dataset.course));app.querySelectorAll('[data-continue]').forEach(b=>b.onclick=()=>{const id=b.dataset.continue,r=latestSession(id);course=courses.find(c=>c.id===id);mode=r.mode;resume()})}
function heading(){return `<div class="crumb"><button class="quiet" id="backHome">课程首页</button><span>/</span><span>${course.name}</span></div><div class="course-heading"><div><h1>${course.name}</h1><p>${course.detail}</p><p>题库投稿与纠错：<a href="mailto:barcazqn@gmail.com">barcazqn@gmail.com</a></p></div>${run?'<button class="secondary" id="exitRun">返回课程</button>':''}</div>`}
function bindHeading(){document.querySelector('#backHome').onclick=()=>leave(home);let b=document.querySelector('#exitRun');if(b)b.onclick=()=>leave(()=>openCourse(course.id))}
function leave(cb){stopTimer();cb()}

function openCourse(id){
 pageView();stopTimer();course=courses.find(c=>c.id===id);run=null;
 const qs=bank[id],s=summary(qs),chapters=[...new Set(qs.map(q=>q.chapter))],f=prefs.filters[id]||{};
 mode=Object.keys(modeNames).includes(f.mode)?f.mode:'sequence';
 app.innerHTML=heading()+`<div class="panel"><h2 style="font-size:18px">今天怎么练？</h2><div class="modes">${Object.keys(modeNames).map(m=>`<button class="mode ${m===mode?'active':''}" data-mode="${m}" aria-pressed="${m===mode}">${modeNames[m]}<small>${({sequence:'按题库顺序练习',random:'打乱题目顺序',wrong:s.wrong+' 道待复习',star:s.stars+' 道已收藏',read:'直接查看参考答案',exam:'随机 30 题 · 30 分钟'})[m]}</small></button>`).join('')}</div>
 <div class="filters"><label>章节<select id="chapter"><option value="">全部章节</option>${chapters.map(ch=>`<option>${esc(ch)}</option>`).join('')}</select></label><label>题型<select id="type"><option value="">全部题型</option><option value="single">单选题</option><option value="multiple">多选题</option><option value="judge">判断题</option></select></label><label>题目搜索<input id="search" type="search" placeholder="输入题干或选项关键词" value="${esc(f.search||'')}"></label></div>
 <div class="filter-options"><label><input id="unanswered" type="checkbox" ${f.unanswered?'checked':''}> 只练从未作答的题</label><button id="clearFilters" class="quiet">重置筛选</button></div>
 <div id="resumeCard"></div><div class="launch"><p id="matchCount" role="status"></p><button id="start">开始练习</button></div><p id="emptyHelp" class="empty-help" hidden></p></div>
 <div class="panel"><div class="section-head"><h2>学习概况</h2><span class="muted">最近作答正确率 ${s.rate}%</span></div><div class="progress-text"><span>已练 ${s.done} / ${qs.length} 题</span><span>最新答对 ${s.right} 题 · 待复习 ${s.wrong} 题</span></div><div class="bar"><i style="width:${s.done/qs.length*100}%"></i></div><p class="muted" style="font-size:12px;margin:15px 0 0">各模式分别保存进度。错题答对后自动移出错题本；背题不计入统计。</p></div>${examHistory(id)}`;
 bindHeading();document.querySelector('#chapter').value=chapters.includes(f.chapter)?f.chapter:'';
 document.querySelector('#type').value=['single','multiple','judge'].includes(f.type)?f.type:'';
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});updateCount()});
 ['chapter','type','search','unanswered'].forEach(id=>document.querySelector('#'+id).oninput=updateCount);
 document.querySelector('#clearFilters').onclick=()=>{['chapter','type','search'].forEach(id=>document.querySelector('#'+id).value='');document.querySelector('#unanswered').checked=false;updateCount()};
 document.querySelector('#start').onclick=start;updateCount();
}

function examHistory(id){let arr=state.exams.filter(e=>e.course===id).slice(-5).reverse();return arr.length?`<div class="panel"><h3>最近模拟测试</h3>${arr.map(e=>`<div class="history-row"><span>${new Date(e.date).toLocaleString('zh-CN')}</span><span>${e.correct} / ${e.total} 题正确 · ${e.score} 分</span></div>`).join('')}</div>`:''}
function filtered(){
 const ch=document.querySelector('#chapter').value,t=document.querySelector('#type').value,kw=document.querySelector('#search').value.trim().toLowerCase(),unanswered=document.querySelector('#unanswered').checked;
 return bank[course.id].filter(q=>(!ch||q.chapter===ch)&&(!t||q.type===t)&&(!kw||(q.stem+Object.values(q.options).join('')).toLowerCase().includes(kw))&&(!unanswered||!state.answers[q.id])&&(mode!=='wrong'||state.answers[q.id]?.lastCorrect===false)&&(mode!=='star'||state.stars.includes(q.id)));
}

function updateCount(){
 const unanswered=document.querySelector('#unanswered');unanswered.disabled=mode==='wrong';if(mode==='wrong')unanswered.checked=false;
 const n=filtered().length,saved=savedSession(course.id,mode);
 prefs.filters[course.id]={mode,chapter:document.querySelector('#chapter').value,type:document.querySelector('#type').value,search:document.querySelector('#search').value,unanswered:document.querySelector('#unanswered').checked};savePrefs();
 document.querySelector('#matchCount').textContent=mode==='exam'?`符合条件 ${n} 题，本次抽取 ${Math.min(30,n)} 题。`:`符合条件 ${n} 题。`;
 const start=document.querySelector('#start');start.disabled=!n;start.textContent=saved?'重新开始'+(mode==='exam'?'测试':'本轮'):(mode==='exam'?'开始测试':'开始练习');
 const help=document.querySelector('#emptyHelp');help.hidden=!!n;help.textContent=mode==='wrong'?'当前条件下没有待复习错题。可重置筛选或选择顺序练习。':mode==='star'?'当前条件下没有收藏。练习中点击“收藏”后可在这里复习。':'没有符合条件的题目，请重置筛选或取消“只练从未作答的题”。';
 document.querySelector('#resumeCard').innerHTML=saved?`<div class="resume-card"><div><b>${modeNames[mode]} · 第 ${saved.index+1} / ${saved.ids.length} 题</b><small>继续原来的题组；下方筛选仅用于新练习。${mode==='exam'?'关闭页面后仍继续计时。':''}</small></div><button id="resume">继续上次${mode==='exam'?'测试':'练习'}</button></div>`:'';
 const rb=document.querySelector('#resume');if(rb)rb.onclick=resume;
}

function start(){
 let qs=filtered();if(!qs.length)return;
 if(savedSession(course.id,mode)&&!confirm('重新开始会替换当前模式的练习位置，其他模式和历史记录会保留。继续？'))return;
 if(mode==='random'||mode==='exam')qs=E.shuffle(qs);if(mode==='exam')qs=qs.slice(0,30);
 beginRun(qs.map(q=>q.id),mode);
}
function beginRun(ids,kind){
 mode=kind;run={mode:kind,ids,index:0,submitted:{},drafts:{},started:Date.now(),deadline:kind==='exam'?Date.now()+30*60*1000:null};
 persistRun();mountPractice();drawQuestion(true);startTimer();
}

function resume(){
 run=savedSession(course.id,mode);
 if(!run?.ids?.length){toast('上次练习已失效，请重新开始。');return}
 run.index=Math.min(run.index,run.ids.length-1);run.submitted=run.submitted||{};run.drafts=run.drafts||{};
 // Old test sessions may contain selected answers that had not been explicitly saved.
 if(run.mode==='exam')for(const [id,a] of Object.entries(run.drafts))if(a.length)run.submitted[id]={answer:[...a],correct:false};
 persistRun();mountPractice();drawQuestion(true);startTimer();
}

function persistRun(){run.updated=Date.now();state.sessions[sessionKey(course.id,run.mode)]=run;save()}

function question(){return bank[course.id].find(q=>q.id===run.ids[run.index])}
function mountPractice(){
 document.body.classList.add('practicing');window.scrollTo(0,0);
 app.innerHTML=`<section class="practice-shell"><header class="practice-topbar"><button class="quiet" id="pause">‹ 返回课程</button><div><b>${course.name}</b><span id="runProgress"></span></div><button class="secondary" id="toggleCard" aria-expanded="false" aria-controls="cardDrawer">答题卡</button></header>
 <div class="practice-layout"><div id="questionScroll" class="question-scroll" tabindex="-1"><section id="questionBody" class="question-body"></section></div><aside id="cardDrawer" class="card-drawer" aria-label="答题卡"></aside></div>
 <footer class="practice-controls"><button id="prev" class="secondary">上一题</button><div id="actionStatus" class="action-status" aria-live="polite"></div><button id="next">下一题</button></footer></section>`;
 document.querySelector('#pause').onclick=()=>leave(()=>openCourse(course.id));
 document.querySelector('#toggleCard').onclick=()=>{const shell=document.querySelector('.practice-shell'),open=shell.classList.toggle('card-open');document.querySelector('#toggleCard').setAttribute('aria-expanded',open)};
 document.querySelector('#prev').onclick=()=>move(-1);document.querySelector('#next').onclick=next;
}
function drawQuestion(resetScroll=false){
 const q=question();if(!q){toast('题目不存在，请重新开始。');openCourse(course.id);return}
 const scroller=document.querySelector('#questionScroll'),scroll=scroller.scrollTop,focused=document.activeElement?.dataset?.option;
 const reading=run.mode==='read',exam=run.mode==='exam',sub=run.submitted[q.id],revealed=reading||(!exam&&!!sub),chosen=run.drafts[q.id]||sub?.answer||[],star=state.stars.includes(q.id);
 document.querySelector('#runProgress').textContent=`${modeNames[run.mode]} · ${run.index+1} / ${run.ids.length}`;
 document.querySelector('#questionBody').innerHTML=`<div class="q-head"><span class="pill">${names[q.type]}</span><span>${esc(q.chapter)}</span>${exam?'<span class="exam-time" id="clock"></span>':''}</div>
 <h1 class="question-stem" id="questionTitle">${esc(q.stem)}</h1>
 <div class="question-tools"><button id="star" class="quiet ${star?'starred':''}" aria-pressed="${star}">${star?'★ 已收藏':'☆ 收藏'}</button>${!reading&&!exam&&q.type!=='multiple'?`<label><input type="checkbox" id="quick" ${prefs.quick?'checked':''}> 单选 / 判断选后核对</label>`:''}</div>
 <div class="options" role="group" aria-labelledby="questionTitle">${Object.entries(q.options).map(([key,v])=>{let cls=chosen.includes(key)?' selected':'';if(revealed&&q.answer.includes(key))cls+=' right';if(revealed&&chosen.includes(key)&&!q.answer.includes(key))cls+=' wrong';return `<button class="option${cls}" data-option="${key}" ${revealed?'disabled':''} aria-pressed="${chosen.includes(key)}"><span class="letter">${key}</span><span>${esc(v)}</span>${revealed&&q.answer.includes(key)?'<span class="answer-mark" aria-label="参考答案">✓</span>':''}</button>`}).join('')}</div>
 ${!revealed?`<p class="answer-instruction">${exam?'选择即保存，可随时修改。交卷前不显示答案。':q.type==='multiple'?'可多选。选齐后点击底部“核对答案”。':prefs.quick?'选择后核对答案，再点击“下一题”继续。':'选好后点击底部“核对答案”。'}</p>`:''}
 ${revealed?`<div class="feedback" role="status"><b style="color:${reading?'var(--accent)':sub.correct?'var(--good)':'var(--bad)'}">${reading?'参考答案':sub.correct?(course.id==='party'?'与参考作答一致':'回答正确'):(course.id==='party'?'与参考作答不同 · 已记入错题本':'回答错误 · 已记入错题本')} · ${q.answer.join('、')}</b>${!reading&&!sub.correct?`<p>你的选择：${sub.answer.map(k=>esc(k+'：'+q.options[k])).join('；')}</p>`:''}<p>${q.answer.map(k=>esc(k+'：'+q.options[k])).join('<br>')}</p><small>答案沿用原题库，材料未提供详细解析。</small></div>`:''}
 ${q.note?`<p class="answer-instruction">整理说明：${esc(q.note)}</p>`:''}
 ${q.sourcePage?`<p class="answer-instruction">原文第 ${q.sourcePage} 页 · <a href="sources/party.pdf#page=${q.sourcePage}" target="_blank" rel="noopener">打开原题核对</a></p>`:''}
 <p class="hint">数字 1–8 选项 · Enter 核对 / 下一题 · ← → 切题</p>`;
 document.querySelectorAll('[data-option]').forEach(b=>b.onclick=()=>choose(b.dataset.option));
 document.querySelector('#star').onclick=()=>{const i=state.stars.indexOf(q.id);if(i<0)state.stars.push(q.id);else state.stars.splice(i,1);save();drawQuestion()};
 const quick=document.querySelector('#quick');if(quick)quick.onchange=()=>{prefs.quick=quick.checked;savePrefs();drawQuestion()};
 document.querySelector('#prev').disabled=run.index===0;
 const last=run.index===run.ids.length-1;
 document.querySelector('#next').textContent=!reading&&!exam&&!sub&&chosen.length?'核对答案':last?(exam?'交卷':'完成本轮'):!reading&&!exam&&!sub?'跳过本题':'下一题';
 document.querySelector('#actionStatus').textContent=exam?`已保存 ${Object.keys(run.submitted).length} / ${run.ids.length}`:reading?`${run.index+1} / ${run.ids.length}`:`已核对 ${Object.keys(run.submitted).length} / ${run.ids.length}`;
 drawCard();updateClock();
 if(!run||run.finished)return;
 scroller.scrollTop=resetScroll?0:scroll;
 if(!resetScroll&&focused){const el=document.querySelector(`[data-option="${focused}"]`);if(el&&!el.disabled)el.focus({preventScroll:true})}
}
function drawCard(){
 const exam=run.mode==='exam',reading=run.mode==='read',drawer=document.querySelector('#cardDrawer'),scroll=drawer.scrollTop;
 const missing=run.ids.filter(id=>!run.submitted[id]);
 drawer.innerHTML=`<div class="section-head"><h2>答题卡</h2><button id="closeCard" class="quiet">收起</button></div><p class="muted">${reading?'背题模式不计入统计':`已${exam?'答':'核对'} ${run.ids.length-missing.length} 题 · 未${exam?'答':'核对'} ${missing.length} 题`}</p>
 <div class="answer-grid">${run.ids.map((id,i)=>{const a=run.submitted[id];return `<button data-jump="${i}" class="${i===run.index?'current ':''}${a?(exam||a.correct?'done':'bad'):run.drafts[id]?.length?'draft':''}" aria-label="第 ${i+1} 题${a?exam?'，已作答':a.correct?'，答对':'，答错':'，未核对'}" aria-current="${i===run.index?'true':'false'}">${i+1}</button>`}).join('')}</div>
 <p class="legend">${exam?'绿色：已答':'绿色：答对　红色：答错'}<br>边框：当前题目</p>
 ${!reading&&missing.length?'<button id="nextMissing" class="secondary">跳到下一道未答题</button>':''}
 ${exam?'<button id="finishExam" class="secondary">提前交卷</button>':'<button id="finishEarly" class="quiet">结束本轮</button>'}<button id="practiceTheme" class="quiet">${state.theme==='dark'?'切换浅色模式':'切换深色模式'}</button>`;
 drawer.scrollTop=scroll;
 document.querySelector('#practiceTheme').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme();save();drawCard()};
 document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump(Number(b.dataset.jump)));
 document.querySelector('#closeCard').onclick=closeCard;
 const missingButton=document.querySelector('#nextMissing');if(missingButton)missingButton.onclick=()=>{const i=run.ids.findIndex((id,i)=>i>run.index&&!run.submitted[id]);jump(i<0?run.ids.findIndex(id=>!run.submitted[id]):i)};
 const finish=document.querySelector('#finishExam');if(finish)finish.onclick=()=>finishExam(false);
 const early=document.querySelector('#finishEarly');if(early)early.onclick=()=>{if(confirm('结束本轮并查看结果？已完成的作答记录会保留。'))finishPractice()};
}
function closeCard(){document.querySelector('.practice-shell')?.classList.remove('card-open');document.querySelector('#toggleCard')?.setAttribute('aria-expanded','false')}
function examExpired(){if(run?.mode==='exam'&&!run.finished&&Date.now()>=run.deadline){finishExam(true);return true}return false}
function jump(index){if(examExpired())return;if(!run||index<0||index>=run.ids.length)return;run.index=index;persistRun();closeCard();drawQuestion(true)}

function choose(k){
 if(examExpired())return;
 const q=question();if(!Object.hasOwn(q.options,k)||run.mode==='read'||(run.mode!=='exam'&&run.submitted[q.id]))return;
 let a=[...(run.drafts[q.id]||run.submitted[q.id]?.answer||[])];
 a=q.type==='multiple'?(a.includes(k)?a.filter(x=>x!==k):[...a,k]):[k];run.drafts[q.id]=a;
 if(run.mode==='exam'){if(a.length)run.submitted[q.id]={answer:[...a],correct:false};else delete run.submitted[q.id]}
 persistRun();
 if(run.mode!=='exam'&&q.type!=='multiple'&&prefs.quick){submit();return}
 drawQuestion();
}

function submit(){
 if(examExpired())return;
 const q=question(),a=run.drafts[q.id]||[];if(!a.length||run.submitted[q.id])return;
 run.submitted[q.id]={answer:[...a],correct:E.correct(q,a)};E.record(state,q,a);persistRun();drawQuestion();
}

function move(n){jump(Math.max(0,Math.min(run.ids.length-1,run.index+n)))}

function next(){
 if(examExpired())return;
 const q=question();
 if(run.mode!=='exam'&&run.mode!=='read'&&!run.submitted[q.id]&&run.drafts[q.id]?.length){submit();return}
 if(run.index<run.ids.length-1){move(1);return}
 if(run.mode==='exam')finishExam(false);else finishPractice();
}

function finishPractice(){
 stopTimer();run.finished=true;const r=run,n=Object.keys(r.submitted).length,right=Object.values(r.submitted).filter(a=>a.correct).length;
 const wrong=r.ids.filter(id=>r.submitted[id]&&!r.submitted[id].correct),missing=r.ids.filter(id=>!r.submitted[id]);
 delete state.sessions[sessionKey(course.id,r.mode)];save();pageView();
 app.innerHTML=heading()+`<div class="panel result"><h2>${r.mode==='read'?'本轮背题结束':'本轮练习结束'}</h2><div class="score">${r.mode==='read'?r.ids.length:right}<span style="font-size:18px"> ${r.mode==='read'?'道题':'题答对'}</span></div><p class="muted">${r.mode==='read'?'背题不计入答题统计。':`本轮 ${r.ids.length} 题，答对 ${right} 题，答错 ${wrong.length} 题，未核对 ${missing.length} 题。`}</p><div class="result-actions"><button id="returnCourse">返回课程</button>${r.mode!=='read'&&wrong.length?`<button id="retryWrong" class="secondary">再练本轮错题 · ${wrong.length} 题</button>`:''}${r.mode!=='read'&&missing.length?`<button id="retryMissing" class="secondary">补完未答题 · ${missing.length} 题</button>`:''}<button id="restart" class="secondary">重新练习本组</button></div></div>`;
 bindHeading();document.querySelector('#returnCourse').onclick=()=>openCourse(course.id);
 document.querySelector('#restart').onclick=()=>beginRun(r.ids,r.mode);
 const retry=(id,ids)=>{const b=document.querySelector(id);if(b)b.onclick=()=>beginRun(ids,r.mode)};retry('#retryWrong',wrong);retry('#retryMissing',missing);
}

function finishExam(auto){
 if(!run||run.finished)return;
 const n=Object.keys(run.submitted).length;
 if(!auto&&!confirm(`已作答 ${n} / ${run.ids.length} 题${n<run.ids.length?`，剩余 ${run.ids.length-n} 题未答，将按错误计`:''}。确认交卷？`))return;
 stopTimer();run.finished=true;const r=run;
 let right=0;r.ids.forEach(id=>{const q=bank[course.id].find(q=>q.id===id),a=r.submitted[id]?.answer||[];E.record(state,q,a);if(E.correct(q,a))right++});
 const total=r.ids.length,score=Math.round(right/total*100),wrong=r.ids.filter(id=>!E.correct(bank[course.id].find(q=>q.id===id),r.submitted[id]?.answer||[]));
 state.exams.push({course:course.id,date:Date.now(),correct:right,total,score});state.exams=state.exams.slice(-100);
 delete state.sessions[sessionKey(course.id,r.mode)];save();pageView();
 app.innerHTML=heading()+`<div class="panel result"><h2>${auto?'时间到，已自动交卷':'测试完成'}</h2><div class="score">${score}<span style="font-size:18px"> 分</span></div><p class="muted">${total} 题中答对 ${right} 题，未答 ${total-n} 题。${wrong.length?'错题与未答题已记入错题本。':'本次全部答对。'}</p><div class="result-actions"><button id="returnCourse">返回课程</button>${wrong.length?`<button id="retryExamWrong" class="secondary">练习本次错题 · ${wrong.length} 题</button>`:''}</div><hr><div class="review-heading"><h3>逐题核对</h3><label><input id="onlyWrong" type="checkbox"> 只看错题与未答题</label></div>${r.ids.map((id,i)=>{const q=bank[course.id].find(q=>q.id===id),a=r.submitted[id]?.answer||[],ok=E.correct(q,a);return `<div class="review-row" data-correct="${ok}"><b style="color:${ok?'var(--good)':'var(--bad)'}">${ok?'✓':'✗'} ${i+1}. ${esc(q.stem)}</b><small>你的答案：${a.length?a.map(k=>esc(k+'：'+q.options[k])).join('；'):'未作答'}<br>参考答案：${q.answer.map(k=>esc(k+'：'+q.options[k])).join('；')}</small></div>`}).join('')}</div>`;
 bindHeading();document.querySelector('#returnCourse').onclick=()=>openCourse(course.id);
 document.querySelector('#onlyWrong').onchange=e=>document.querySelectorAll('[data-correct]').forEach(el=>el.hidden=e.target.checked&&el.dataset.correct==='true');
 const retry=document.querySelector('#retryExamWrong');if(retry)retry.onclick=()=>{if(savedSession(course.id,'wrong')&&!confirm('练习本次错题会替换错题复习模式的进度，历史作答会保留。继续？'))return;beginRun(wrong,'wrong')};
}

function stopTimer(){if(timer)clearInterval(timer);timer=null}
function startTimer(){stopTimer();if(run?.mode==='exam'&&!run.finished){if(examExpired())return;updateClock();timer=setInterval(updateClock,1000)}}

function updateClock(){if(!run||run.mode!=='exam'||run.finished)return;let secs=Math.max(0,Math.ceil((run.deadline-Date.now())/1000)),el=document.querySelector('#clock');if(el)el.textContent=`剩余 ${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;if(!secs)finishExam(true)}
document.querySelector('.brand').onclick=e=>{e.preventDefault();leave(home)};
document.querySelector('#theme').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme();save()};
document.querySelector('#settings').onclick=()=>document.querySelector('#records').showModal();document.querySelector('#closeRecords').onclick=()=>document.querySelector('#records').close();
document.querySelector('#export').onclick=()=>{let blob=new Blob([rawBackup===null?JSON.stringify(state,null,2):rawBackup],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='矿大刷题记录-'+new Date().toLocaleDateString('sv-SE')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出')};
document.querySelector('#import').onchange=async e=>{let file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>10*1024*1024)throw Error('备份文件过大');let s=E.validate(JSON.parse(await file.text()),allIds);if(!confirm('导入将替换本机全部记录，是否继续？'))return;stopTimer();rawBackup=null;state=s;save();applyTheme();document.querySelector('#records').close();home();toast('备份已导入')}catch(err){toast('导入失败：'+err.message)}};
document.querySelector('#reset').onclick=()=>{if(!confirm('确定清空本机全部答题、错题、收藏与进度？此操作无法撤销。'))return;stopTimer();let theme=state.theme;rawBackup=null;state=E.blank();state.theme=theme;save();document.querySelector('#records').close();home();toast('本机记录已清空')};
document.addEventListener('keydown',e=>{
 if(!run||run.finished||document.querySelector('#records').open||e.altKey||e.ctrlKey||e.metaKey||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable)return;
 if(e.key==='Escape'){closeCard();return}
 if(e.repeat)return;
 if(e.key==='ArrowLeft'){e.preventDefault();move(-1)}
 if(e.key==='ArrowRight'){e.preventDefault();next()}
 if(e.key==='Enter'&&(e.target.tagName!=='BUTTON'||e.target.matches('[data-option]'))){e.preventDefault();next()}
 if(/^[1-8]$/.test(e.key)){const k=Object.keys(question().options)[Number(e.key)-1];if(k){e.preventDefault();choose(k)}}
});
window.addEventListener('focus',()=>{if(run&&!run.finished)updateClock()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&run&&!run.finished)updateClock()});
window.addEventListener('storage',e=>{if(e.key===E.KEY){stopTimer();run=null;pageView();app.innerHTML='<div class="panel empty"><h2>学习记录已在另一个页面更新</h2><p>刷新后继续，避免覆盖新记录。</p><button onclick="location.reload()">刷新记录</button></div>';document.querySelector('#records').close();document.querySelector('#settings').disabled=true;document.querySelector('#theme').disabled=true}});
async function init(){app.innerHTML='<div class="loading">正在载入课程题库…</div>';try{const data=await Promise.all(courses.map(async c=>{let r=await fetch('data/'+c.id+'.json');if(!r.ok)throw Error('题库文件加载失败');return [c.id,await r.json()]}));bank=Object.fromEntries(data);allIds=new Set(Object.values(bank).flat().map(q=>q.id));try{let raw=localStorage.getItem(E.KEY);if(raw){rawBackup=raw;state=E.validate(JSON.parse(raw),allIds);rawBackup=null}}catch(e){toast('已有记录无法读取，原始记录已保留。请在记录管理导出后处理。');document.querySelector('#saveStatus').textContent='记录读取失败'}applyTheme();home()}catch(e){app.innerHTML='<div class="panel empty"><h2>题库未能载入</h2><p>请使用网站地址访问，或按部署说明启动本地预览。检查网络后刷新重试。</p><button onclick="location.reload()">重新加载</button></div>'}}
init();
