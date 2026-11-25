const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('static/app.js', 'utf8').replace('const app = new DiaryApp();', 'globalThis.DiaryApp = DiaryApp;');
let confirmCalls = 0;
const context = vm.createContext({console, Date, Intl, confirm: () => {confirmCalls++; return false;}});
vm.runInContext(source, context);
const app = Object.create(context.DiaryApp.prototype);
Object.assign(app, {unsavedData: {2024: '저장된 본문'}, dirtyFlags: {}, draftConflicts: {}, requestInProgress: false,
  startYear: 2024, selectedYear: 2024, selectedMonth: 10, selectedDate: 16});
app.onTextareaInput(2024, {target: {value: '수정 중인 본문'}});
assert.equal(app.hasPendingChanges(), true, 'input 단계에서 미저장 변경을 감지');
app.nextDay();
assert.equal(confirmCalls, 1, '이동 전 확인');
assert.equal(app.selectedDate, 16, '취소하면 날짜 유지');
app.onTextareaInput(2024, {target: {value: '저장된 본문'}});
assert.equal(app.hasPendingChanges(), false, '원문으로 되돌리면 변경 해제');
app.requestInProgress = true;
app.nextDay();
assert.equal(app.selectedDate, 16, '저장/조회 중 다른 날짜 이동 금지');
assert.equal(app.isLeapYear(1900), false);
assert.equal(app.isLeapYear(2000), true);
assert.equal(app.isLeapYear(2024), true);
assert.equal(app.isLeapYear(2100), false);
assert.equal(app.getSeason(2), 'spring');
assert.equal(app.getSeason(5), 'summer');
assert.equal(app.getSeason(8), 'autumn');
assert.equal(app.getSeason(11), 'winter');
console.log('미저장 변경·이동 취소·요청 중 이동 방지·윤년·사계절 검사 통과');

// 기간을 바꾼 뒤 기준 달력이 평년이어도 2/29 다음은 3/1이어야 한다.
app.requestInProgress = false;
app.dirtyFlags = {};
app.renderCalendar = app.updateDateDisplay = app.loadDiarySections = () => {};
Object.assign(app, {startYear:2024, selectedYear:2026, selectedMonth:1, selectedDate:29});
app.nextDay();
assert.equal(app.selectedMonth, 2);
assert.equal(app.selectedDate, 1);
Object.assign(app, {startYear:2025, selectedYear:2026, selectedMonth:1, selectedDate:29});
app.nextDay();
assert.equal(app.selectedMonth, 2);
assert.equal(app.selectedDate, 1);
console.log('기간 변경 후 윤일 다음 날 검사 통과');

const drafts = new Map();
context.localStorage = {getItem:key=>drafts.get(key) ?? null,setItem:(key,value)=>drafts.set(key,value),removeItem:key=>drafts.delete(key)};
const draftStatus = {textContent:'',appendChild(){}};
context.document = {getElementById:()=>draftStatus};
Object.assign(app,{unsavedData:{2024:'원본'},dirtyFlags:{},selectedMonth:10,selectedDate:17});
app.onTextareaInput(2024,{target:{value:'새로 작성 중인 긴 일기'}});
const draftText = {value:'원본',style:{}};
app.dirtyFlags={};
app.restoreDraft(2024,{date:'2024-11-17',content:'원본'},draftText,draftStatus);
assert.equal(draftText.value,'새로 작성 중인 긴 일기');
assert.equal(app.dirtyFlags[2024],true);
assert.match(draftStatus.textContent,/복구/);
draftText.value='다른 기기에서 수정';
context.document.createElement=()=>({addEventListener(){}});
app.restoreDraft(2024,{date:'2024-11-17',content:'다른 기기에서 수정'},draftText,draftStatus);
assert.equal(draftText.value,'다른 기기에서 수정','원본이 바뀌면 자동 덮어쓰기 금지');
app.unsavedData={2024:'다른 기기에서 수정'};
app.onTextareaInput(2024,{target:{value:'다른 기기에서 수정.'}});
assert.equal(JSON.parse(drafts.get('diary-draft:2024-11-17')).content,'새로 작성 중인 긴 일기','선택 전 입력이 충돌한 임시 글을 덮어쓰지 않음');
assert.equal(app.dirtyFlags[2024],true);
app.draftConflicts={};
drafts.set('diary-draft:2024-11-18',JSON.stringify({content:'같은 글',base:'예전'}));
app.restoreDraft(2024,{date:'2024-11-18',content:'같은 글'},draftText,draftStatus);
assert.equal(drafts.has('diary-draft:2024-11-18'),false,'저장본과 같은 임시 글은 정리');
console.log('날짜별 임시 저장·복구·원본 충돌 보존 검사 통과');
app.dirtyFlags = {};

(async () => {
  let opened=0;
  const names=['shorts-status','make-shorts','close-shorts','dialog-shorts','shorts-video','download-shorts','shorts-captions','shorts-date','shorts-story','retry-story','shorts-ai-video','shorts-video-cost'];
  const elements=Object.fromEntries(names.map(id=>[id,{disabled:false,hidden:true,checked:false,textContent:'',value:'',children:[],addEventListener(){},removeEventListener(){},showModal(){opened++;},pause(){},replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);}}]));
  const makeNode=()=>({textContent:'',value:'',disabled:false,children:[],listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(){},appendChild(child){this.children.push(child);}});
  context.document={getElementById:id=>elements[id],createElement:makeNode,querySelectorAll:()=>elements['shorts-story'].children.map(li=>li.children[0])};
  const entry={date:'2024-11-17',content_hash:'saved-version',content:'친구와 산책했다.\n기분이 좋아졌다.',image_path:'/assets/demo-walk.png',image_stale:false};
  app.entries={2024:entry};
  let warning;app.showInfoDialog=title=>{warning=title;};
  let storyCalls=0,videoCalls=0,lastBody;
  const captions=['조급했던 아침','친구와 걸으며 마음이 편안해졌다'];
  context.fetch=async (url,options)=>{
    assert.equal(app.requestInProgress,true);
    assert.equal(elements['make-shorts'].disabled,true);
    if(url==='/api/shorts/story') {
      storyCalls++;
      assert.deepEqual(JSON.parse(options.body),{date:entry.date,content_hash:entry.content_hash,consent:true});
      return {ok:true,json:async()=>({captions,credits_charged:0.5,cached:false})};
    }
    assert.equal(url,'/api/shorts');videoCalls++;lastBody=JSON.parse(options.body);
    return {ok:true,json:async()=>({url:'/videos/sample.mp4',seconds:8})};
  };
  app.videoInfo={estimated_credits:60};
  await app.showShortsDialog(2024);
  assert.equal(opened,1);
  assert.equal(storyCalls,1,'일기에서 자동으로 이야기를 구성');
  assert.equal(elements['shorts-captions'].value,captions.join('\n'));
  assert.equal(elements['shorts-story'].children.length,2);
  assert.match(elements['shorts-video-cost'].textContent,/영상 2개.*120크레딧/,'장면 수에 맞는 최대 비용 안내');
  assert.equal(elements['make-shorts'].disabled,false);
  assert.equal(app.requestInProgress,false);
  // Tapping a sentence and typing edits that scene only.
  const second=elements['shorts-story'].children[1].children[0];
  assert.equal(second.value,captions[1]);
  second.value='친구와  걸었어'; second.listeners.input();
  assert.equal(elements['shorts-captions'].value,'조급했던 아침\n친구와 걸었어');
  await app.makeShorts();
  assert.equal(videoCalls,1);
  assert.deepEqual(lastBody.captions,['조급했던 아침','친구와 걸었어']);
  assert.equal(lastBody.clips,false,'체크하지 않으면 AI 영상 없이 크레딧 없음');
  assert.equal(elements['shorts-video'].src,'/videos/sample.mp4');
  assert.equal(elements['download-shorts'].href,'/videos/sample.mp4');
  app.dirtyFlags[2024]=true;
  await app.showShortsDialog(2024);
  assert.equal(opened,1);assert.match(warning,/먼저 일기를 저장/);
  app.dirtyFlags={};app.entries[2024]={...entry,image_stale:true};
  await app.showShortsDialog(2024);
  assert.equal(opened,1);assert.match(warning,/수채화/);
  app.entries[2024]={...entry,content:'긴 일기 원문'.repeat(200)};
  await app.showShortsDialog(2024);
  assert.equal(storyCalls,2,'긴 원문도 글자 잘라내기 대신 AI 구성');
  elements['shorts-captions'].value=['아침 공부','친구와 산책','저녁 차'].join('\n');
  app.renderShortsStory();
  elements['shorts-ai-video'].checked=true;
  let clipCalls=0,clipChecks=0,costPrompt='',clipPending=1;videoCalls=0;
  context.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);
    assert.equal(elements['shorts-ai-video'].disabled,true);
    if(url==='/api/shorts/clip'){
      if(body.check_only){clipChecks++;assert.equal(body.consent,undefined);return {ok:true,json:async()=>({cached:body.caption==='저녁 차',processing:false})};}
      clipCalls++; assert.equal(body.consent,true);
      // The first clip answers "still processing" once; the page asks again instead of failing.
      if(body.caption==='아침 공부'&&clipPending){clipPending--;return {ok:true,status:202,json:async()=>({status:'processing',credits_charged:60})};}
      return {ok:true,json:async()=>({status:'completed',credits_charged:body.caption==='아침 공부'?0:60})};
    }
    assert.equal(url,'/api/shorts');videoCalls++;lastBody=body;
    return {ok:true,json:async()=>({url:'/videos/clip.mp4',seconds:12})};
  };
  app.imageConfigured=true;
  context.confirm=message=>{costPrompt=message;return false;};
  await app.makeShorts();
  assert.equal(clipChecks,3); assert.equal(clipCalls,0,'비용 확인을 취소하면 생성 요청 없음'); assert.equal(videoCalls,0);
  assert.match(costPrompt,/장면 영상 2개.*120크레딧/,'이미 만든 영상은 빼고 안내');
  assert.equal(app.requestInProgress,false); assert.equal(elements['shorts-ai-video'].disabled,false);
  context.confirm=()=>true;
  await app.makeShorts();
  assert.equal(clipCalls,4,'진행 중이던 영상은 다시 물어 완료까지 기다림');
  assert.equal(videoCalls,1); assert.equal(lastBody.clips,true);
  assert.match(elements['shorts-status'].textContent,/AI 영상 180크레딧/,'영상 60+0+60+60 합계');
  context.fetch=async(url,options)=>{
    if(JSON.parse(options.body).check_only) return {ok:true,json:async()=>({cached:false})};
    return {ok:false,json:async()=>({error:'생성 실패.'})};
  };
  await app.makeShorts();
  assert.match(elements['shorts-status'].textContent,/완성된 영상 장면은 보관/);
  context.fetch=async()=>({ok:true,json:async()=>({cached:false})});
  app.imageConfigured=false;
  await app.makeShorts();
  assert.match(elements['shorts-status'].textContent,/API 키를 설정/);
  assert.doesNotMatch(elements['shorts-status'].textContent,/보관/,'요청 전 차단은 과금 안내 불필요');
  app.imageConfigured=true;elements['shorts-ai-video'].checked=false;
  context.fetch=async()=>{throw new Error('연결 실패');};
  await app.prepareShortsStory();
  assert.equal(elements['retry-story'].hidden,false);
  assert.equal(elements['make-shorts'].disabled,true);
  assert.equal(elements['close-shorts'].disabled,false);
  assert.equal(app.requestInProgress,false);
  assert.match(elements['shorts-status'].textContent,/원본 일기는 그대로/);
  elements['shorts-captions'].value='가'.repeat(65);
  await app.makeShorts();
  assert.match(elements['shorts-status'].textContent,/64자 이내/);
  console.log('일기 기반 자동 구성·문장 바로 수정·AI 영상 선택·비용 확인·실패 복구·영상 연결 검사 통과');
})().then(()=>v2Checks()).catch(error=>{console.error(error);process.exitCode=1;});

// v2: daily question and past-entry banner (runs after the async shorts checks above).
function v2Checks() {
  // Index is the day of a leap year, so Mar 1 is always 60 and Feb 29 keeps its own slot (59).
  const Q = vm.runInContext('DAILY_QUESTIONS', context);
  const CHEER = vm.runInContext('CHEER_LINES', context);
  assert.equal(app.dailyQuestion(0,1), Q[0]);
  assert.equal(app.dailyQuestion(1,29), Q[59 % Q.length], '윤일 고유 질문');
  assert.equal(app.dailyQuestion(2,1), Q[60 % Q.length], '평년에도 3월 1일은 같은 질문');
  assert.equal(app.dailyQuestion(10,17), Q[321 % Q.length], '11월 17일 고정 질문');
  assert.notEqual(app.dailyQuestion(10,17), app.dailyQuestion(10,18), '다음 날은 다른 질문');
  assert.equal(typeof app.dailyQuestion(1,29), 'string', '윤일에도 질문');
  assert.equal(typeof app.dailyQuestion(11,31), 'string', '연말에도 질문');
  const els = {'past-banner':{hidden:true},'past-banner-text':{textContent:''}};
  context.document = {getElementById: id => els[id]};
  const realToday = app.koreanToday;
  app.koreanToday = () => new Date(2026, 10, 19);
  Object.assign(app, {startYear:2024, selectedMonth:10, selectedDate:17});
  const e = (y, content) => ({date:`${y}-11-17`, content});
  app.entries = {2024:e(2024,'지난 기록'), 2025:e(2025,''), 2026:e(2026,'')};
  app.updatePastBanner();
  assert.equal(els['past-banner'].hidden, false);
  assert.match(els['past-banner-text'].textContent, /^2024년의 오늘이 기다리고 있어요\. 2026년의 오늘은 아직 비어 있어요\.$/);
  assert.doesNotMatch(els['past-banner-text'].textContent, /\d+개|점/, '개수·점수 표시 없음');
  app.entries[2026] = e(2026,'올해 기록');
  app.updatePastBanner();
  assert.equal(els['past-banner'].hidden, true, '올해를 쓰면 안내 숨김');
  app.entries = {2024:e(2024,''), 2025:e(2025,''), 2026:e(2026,'')};
  app.updatePastBanner();
  assert.equal(els['past-banner'].hidden, true, '지난 기록이 없으면 숨김');
  app.entries = {2024:{date:'2024-11-16',content:'다른 날짜'}, 2026:e(2026,'')};
  app.updatePastBanner();
  assert.equal(els['past-banner'].hidden, true, '이전 날짜의 남은 항목은 무시');
  app.selectedDate = 25; app.entries = {2024:{date:'2024-11-25',content:'지난 기록'}, 2025:{date:'2025-11-25',content:''}};
  app.updatePastBanner();
  assert.match(els['past-banner-text'].textContent, /2025년의 오늘은 아직/, '미래 날짜(2026)는 제외하고 가장 최근 해를 기준');
  app.koreanToday = realToday;
  console.log('오늘의 질문·지난 기록 안내 검사 통과');
  // Music: no picker; the default track's credit is shown and requests leave music to the server default.
  const mus = {'shorts-music-credit':{textContent:''}};
  context.document = {getElementById: id => mus[id] || null};
  app.setupMusic({default:'bright', tracks:[{id:'bright',label:'경쾌한 어쿠스틱',credit:'Redwood Trail — Jason Shaw, CC BY 3.0'},{id:'calm',label:'잔잔한 기타',credit:'Acoustic Meditation — Jason Shaw, CC BY 3.0 US'}]});
  assert.match(mus['shorts-music-credit'].textContent, /Redwood Trail/, '기본 곡 출처 표기');
  assert.equal(app.selectedMusic('shorts-music'), undefined, '선택 칸이 없으면 서버 기본 곡');
  // Cheer line: invite to write today, praise once today is written, a saying on other dates.
  const cheer = {textContent:''};
  context.document = {getElementById: id => id === 'daily-cheer' ? cheer : null};
  const savedToday = app.koreanToday;
  app.koreanToday = () => new Date(2026, 10, 25);
  app.selectedMonth = 10; app.selectedDate = 25; app.entries = {2026: {date:'2026-11-25', content:''}};
  assert.equal(app.cheerState(), 'invite'); app.updateCheer();
  assert.ok(CHEER.invite.includes(cheer.textContent), '오늘 일기가 비어 있으면 작성 권유');
  app.entries[2026].content = '오늘은 산책했다';
  assert.equal(app.cheerState(), 'praise'); app.updateCheer();
  assert.ok(CHEER.praise.includes(cheer.textContent), '오늘 일기를 쓰면 칭찬');
  app.selectedDate = 24;
  assert.equal(app.cheerState(), 'saying'); app.updateCheer();
  assert.ok(CHEER.saying.includes(cheer.textContent), '다른 날짜는 명언·속담');
  assert.equal(app.cheerLine(10, 24, 'saying'), app.cheerLine(10, 24, 'saying'), '같은 날짜는 같은 문구');
  // Diary picture: faint background only once a picture exists; unsafe paths are ignored.
  const classes = new Set(), props = {};
  const wrap = {classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c)}, style:{setProperty:(k,v)=>{props[k]=v;}, removeProperty:k=>{delete props[k];}}};
  context.document = {querySelector: sel => sel === '.diary-section[data-year="2026"]' ? {querySelector: () => wrap} : null};
  app.setDiaryPicture(2026, null);
  assert.ok(!classes.has('has-picture'), '그림 전에는 원래 모습');
  app.setDiaryPicture(2026, '/media/0123456789abcdef0123456789abcdef.png');
  assert.ok(classes.has('has-picture')); assert.equal(props['--diary-picture'], 'url("/media/0123456789abcdef0123456789abcdef.png")');
  app.setDiaryPicture(2026, '/media/x.png") ; background:red');
  assert.ok(!classes.has('has-picture'), '이상한 주소는 배경으로 쓰지 않음');
  // Saved shorts from the sidebar: the selected day in each year that has come.
  app.startYear = 2024; app.selectedMonth = 10; app.selectedDate = 25;
  assert.deepEqual([...app.savedVideoDates()], ['2024-11-25','2025-11-25','2026-11-25']);
  app.selectedDate = 26;
  assert.deepEqual([...app.savedVideoDates()], ['2024-11-26','2025-11-26'], '오지 않은 날은 제외');
  app.koreanToday = savedToday;
  console.log('배경음악 기본 곡·출처 표기, 응원 문구, 일기 배경 그림, 보관한 쇼츠 날짜 검사 통과');
  // Narration: options shown only when the local voice exists; the checkbox decides the request value.
  const opts = [{hidden:true},{hidden:true}];
  const boxes = {'shorts-narration':{checked:true}, 'three-year-narration':{checked:false}};
  context.document = {getElementById: id => boxes[id], querySelectorAll: sel => sel === '.narration-option' ? opts : []};
  app.setupNarration({available:false, credit:'AI 음성'});
  assert.ok(opts.every(o => o.hidden), '음성 모델이 없으면 선택지 숨김');
  assert.equal(app.wantsNarration('shorts-narration'), false, '모델이 없으면 체크돼 있어도 요청하지 않음');
  app.setupNarration({available:true, credit:'AI 음성: Supertonic 3 · F1'});
  assert.ok(opts.every(o => !o.hidden));
  assert.equal(app.wantsNarration('shorts-narration'), true);
  assert.equal(app.wantsNarration('three-year-narration'), false, '체크를 끄면 내레이션 없이');
  assert.equal(app.wantsNarration('missing'), false);
  app.setupNarration(undefined);
  assert.equal(app.narrationAvailable, false, '시연판(설정 없음)에서는 꺼짐');
  console.log('내레이션 선택 검사 통과');
  // Spoken lines ('~구나'): optional, but must pair one-to-one with the scenes before any request is sent.
  const sp = {'shorts-spoken':{value:' 그날 나는, 놓쳤구나. \n\n그래도 걸었구나.'}, 'shorts-captions':{value:'자막1\n자막2\n자막3'}, 'shorts-status':{textContent:''}};
  context.document = {getElementById: id => sp[id]};
  assert.equal(JSON.stringify(app.spokenLines()), JSON.stringify(['그날 나는, 놓쳤구나.', '그래도 걸었구나.']), '빈 줄은 무시');
  let posted = false; const realFetch = context.fetch; context.fetch = () => { posted = true; return Promise.reject(new Error('no')); };
  app.requestInProgress = false; app.shortsEntry = {date:'2024-11-17', content_hash:'h'};
  return app.makeShorts().then(() => {
    assert.equal(posted, false, '줄 수가 다르면 요청하지 않음');
    assert.match(sp['shorts-status'].textContent, /3줄/);
    context.fetch = realFetch;
    context.document = {getElementById: () => undefined};
    assert.equal(app.spokenLines().length, 0, '입력칸이 없으면 자막을 읽음');
    console.log('읽어 줄 문장(~구나) 검사 통과');
  });
}
