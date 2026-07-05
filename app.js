const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORAGE_KEY = 'geographyQuizApp.v2';
const LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfycby7H7Co9ssRTBZibkZFLYpL3Ns0ZEpYjIP52S4aaM4-wbvKIbnfSgZ_O7-vGEaYex2n/exec';
const LOG_DEVICE_KEY = 'geographyQuizApp.anonymousDeviceId.v1';
const pendingLogPixels = [];
const UNITS = ['地形','気候','農業','工業','資源・エネルギー','人口・都市','交通・通信・貿易','国家・民族・宗教','地誌','地図問題'];
const UNIT_ICONS = {'地形':'⛰️','気候':'🌤️','農業':'🌱','工業':'🏭','資源・エネルギー':'⚡','人口・都市':'👥','交通・通信・貿易':'🚢','国家・民族・宗教':'🕌','地誌':'🌏','地図問題':'🗾'};
const CATEGORY_GROUPS = [
  {id:'natural', title:'系統地理（自然）', icon:'🌋', description:'地形・気候を自然環境の骨格として確認します。', units:['地形','気候']},
  {id:'human', title:'系統地理（人文）', icon:'🏙️', description:'農業・工業・資源・人口・都市・交通・国家を整理します。', units:['農業','工業','資源・エネルギー','人口・都市','交通・通信・貿易','国家・民族・宗教']},
  {id:'regional', title:'地誌', icon:'🌏', description:'地域ごとの自然・産業・社会を結びつけます。', units:['地誌']},
  {id:'map', title:'地図', icon:'🗾', description:'地形図・主題図・位置認識を反復します。', units:['地図問題']}
];
const QUESTIONS = QUESTION_BANK;
const LEVEL_ORDER = ['共通テスト基礎','共通テスト標準','中級','入試実践','私大・国公立基礎'];
const ROUTE_THEMES = {
  '地形': {icon:'🥾', title:'等高線の山道を進む', checkpoints:['山麓','谷口','段丘面','山頂']},
  '気候': {icon:'🌤️', title:'風と雲のルートを進む', checkpoints:['赤道付近','乾燥帯','温帯','高緯度']},
  '農業': {icon:'🌱', title:'畑から市場へ進む', checkpoints:['畑','集荷所','市場','港']},
  '工業': {icon:'🚆', title:'工業地帯を結ぶ', checkpoints:['原料','工場','輸送','市場']},
  '資源・エネルギー': {icon:'⚡', title:'資源ルートをたどる', checkpoints:['鉱山','油田','発電所','都市']},
  '人口・都市': {icon:'🏙️', title:'都市の階層をたどる', checkpoints:['村落','地方都市','大都市','都市圏']},
  '交通・通信・貿易': {icon:'🚢', title:'物流ルートを進む', checkpoints:['港','航路','結節点','市場']},
  '国家・民族・宗教': {icon:'🧭', title:'地域の境界をたどる', checkpoints:['国家','民族','言語','宗教']},
  '地誌': {icon:'🌏', title:'世界の地域を巡る', checkpoints:['自然','産業','都市','地域性']},
  '地図問題': {icon:'🗾', title:'地図上の地点を進む', checkpoints:['方位','縮尺','等高線','読図']}
};

const state = {
  screen: 'home', mode: 'unit', selectedUnit: '地形', selectedGroup: null, queue: [], currentIndex: 0,
  selectedChoice: null, revealed: false, hintVisible: false, history: ['home'],
  searchQuery: '', selectedTag: null, searchComposing: false,
  data: loadData()
};

function defaultData(){
  return {
    answers: {},
    dailyGoal: 20,
    reminder: '20:00',
    notifications: true,
    darkMode: false,
    today: todayKey(),
    todayCount: 0,
    dailyHistory: {},
    streak: 0,
    lastStudyDate: null
  };
}
function loadData(){
  try { return normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return defaultData(); }
}
function saveData(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); }
  catch { toast('学習記録を保存できませんでした'); }
}
function anonymousDeviceId(){
  try {
    let id = localStorage.getItem(LOG_DEVICE_KEY);
    if(!id){
      id = crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(LOG_DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'storage-disabled';
  }
}
function logUsage(type, detail={}){
  if(!LOG_ENDPOINT) return;
  try {
    const payload = {
      type,
      screen: detail.screen || state?.screen || '',
      unit: detail.unit || state?.selectedUnit || '',
      questionId: detail.questionId || '',
      judge: detail.judge || '',
      deviceId: anonymousDeviceId(),
      v: '26',
      t: Date.now()
    };
    const url = new URL(LOG_ENDPOINT);
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value));
    const pixel = new Image();
    pendingLogPixels.push(pixel);
    const release = () => {
      const index = pendingLogPixels.indexOf(pixel);
      if(index >= 0) pendingLogPixels.splice(index, 1);
    };
    pixel.onload = release;
    pixel.onerror = release;
    pixel.src = url.toString();
  } catch {}
}
function dateKey(date=new Date()){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function todayKey(){ return dateKey(); }
function normalizeData(data){
  const normalized = {...defaultData(), ...(data || {})};
  normalized.answers = normalized.answers && typeof normalized.answers === 'object' ? normalized.answers : {};
  normalized.dailyGoal = Math.max(1, Number(normalized.dailyGoal) || 20);
  normalized.today = normalized.today || todayKey();
  normalized.todayCount = Math.max(0, Number(normalized.todayCount) || 0);
  normalized.streak = Math.max(0, Number(normalized.streak) || 0);
  normalized.dailyHistory = normalized.dailyHistory && typeof normalized.dailyHistory === 'object' ? normalized.dailyHistory : {};
  normalized.dailyHistory[normalized.today] = Math.max(Number(normalized.dailyHistory[normalized.today]) || 0, normalized.todayCount);
  return normalized;
}
function writeDailyHistory(date=state.data.today, count=state.data.todayCount){
  state.data.dailyHistory = state.data.dailyHistory && typeof state.data.dailyHistory === 'object' ? state.data.dailyHistory : {};
  state.data.dailyHistory[date] = Math.max(Number(state.data.dailyHistory[date]) || 0, Number(count) || 0);
}
function ensureToday(){
  const today = todayKey();
  if(state.data.today !== today){
    writeDailyHistory(state.data.today, state.data.todayCount);
    state.data.today = today;
    state.data.todayCount = Number(state.data.dailyHistory?.[today]) || 0;
    writeDailyHistory();
    saveData();
  } else {
    writeDailyHistory();
  }
}
function setTitle(title, eyebrow='大学受験対策'){
  $('#screenTitle').textContent = title;
  $('#eyebrow').textContent = eyebrow;
  $('#backBtn').classList.toggle('hidden', state.history.length <= 1);
  $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.nav === navForScreen(state.screen)));
}
function navForScreen(screen){
  if(['home','search'].includes(screen)) return 'home';
  if(['units','unitLevel','difficulty','quiz'].includes(screen)) return 'units';
  if(screen === 'weak') return 'weak';
  if(screen === 'records') return 'records';
  if(screen === 'settings') return 'settings';
  return '';
}
function go(screen, push=true){
  if(push && state.screen !== screen) state.history.push(screen);
  state.screen = screen;
  render();
}
function back(){
  if(state.history.length > 1){ state.history.pop(); state.screen = state.history[state.history.length-1]; render(); }
}
function toast(msg){
  const el = document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>el.remove(), 1700);
}
function answered(q){ return state.data.answers[q.id] || {correct:0,wrong:0,mid:0,last:null,status:null}; }
function recordStudy(q, status){
  ensureToday();
  const rec = answered(q);
  if(status === 'good') rec.correct += 1;
  if(status === 'bad') rec.wrong += 1;
  if(status === 'mid') rec.mid += 1;
  rec.status = status;
  rec.last = new Date().toISOString();
  state.data.answers[q.id] = rec;
  state.data.todayCount += 1;
  writeDailyHistory();
  updateStreak();
  saveData();
  logUsage('answer', {screen: state.screen, unit: q.unit, questionId: q.id, judge: status});
}
function updateStreak(){
  const today = todayKey();
  if(state.data.lastStudyDate !== today){
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = dateKey(yesterdayDate);
    state.data.streak = state.data.lastStudyDate === yesterday ? state.data.streak + 1 : 1;
    state.data.lastStudyDate = today;
  }
}
function stats(){
  const vals = Object.values(state.data.answers);
  const good = vals.reduce((a,b)=>a+b.correct,0);
  const bad = vals.reduce((a,b)=>a+b.wrong,0);
  const mid = vals.reduce((a,b)=>a+b.mid,0);
  const total = good + bad + mid;
  const weakIds = Object.entries(state.data.answers).filter(([id,r]) => findQuestionById(id) && (r.status === 'bad' || r.status === 'mid')).map(([id])=>id);
  return {good,bad,mid,total,accuracy: total ? Math.round(good/total*100) : 0, weakIds};
}
function dailyGoalStatus(){
  const goal = Math.max(1, Number(state.data.dailyGoal) || 20);
  const today = Math.max(0, Number(state.data.todayCount) || 0);
  const remain = Math.max(goal - today, 0);
  const pct = Math.min(100, Math.round(today / goal * 100));
  return {goal, today, remain, pct, achieved: today >= goal};
}
function dailyGoalMessage(goalStatus){
  const streak = Number(state.data.streak) || 0;
  if(goalStatus.achieved){
    return streak ? `今日の目標達成。連続${streak}日の学習を記録中です。` : '今日の目標達成。よいペースです。';
  }
  if(goalStatus.today === 0){
    return streak ? `連続${streak}日中です。まずは1問解いて流れをつなげましょう。` : 'まずは1問から始めましょう。';
  }
  return `あと${goalStatus.remain}問で今日の目標です。`;
}
function streakMessage(){
  const streak = Number(state.data.streak) || 0;
  if(streak >= 7) return `連続${streak}日です。短時間でも毎日触れる流れができています。`;
  if(streak > 0) return `連続${streak}日です。今日も1問記録すると継続がつながります。`;
  return 'まだ連続学習は始まっていません。今日の最初の記録から始まります。';
}
function recentDailyHistory(days=7){
  const today = new Date();
  return Array.from({length: days}, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    const key = dateKey(date);
    return {key, label: `${date.getMonth() + 1}/${date.getDate()}`, count: Number(state.data.dailyHistory?.[key]) || 0};
  });
}
function exportStudyData(){
  ensureToday();
  const payload = {
    app: 'geography-quiz-app',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: state.data
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `geography-quiz-record-${todayKey()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('学習データを書き出しました');
}
function importStudyDataFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = parsed.data || parsed;
      if(!imported || typeof imported !== 'object' || !imported.answers) throw new Error('invalid data');
      if(!confirm('現在の学習記録を読み込んだデータで置き換えます。実行しますか？')) return;
      state.data = normalizeData(imported);
      ensureToday();
      saveData();
      toast('学習データを読み込みました');
      render();
    } catch {
      toast('読み込めないファイルです');
    }
  };
  reader.readAsText(file);
}
const UNIT_SESSION_SIZE = 20;

function questionsByUnit(unit){
  return QUESTIONS.filter(q => q.category === unit || q.unit === unit);
}
function randomItem(items){
  return items[Math.floor(Math.random() * items.length)];
}
function questionsByUnitTier(unit, tier){
  return questionsByUnit(unit).filter(q => {
    if(tier === 'intermediate') return q.level === '中級';
    if(tier === 'advanced') return q.level === '入試実践';
    return q.level !== '中級' && q.level !== '入試実践';
  });
}
function unitTierQuestions(unit, tier){
  const qs = questionsByUnitTier(unit, tier);
  const explicitSets = explicitUnitSessionSets(qs);
  const sets = explicitSets.length ? explicitSets : chunkedUnitSessionSets(qs);
  return sets.length ? randomItem(sets) : qs;
}
function hasUnitTierChoice(unit){
  return ['basic', 'intermediate', 'advanced']
    .filter(tier => questionsByUnitTier(unit, tier).length > 0)
    .length > 1;
}
function unitTierProgress(unit, tier){
  const qs = questionsByUnitTier(unit, tier);
  const attempted = qs.filter(q=>state.data.answers[q.id]?.status).length;
  const mastered = qs.filter(q=>state.data.answers[q.id]?.status === 'good').length;
  return {total: qs.length, attempted, mastered, pct: qs.length ? Math.round(attempted/qs.length*100) : 0};
}
function explicitUnitSessionSets(qs){
  const sets = new Map();
  qs.forEach(q => {
    const setName = q.sessionSet || q.quizSet || q.set;
    if(!setName) return;
    if(!sets.has(setName)) sets.set(setName, []);
    sets.get(setName).push(q);
  });
  const values = [...sets.values()].filter(set => set.length > 0);
  const assigned = values.reduce((sum, set) => sum + set.length, 0);
  return values.length >= 2 && assigned === qs.length && values.every(set => set.length === UNIT_SESSION_SIZE) ? values : [];
}
function chunkedUnitSessionSets(qs){
  if(qs.length < UNIT_SESSION_SIZE * 2 || qs.length % UNIT_SESSION_SIZE !== 0) return [];
  return Array.from({length: qs.length / UNIT_SESSION_SIZE}, (_, index) =>
    qs.slice(index * UNIT_SESSION_SIZE, (index + 1) * UNIT_SESSION_SIZE)
  );
}
function unitSessionQuestions(unit){
  const qs = questionsByUnit(unit);
  const explicitSets = explicitUnitSessionSets(qs);
  const sets = explicitSets.length ? explicitSets : chunkedUnitSessionSets(qs);
  return sets.length ? randomItem(sets) : qs;
}
function questionsByLevel(level){
  return QUESTIONS.filter(q => q.level === level);
}
function findQuestionById(id){
  return QUESTIONS.find(q => q.id === id);
}
function normalizeText(value){
  return String(value || '').trim().toLowerCase();
}
function searchableText(q){
  return normalizeText([
    q.categoryGroup, q.category, q.unit, q.level, q.question, q.explanation, q.hint,
    ...q.choices, ...q.tags
  ].join(' '));
}
function allTags(limit=24){
  const counts = new Map();
  QUESTIONS.forEach(q => q.tags.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts.entries()]
    .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .slice(0, limit)
    .map(([name,count]) => ({name,count}));
}
function searchQuestions(query=state.searchQuery, tag=state.selectedTag){
  const text = normalizeText(query);
  return QUESTIONS.filter(q => {
    const tagMatched = !tag || q.tags.includes(tag);
    const textMatched = !text || searchableText(q).includes(text);
    return tagMatched && textMatched;
  });
}
function allLevels(){
  const levels = [...new Set(QUESTIONS.map(q => q.level))];
  return levels.sort((a,b) => {
    const ai = LEVEL_ORDER.indexOf(a);
    const bi = LEVEL_ORDER.indexOf(b);
    if(ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b, 'ja');
  });
}
function unitProgress(unit){
  const qs = questionsByUnit(unit);
  const attempted = qs.filter(q=>state.data.answers[q.id]?.status).length;
  const mastered = qs.filter(q=>state.data.answers[q.id]?.status === 'good').length;
  return {total: qs.length, attempted, mastered, pct: qs.length ? Math.round(attempted/qs.length*100) : 0};
}
function levelProgress(level){
  const qs = questionsByLevel(level);
  const attempted = qs.filter(q=>state.data.answers[q.id]?.status).length;
  const mastered = qs.filter(q=>state.data.answers[q.id]?.status === 'good').length;
  return {total: qs.length, attempted, mastered, pct: qs.length ? Math.round(attempted/qs.length*100) : 0};
}
function unitAccuracy(unit){
  const qs = questionsByUnit(unit);
  const totals = qs.reduce((acc,q)=>{
    const rec = answered(q);
    acc.good += rec.correct || 0;
    acc.mid += rec.mid || 0;
    acc.bad += rec.wrong || 0;
    return acc;
  }, {good:0, mid:0, bad:0});
  const attempts = totals.good + totals.mid + totals.bad;
  return {...totals, attempts, accuracy: attempts ? Math.round(totals.good / attempts * 100) : 0};
}
function shouldShowQuizRoute(){
  return ['unit','unitBasic','unitIntermediate','unitAdvanced'].includes(state.mode) && state.queue.length >= 5 && state.queue.length <= UNIT_SESSION_SIZE;
}
function quizRouteTheme(unit){
  return ROUTE_THEMES[unit] || {icon:'📍', title:'チェックポイントを進む', checkpoints:['1区','2区','3区','到達']};
}
function routeCheckpointCount(total){
  return Math.min(4, Math.max(1, Math.ceil(total / 5)));
}
function routeCompletedCheckpoints(){
  return Math.floor(state.currentIndex / 5);
}
function renderQuizRoute(root){
  if(!shouldShowQuizRoute()) return;
  const total = state.queue.length;
  const current = state.currentIndex + 1;
  const travelPct = total > 1 ? Math.round((state.currentIndex / (total - 1)) * 100) : 100;
  const checkpointCount = routeCheckpointCount(total);
  const completed = routeCompletedCheckpoints();
  const theme = quizRouteTheme(currentQuestion()?.unit || state.selectedUnit);
  const checkpoints = Array.from({length: checkpointCount}, (_, index) => {
    const checkpointQuestion = Math.min((index + 1) * 5, total);
    const left = Math.round((checkpointQuestion - 1) / Math.max(total - 1, 1) * 100);
    const label = theme.checkpoints[index] || `${checkpointQuestion}問`;
    const stateClass = index < completed ? 'done' : index === completed ? 'current' : '';
    return `<span class="route-checkpoint ${stateClass}" style="left:${left}%"><b>${checkpointQuestion}</b><small>${label}</small></span>`;
  }).join('');
  const section = document.createElement('section');
  section.className = 'card quiz-route-card';
  section.innerHTML = `
    <div class="route-head">
      <div><b>${theme.title}</b><small>5問ごとに小さな到達地点があります</small></div>
      <span class="route-count">${current}/${total}</span>
    </div>
    <div class="route-line-wrap">
      <div class="route-line"><i style="width:${travelPct}%"></i></div>
      <div class="route-traveler" style="left:${travelPct}%"><span>${theme.icon}</span></div>
      <div class="route-checkpoints">${checkpoints}</div>
    </div>`;
  root.append(section);
}

function render(){
  ensureToday();
  const screen = $('#screen');
  screen.innerHTML = '';
  if(state.screen === 'home') renderHome(screen);
  if(state.screen === 'units') renderUnits(screen);
  if(state.screen === 'unitLevel') renderUnitLevel(screen);
  if(state.screen === 'difficulty') renderDifficulty(screen);
  if(state.screen === 'quiz') renderQuiz(screen);
  if(state.screen === 'weak') renderWeak(screen);
  if(state.screen === 'search') renderSearch(screen);
  if(state.screen === 'records') renderRecords(screen);
  if(state.screen === 'settings') renderSettings(screen);
}
function renderHome(root){
  setTitle('地理一問一答');
  root.append($('#homeTemplate').content.cloneNode(true));
  const s = stats();
  const goal = dailyGoalStatus();
  $('#todayCount').textContent = `${goal.today}/${goal.goal}問`;
  $('#streakCount').textContent = `${state.data.streak || 0}日`;
  $('#goalRemain').textContent = goal.achieved ? '達成' : `${goal.remain}問`;
  $('#goalMessage').textContent = dailyGoalMessage(goal);
  $('#goalProgress').style.width = `${goal.pct}%`;
  $('#accuracy').textContent = `${s.accuracy}%`;
  $('#weakCount').textContent = `${s.weakIds.length}問`;
  $$('[data-action]', root).forEach(btn => {
    if(btn.dataset.action === 'start') bindStartControl(btn);
    else btn.addEventListener('click', handleHomeClick);
  });
}
function startHomeLearning(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  if(state.screen !== 'home') return;
  state.selectedGroup = null;
  go('units');
}
function bindStartControl(el){
  const activate = e => startHomeLearning(e);
  el.addEventListener('click', activate);
  el.addEventListener('pointerup', e => { if(e.pointerType !== 'mouse') activate(e); });
  el.addEventListener('touchend', activate, {passive:false});
  el.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') activate(e); });
}
function handleHomeClick(e){
  const a = e.target.closest('[data-action]')?.dataset.action;
  if(!a) return;
  if(a==='start') startHomeLearning(e);
  if(a==='recommended') selectUnitForQuiz('地形');
  if(a==='units') { state.selectedGroup=null; go('units'); }
  if(a==='group') { state.selectedGroup=e.target.closest('[data-group]').dataset.group; go('units'); }
  if(a==='random') startQuiz('random');
  if(a==='difficulty') go('difficulty');
  if(a==='search') { state.searchQuery=''; state.selectedTag=null; go('search'); }
  if(a==='tags') { state.searchQuery=''; state.selectedTag=null; go('search'); }
  if(a==='weak') go('weak');
  if(a==='records') go('records');
}
function renderUnits(root){
  if(!state.selectedGroup){
    setTitle('目次', '4つの入口');
    const wrap = document.createElement('section'); wrap.className='category-list';
    CATEGORY_GROUPS.forEach(group=>{
      const total = group.units.reduce((sum,unit)=>sum+questionsByUnit(unit).length,0);
      const attempted = group.units.reduce((sum,unit)=>sum+unitProgress(unit).attempted,0);
      const pct = total ? Math.round(attempted/total*100) : 0;
      const card = document.createElement('button'); card.className='category-card'; card.dataset.group=group.id;
      card.innerHTML = `<div class="category-icon">${group.icon}</div><div><h3>${group.title}</h3><p>${group.description}</p><div class="progress"><i style="width:${pct}%"></i></div></div><small>${attempted}/${total}問</small>`;
      wrap.append(card);
    });
    root.append(wrap);
    $$('.category-card', root).forEach(btn=>btn.addEventListener('click',()=>{state.selectedGroup=btn.dataset.group; render();}));
    return;
  }
  const group = CATEGORY_GROUPS.find(g=>g.id===state.selectedGroup);
  setTitle(group.title, '単元別に反復');
  const wrap = document.createElement('section'); wrap.className='unit-list';
  wrap.innerHTML = `<div class="pill-row"><button class="pill" data-group-back="1">目次へ</button><button class="pill active">${group.title}</button></div>`;
  group.units.forEach(unit=>{
    const p = unitProgress(unit);
    const card = document.createElement('button'); card.className='unit-card'; card.dataset.unit=unit;
    card.innerHTML = `<div class="unit-icon">${UNIT_ICONS[unit]}</div><div><h3>${unit}</h3><p class="unit-meta">定着 ${p.mastered}問</p><div class="progress"><i style="width:${p.pct}%"></i></div></div><small>${p.attempted}/${p.total}問</small>`;
    wrap.append(card);
  });
  root.append(wrap);
  $('[data-group-back]', root).addEventListener('click',()=>{state.selectedGroup=null; render();});
  $$('.unit-card', root).forEach(btn => btn.addEventListener('click',()=>selectUnitForQuiz(btn.dataset.unit)));
}
function selectUnitForQuiz(unit){
  state.selectedUnit = unit;
  if(hasUnitTierChoice(unit)) go('unitLevel');
  else startQuiz('unit', unit);
}
function renderUnitLevel(root){
  const unit = state.selectedUnit || '地形';
  setTitle(unit, 'レベルを選ぶ');
  const wrap = document.createElement('section');
  wrap.className = 'level-list unit-level-list';
  const tiers = [
    {id:'basic', title:'初級編', description:'基礎・標準の確認', icon:'🌱'},
    {id:'intermediate', title:'中級編', description:'因果関係を深める', icon:'⛰️'},
    {id:'advanced', title:'入試実践編', description:'文章資料を読み切る', icon:'🎓'}
  ];
  tiers.forEach(tier => {
    const p = unitTierProgress(unit, tier.id);
    if(!p.total) return;
    const card = document.createElement('button');
    card.className = 'level-card unit-level-card';
    card.dataset.tier = tier.id;
    card.innerHTML = `<div class="level-icon">${tier.icon}</div><div><h3>${tier.title}</h3><p>${tier.description}・定着 ${p.mastered}問</p><div class="progress"><i style="width:${p.pct}%"></i></div></div><small>${p.attempted}/${p.total}問</small>`;
    wrap.append(card);
  });
  root.append(wrap);
  const modeByTier = {basic: 'unitBasic', intermediate: 'unitIntermediate', advanced: 'unitAdvanced'};
  $$('.unit-level-card', root).forEach(btn => btn.addEventListener('click',()=>startQuiz(modeByTier[btn.dataset.tier] || 'unitBasic', unit)));
}
function startQuiz(mode, unit=null, customQueue=null){
  state.mode = mode; state.selectedUnit = unit || '地形';
  let q = customQueue;
  if(!q){
    if(mode==='unit') q = unitSessionQuestions(unit);
    if(mode==='unitBasic') q = unitTierQuestions(unit, 'basic');
    if(mode==='unitIntermediate') q = unitTierQuestions(unit, 'intermediate');
    if(mode==='unitAdvanced') q = unitTierQuestions(unit, 'advanced');
    if(mode==='level') q = questionsByLevel(unit);
    if(mode==='random') q = [...QUESTIONS].sort(()=>Math.random()-.5);
    if(mode==='weak') q = stats().weakIds.map(findQuestionById).filter(Boolean);
  }
  if(!q.length){ toast('対象の問題がまだありません'); return; }
  state.queue = q; state.currentIndex = 0; state.selectedChoice = null; state.revealed = false; state.hintVisible = false;
  logUsage('start_quiz', {screen: 'quiz', unit: state.selectedUnit, questionId: q[0]?.id || '', judge: mode});
  go('quiz');
}
function currentQuestion(){ return state.queue[state.currentIndex]; }
function renderQuiz(root){
  const q = currentQuestion();
  setTitle(q.unit, `${state.currentIndex+1}/${state.queue.length}問　${q.level}`);
  renderQuizRoute(root);
  const card = document.createElement('section'); card.className='card quiz-card';
  const pct = Math.round(((state.currentIndex+1)/state.queue.length)*100);
  card.innerHTML = `<div class="meta"><span>Q</span><span>${state.currentIndex+1}/${state.queue.length}</span></div><div class="progress"><i style="width:${pct}%"></i></div><p class="question-text">${q.question}</p><div class="choices"></div><button class="hint-toggle" data-quiz="hint" aria-expanded="${state.hintVisible}">💡 ${state.hintVisible?'ヒントを隠す':'ヒントを見る'}</button><div class="hint ${state.hintVisible?'':'hidden'}">ヒント：${q.hint}</div><div class="action-row"><button class="secondary" data-quiz="prev">前へ</button><button class="primary" data-quiz="reveal">答えを見る</button></div>`;
  const choices = $('.choices', card);
  q.choices.forEach((choice,i)=>{
    const btn=document.createElement('button'); btn.className='question-option'; btn.dataset.choice=i;
    btn.innerHTML=`<span class="radio"></span><span>${String.fromCharCode(65+i)}. ${choice}</span>`;
    if(state.selectedChoice===i) btn.classList.add('selected');
    if(state.revealed && i===q.answer) btn.classList.add('correct');
    if(state.revealed && state.selectedChoice===i && i!==q.answer) btn.classList.add('wrong');
    choices.append(btn);
  });
  root.append(card);
  if(state.revealed) renderAnswer(root,q);
  $$('.question-option', root).forEach(btn=>btn.addEventListener('click',()=>{ if(!state.revealed){state.selectedChoice=Number(btn.dataset.choice); renderQuizAgain();} }));
  $('[data-quiz="hint"]', root).addEventListener('click',()=>{ state.hintVisible = !state.hintVisible; renderQuizAgain(); });
  $('[data-quiz="reveal"]', root).addEventListener('click',()=>{ state.revealed=true; renderQuizAgain(); });
  $('[data-quiz="prev"]', root).addEventListener('click',()=>prevQuestion());
}
function renderQuizAgain(){ state.screen='quiz'; render(); }
function renderAnswer(root,q){
  const sec=document.createElement('section'); sec.className='card answer-card';
  sec.innerHTML=`<h2>答えと解説</h2><div class="answer-main">答え：${String.fromCharCode(65+q.answer)}. ${q.choices[q.answer]}</div><p class="explanation">${q.explanation}</p><div class="tag-row">${q.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`;
  root.append(sec);
  const judge=document.createElement('section'); judge.className='card';
  judge.innerHTML=`<h2>理解度を記録</h2><div class="judge-row"><button class="judge good" data-judge="good">✓<br>できた</button><button class="judge mid" data-judge="mid">？<br>あやしい</button><button class="judge bad" data-judge="bad">×<br>できない</button></div><div class="action-row"><button class="secondary" data-next="retry">もう一度</button><button class="primary" data-next="next">次へ</button></div>`;
  root.append(judge);
  $$('[data-judge]', judge).forEach(btn=>btn.addEventListener('click',()=>{recordStudy(q,btn.dataset.judge); toast('記録しました'); nextQuestion();}));
  $('[data-next="next"]', judge).addEventListener('click',()=>nextQuestion());
  $('[data-next="retry"]', judge).addEventListener('click',()=>{state.selectedChoice=null; state.revealed=false; state.hintVisible=false; renderQuizAgain();});
}
function nextQuestion(){
  if(state.currentIndex < state.queue.length-1){ state.currentIndex++; state.selectedChoice=null; state.revealed=false; state.hintVisible=false; render(); }
  else { toast('このセットは完了です'); go('records'); }
}
function prevQuestion(){
  if(state.currentIndex > 0){ state.currentIndex--; state.selectedChoice=null; state.revealed=false; state.hintVisible=false; render(); }
}
function renderDifficulty(root){
  setTitle('難度別出題','レベルで選ぶ');
  const wrap=document.createElement('section'); wrap.className='level-list';
  allLevels().forEach(level=>{
    const p = levelProgress(level);
    const card=document.createElement('button'); card.className='level-card'; card.dataset.level=level;
    card.innerHTML=`<div><h3>${level}</h3><p>着手 ${p.attempted}問・定着 ${p.mastered}問</p><div class="progress"><i style="width:${p.pct}%"></i></div></div><small>${p.total}問</small>`;
    wrap.append(card);
  });
  root.append(wrap);
  $$('.level-card', root).forEach(btn=>btn.addEventListener('click',()=>startQuiz('level',btn.dataset.level)));
}
function renderSearch(root){
  setTitle('問題検索','タグ別復習');
  const results = searchQuestions();
  const sec=document.createElement('section'); sec.className='search-panel';
  sec.innerHTML=`<div class="card search-card">
    <label class="search-label" for="questionSearch">問題文・解説・用語で検索</label>
    <input id="questionSearch" class="search-input" type="search" placeholder="例：扇状地、季節風、工業" autocomplete="off">
    <div class="search-meta"><span>${state.selectedTag ? `#${state.selectedTag}` : 'タグ未選択'}</span><span>${results.length}問</span></div>
    <div class="search-actions"><button class="secondary" data-search="clear">条件をクリア</button><button class="primary" data-search="start" ${results.length?'':'disabled'}>この条件で解く</button></div>
  </div>`;
  const tagCard=document.createElement('section'); tagCard.className='card';
  tagCard.innerHTML='<h2>タグから復習</h2><div class="tag-cloud"></div>';
  const cloud=$('.tag-cloud', tagCard);
  allTags().forEach(tag=>{
    const btn=document.createElement('button'); btn.className='tag tag-button'; btn.dataset.tag=tag.name;
    btn.classList.toggle('active', state.selectedTag === tag.name);
    btn.textContent=`#${tag.name} ${tag.count}`;
    cloud.append(btn);
  });
  const list=document.createElement('section'); list.className='search-results';
  if(!results.length){
    list.innerHTML='<div class="card empty">条件に合う問題がありません。検索語を短くするか、タグを外してください。</div>';
  } else {
    results.slice(0, 60).forEach(q=>{
      const item=document.createElement('button'); item.className='search-result'; item.dataset.id=q.id;
      const status=answered(q).status;
      const badge=status==='good'?'できた':status==='mid'?'あやしい':status==='bad'?'できない':'未学習';
      item.innerHTML=`<div><div class="result-head"><span class="tag">${q.unit}</span><span class="badge ${status || ''}">${badge}</span></div><h3>${q.question}</h3><small>${q.tags.map(t=>`#${t}`).join(' ')}</small></div>`;
      list.append(item);
    });
    if(results.length > 60){
      const more=document.createElement('div'); more.className='card empty'; more.textContent=`表示は先頭60問までです。検索語やタグで絞り込むと探しやすくなります。`;
      list.append(more);
    }
  }
  root.append(sec,tagCard,list);
  const input=$('#questionSearch', root);
  input.value = state.searchQuery;
  const refreshSearch = () => {
    render();
    const nextInput=$('#questionSearch');
    if(nextInput){
      nextInput.focus();
      nextInput.setSelectionRange(state.searchQuery.length, state.searchQuery.length);
    }
  };
  input.addEventListener('compositionstart',()=>{ state.searchComposing = true; });
  input.addEventListener('compositionend',()=>{
    state.searchComposing = false;
    state.searchQuery=input.value;
    refreshSearch();
  });
  input.addEventListener('input',()=>{
    state.searchQuery=input.value;
    if(!state.searchComposing) refreshSearch();
  });
  $('[data-search="clear"]', root).addEventListener('click',()=>{ state.searchQuery=''; state.selectedTag=null; render(); });
  $('[data-search="start"]', root).addEventListener('click',()=>startQuiz('search',null,results));
  $$('.tag-button', root).forEach(btn=>btn.addEventListener('click',()=>{
    state.selectedTag = state.selectedTag === btn.dataset.tag ? null : btn.dataset.tag;
    render();
  }));
  $$('.search-result', root).forEach(item=>item.addEventListener('click',()=>startQuiz('search',null,[findQuestionById(item.dataset.id)])));
}
function renderWeak(root){
  setTitle('苦手復習','復習優先');
  const weak = stats().weakIds.map(findQuestionById).filter(Boolean);
  const badOnly = weak.filter(q => answered(q).status === 'bad');
  const midOnly = weak.filter(q => answered(q).status === 'mid');
  const sec=document.createElement('section'); sec.className='weak-list';
  sec.innerHTML=`<div class="review-choice-grid">
    <button class="review-choice" data-weak-start="all" ${weak.length?'':'disabled'}><b>苦手をまとめて復習</b><span>${weak.length}問</span><small>あやしい・できないをまとめて確認</small></button>
    <button class="review-choice bad" data-weak-start="bad" ${badOnly.length?'':'disabled'}><b>間違えた問題だけ復習</b><span>${badOnly.length}問</span><small>できないに記録した問題だけ</small></button>
    <button class="review-choice mid" data-weak-start="mid" ${midOnly.length?'':'disabled'}><b>あやしい問題だけ復習</b><span>${midOnly.length}問</span><small>迷った問題を短時間で確認</small></button>
  </div>`;
  if(!weak.length){ sec.innerHTML += `<div class="card empty">苦手問題はまだありません。<br>問題を解いて「あやしい」または「できない」を記録すると、ここに表示されます。</div>`; }
  weak.forEach(q=>{
    const r=answered(q); const cls=r.status==='bad'?'bad':'mid'; const label=r.status==='bad'?'できない':'あやしい';
    const item=document.createElement('button'); item.className='weak-item'; item.dataset.id=q.id;
    item.innerHTML=`<div><span class="tag">${q.unit}</span><h3>${q.question}</h3><small>関連語：${q.tags.join('・')}</small></div><span class="badge ${cls}">${label}</span>`;
    sec.append(item);
  });
  root.append(sec);
  $$('[data-weak-start]', root).forEach(item=>item.addEventListener('click',()=>{
    const list = item.dataset.weakStart === 'bad' ? badOnly : item.dataset.weakStart === 'mid' ? midOnly : weak;
    startQuiz('weak',null,list);
  }));
  $$('.weak-item', root).forEach(item=>item.addEventListener('click',()=>startQuiz('weak',null,[findQuestionById(item.dataset.id)])));
}
function renderRecords(root){
  setTitle('学習記録','到達状況');
  const s=stats();
  const card=document.createElement('section'); card.className='card';
  card.innerHTML=`<div class="pill-row"><button class="pill active">7日間</button><button class="pill">30日間</button><button class="pill">全期間</button></div><div class="record-top"><div class="donut"><span>正答率<br>${s.accuracy}%</span></div><div class="legend"><div><span class="dot blue"></span>正答 ${s.good}問</div><div><span class="dot green"></span>復習待ち ${s.mid}問</div><div><span class="dot orange"></span>誤答 ${s.bad}問</div></div></div>`;
  const stat=document.createElement('section'); stat.className='card stats-card';
  stat.innerHTML=`<div class="stats-row"><div><small>総学習数</small><strong>${s.total}問</strong></div><div><small>本日の学習</small><strong>${state.data.todayCount}問</strong></div><div><small>連続学習</small><strong>${state.data.streak}日</strong></div></div>`;
  const streak=document.createElement('section'); streak.className='card streak-card';
  streak.innerHTML=`<div class="section-head"><h2>連続学習</h2><strong>${state.data.streak || 0}日</strong></div><p class="goal-message">${streakMessage()}</p>`;
  const history=document.createElement('section'); history.className='card';
  history.innerHTML='<h2>日別学習履歴</h2><div class="history-list"></div>';
  const historyList=$('.history-list', history);
  const recentHistory = recentDailyHistory(7);
  const historyMax = Math.max(dailyGoalStatus().goal, ...recentHistory.map(day=>day.count), 1);
  recentHistory.forEach(day=>{
    const pct = Math.min(100, Math.round(day.count / historyMax * 100));
    const row=document.createElement('div'); row.className='history-item';
    row.innerHTML=`<span>${day.label}</span><div class="progress"><i style="width:${pct}%"></i></div><b>${day.count}問</b>`;
    historyList.append(row);
  });
  const bars=document.createElement('section'); bars.className='card';
  bars.innerHTML='<h2>単元別の進捗</h2><div class="bar-list"></div>';
  const list=$('.bar-list', bars);
  UNITS.forEach(unit=>{
    const p = unitProgress(unit);
    const div=document.createElement('div'); div.className='bar-item'; div.innerHTML=`<b>${UNIT_ICONS[unit]} ${unit}</b><div class="progress"><i style="width:${p.pct}%"></i></div><small>${p.attempted}/${p.total}</small>`; list.append(div);
  });
  const accuracy=document.createElement('section'); accuracy.className='card';
  accuracy.innerHTML='<h2>単元別正答率</h2><div class="accuracy-list"></div>';
  const accuracyList=$('.accuracy-list', accuracy);
  UNITS.forEach(unit=>{
    const a = unitAccuracy(unit);
    const div=document.createElement('div'); div.className='accuracy-item';
    const label = a.attempts ? `${a.accuracy}%` : '未学習';
    div.innerHTML=`<div><b>${UNIT_ICONS[unit]} ${unit}</b><small>できた ${a.good}回 / 記録 ${a.attempts}回</small></div><strong>${label}</strong>`;
    accuracyList.append(div);
  });
  root.append(card,stat,streak,history,bars,accuracy);
}
function renderSettings(root){
  setTitle('設定','学習環境');
  const sec=document.createElement('section'); sec.className='setting-card';
  const goalStatus = dailyGoalStatus();
  sec.innerHTML=`<div class="card"><h2>地理 太郎</h2><p class="explanation">大学受験に向けて、毎日少しずつ知識と因果関係を固めます。</p></div>
  <div class="card goal-setting"><div class="section-head"><h2>1日の目標</h2><strong>${goalStatus.goal}問</strong></div><div class="goal-options">${[10,20,30,50].map(n=>`<button class="goal-option ${goalStatus.goal===n?'active':''}" data-goal="${n}">${n}問</button>`).join('')}</div></div>
  <div class="setting-row"><span>学習時間のリマインダー</span><b>${state.data.reminder}</b></div>
  <button class="setting-row" data-setting="notify"><span>通知設定<br><small>復習リマインドを受け取る</small></span><i class="switch ${state.data.notifications?'on':''}"></i></button>
  <button class="setting-row" data-setting="dark"><span>ダークモード<br><small>見た目だけの試作切替です</small></span><i class="switch ${state.data.darkMode?'on':''}"></i></button>
  <div class="card data-card"><h2>学習データ</h2><div class="data-actions"><button class="secondary" data-data="export">エクスポート</button><button class="secondary" data-data="import">インポート</button></div><input id="importDataFile" class="hidden" type="file" accept="application/json"></div>
  <button class="danger" data-setting="reset">学習記録をリセット</button>
  <div class="card"><h2>アプリ情報</h2><p class="explanation">バージョン 1.0.0<br>HTML/CSS/JavaScriptのみで動作します。</p></div>`;
  root.append(sec);
  $$('[data-setting]', root).forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.setting;
    if(key==='notify') state.data.notifications=!state.data.notifications;
    if(key==='dark') state.data.darkMode=!state.data.darkMode;
    if(key==='reset'){ state.data=defaultData(); toast('記録をリセットしました'); }
    saveData(); render();
  }));
  $$('[data-goal]', root).forEach(btn=>btn.addEventListener('click',()=>{
    state.data.dailyGoal = Number(btn.dataset.goal);
    saveData();
    toast(`1日の目標を${state.data.dailyGoal}問にしました`);
    render();
  }));
  $('[data-data="export"]', root).addEventListener('click', exportStudyData);
  $('[data-data="import"]', root).addEventListener('click',()=>$('#importDataFile', root).click());
  $('#importDataFile', root).addEventListener('change', e=>{
    const file = e.target.files?.[0];
    if(file) importStudyDataFile(file);
    e.target.value = '';
  });
}

document.addEventListener('click', e=>{
  const nav=e.target.closest('[data-nav]');
  if(nav){ const s=nav.dataset.nav; if(s==='home') go('home'); if(s==='units') { state.selectedGroup=null; go('units'); } if(s==='weak') go('weak'); if(s==='records') go('records'); if(s==='settings') go('settings'); }
});
$('#backBtn').addEventListener('click', back);
$('#menuBtn').addEventListener('click', ()=>go('settings'));

if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); }
render();
logUsage('open', {screen: state.screen});
