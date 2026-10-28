import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, getDocs as _getDocs, getDoc as _getDoc, setDoc as _setDoc, deleteDoc as _deleteDoc, writeBatch as _writeBatch, onSnapshot as _onSnapshot, addDoc as _addDoc, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { demoAdmin } from './demo.js';
import { mountCoach } from './coach.js';
import { IOS_APP, nativeSignIn, providerOf, scheduleAlarms } from './native.js';
/* 관리자 체험 (admin.html?demo=1): 서버 대신 메모리 속 샘플 데이터를 읽고 씀 · 새로고침하면 처음 상태로 */
const DEMO = new URLSearchParams(location.search).get('demo') === '1';
const MEM = DEMO ? demoAdmin() : null;
const snapOf = (path) => ({ id: path.split('/').pop(), exists: () => !!MEM[path], data: () => (MEM[path] ? JSON.parse(JSON.stringify(MEM[path])) : undefined) });
const qOf = (ref) => { const docs = ref.type === 'collection' ? Object.keys(MEM).filter((k) => k.indexOf(ref.path + '/') === 0 && k.slice(ref.path.length + 1).indexOf('/') < 0).map(snapOf) : [];
  return { docs, empty: !docs.length, size: docs.length, forEach: (f) => docs.forEach(f) }; };
const memSet = (ref, d, o) => { MEM[ref.path] = o && o.merge ? Object.assign({}, MEM[ref.path] || {}, JSON.parse(JSON.stringify(d))) : JSON.parse(JSON.stringify(d)); };
const getDoc = (r) => (DEMO ? Promise.resolve(snapOf(r.path)) : _getDoc(r));
const getDocs = (q) => (DEMO ? Promise.resolve(qOf(q)) : _getDocs(q));
const setDoc = (r, d, o) => (DEMO ? (memSet(r, d, o), Promise.resolve()) : _setDoc(r, d, o));
const deleteDoc = (r) => (DEMO ? (delete MEM[r.path], Promise.resolve()) : _deleteDoc(r));
const addDoc = (c, d) => (DEMO ? (MEM[c.path + '/x' + Date.now()] = d, Promise.resolve()) : _addDoc(c, d));
const writeBatch = (x) => (DEMO ? (() => { const ops = []; return { set: (r, d, o) => ops.push(() => memSet(r, d, o)), update: (r, d) => ops.push(() => memSet(r, d, { merge: true })), delete: (r) => ops.push(() => delete MEM[r.path]), commit: () => (ops.forEach((f) => f()), Promise.resolve()) }; })() : _writeBatch(x));
const onSnapshot = (r, cb, ...rest) => { if (!DEMO) return _onSnapshot(r, cb, ...rest); setTimeout(() => cb(r.type === 'document' ? snapOf(r.path) : qOf(r)), 0); return () => {}; };

const firebaseConfig = {
  apiKey: 'AIzaSyBZps4AWzRrf07yzSuIgydRO_Dn2qGrx9E',
  authDomain: 'a-futsal.firebaseapp.com',
  projectId: 'a-futsal',
  storageBucket: 'a-futsal.firebasestorage.app',
  messagingSenderId: '873470138264',
  appId: '1:873470138264:web:121893883d55576c577ded'
};
const C = window.Core, I = window.Importer;
const fb = initializeApp(firebaseConfig), auth = getAuth(fb), db = getFirestore(fb);
/* 오류 기록 (운영자 확인용) */
const errSeen = new Set();
function logErr(msg, stack) {
  try {
    msg = String(msg || '').slice(0, 500); if (!msg || errSeen.has(msg) || errSeen.size >= 5 || !auth.currentUser) return; errSeen.add(msg);
    addDoc(collection(db, 'errlog'), { at: Date.now(), uid: auth.currentUser.uid, cid: new URLSearchParams(location.search).get('c') || '', page: 'admin', msg, stack: String(stack || '').slice(0, 2000), ua: navigator.userAgent.slice(0, 300), ver: C.VERSION }).catch(() => {});
  } catch (e) {}
}
window.addEventListener('error', (e) => logErr(e.message, e.error && e.error.stack));
window.addEventListener('unhandledrejection', (e) => logErr(e.reason && (e.reason.message || e.reason), e.reason && e.reason.stack));
const CID = DEMO ? 'demo' : new URLSearchParams(location.search).get('c') || '';
const D = (...p) => doc(db, 'clubs', CID, ...p);
const CL = (n) => collection(db, 'clubs', CID, n);

const S = { cfg: null, members: [], games: [], txs: [], skills: {}, votes: {}, view: 'week', week: monday(C.ymd(new Date())) };
const MHOME = DEMO ? './?demo=1' : './?c=' + CID;
const MEMBER_URL = new URL(DEMO ? './?demo=1' : './?c=' + CID, location.href).href;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => C.comma(n);
const today = () => C.ymd(new Date());
function monday(d) { const x = new Date(d + 'T00:00:00'); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return C.ymd(x); }
function md(d) { return (+d.substr(5, 2)) + '/' + (+d.substr(8, 2)); }
function mon(ym) { return (+ym.substr(5, 2)) + '월'; }
function clean(o) { const r = {}; Object.keys(o).forEach((k) => { if (k[0] !== '_' && o[k] !== undefined) r[k] = o[k]; }); return r; }

/* ---------------- 알림 / 모달 ---------------- */
let toastT = null;
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms || 3000); }
function modal(html, onMount) { const m = $('#modal'); m.innerHTML = '<div class="box">' + html + '</div>'; m.hidden = false; m.onclick = (e) => { if (e.target === m) closeModal(); }; onMount && onMount(m); }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('복사했어요. 카톡에 붙여넣으세요.'); }
  catch (e) { modal('<h2>복사할 문구</h2><textarea id="cp">' + esc(text) + '</textarea><button class="btn pri" id="x">닫기</button>', (m) => { m.querySelector('#cp').select(); m.querySelector('#x').onclick = closeModal; }); }
}

/* ---------------- 저장 ---------------- */
const putTx = (t) => { schedulePublish(); return setDoc(D('tx', t.id), clean(t)).catch(fail); };
const gameOut = (g) => { const o = clean(g); if (o.teams) o.teams = o.teams.map((t) => t.join('|')); return o; };
const gameIn = (g) => { if (g.teams && typeof g.teams[0] === 'string') g.teams = g.teams.map((t) => t.split('|').filter(Boolean)); return g; };
const fail = (e) => { toast('저장 실패: ' + e.message, 6000); logErr('저장 실패: ' + e.message, e.stack); throw e; };
const putGame = (g) => { schedulePublish(); return setDoc(D('games', g.id), gameOut(g)).catch(fail); };
const putMember = (m) => { schedulePublish(); return setDoc(D('members', m.id), clean(m)).catch(fail); };
const putCfg = () => { schedulePublish(); return setDoc(D('config', 'main'), clean(S.cfg)); };
async function batchPut(list) {
  for (let i = 0; i < list.length; i += 400) {
    const b = writeBatch(db);
    list.slice(i, i + 400).forEach(([col, id, data]) => b.set(D(col, id), col === 'games' ? gameOut(data) : clean(data)));
    await b.commit();
  }
  schedulePublish();
}

/* ---------------- 로그인 → 내 팀 확인 → 관리자 비밀번호 ---------------- */
const PIN_DEFAULT = 'd491e185da5e647a77d68eeaf393cd35';   // 0000
async function pinHash(pin) { return C.md5('a-futsal:' + pin); }
if (DEMO) setTimeout(() => { S.club = MEM['clubs/demo']; S.uid = 'demo'; S.unlocked = true; document.title = '체험FC 관리자 · A-KICK'; C.applyTheme(null); loadAll(); }, 0);
onAuthStateChanged(auth, async (u) => {
  if (DEMO) return;
  if (!u) { location.href = './' + (CID ? '?c=' + CID : ''); return; }
  if (!CID) { location.href = './'; return; }
  try {
    const club = await getDoc(doc(db, 'clubs', CID));
    if (!club.exists() || club.data().owner !== u.uid) return deny(u);
    S.club = club.data(); S.uid = u.uid; document.title = S.club.name + ' 관리자'; C.applyTheme(S.club.theme);
    let ok = false; try { ok = sessionStorage.getItem('afutsal_pin_' + CID) === '1'; } catch (e) {}
    if (ok) { S.unlocked = true; return loadAll(); }
    const cfg = await getDoc(D('config', 'main'));
    if (!cfg.exists()) { S.unlocked = true; return loadAll(); }        // 방금 만든 팀: 비밀번호는 설정 마법사에서 정함
    pinGate(cfg.data().pinHash || '');
  } catch (e) { deny(u, e.message); }
});
function deny(u, msg) {
  $('#app').innerHTML = '<div class="center"><b>이 팀의 관리자가 아니에요</b><div class="muted">' + esc(u.email || '') + (msg ? '<br>' + esc(msg) : '') + '</div><a class="btn pri" href="./' + (CID ? '?c=' + CID : '') + '">회원 화면으로</a></div>';
}
function pinGate(hash) {
  $('#app').innerHTML = '<div class="center"><div class="logo" style="font-size:26px">' + esc(S.club.name) + '</div><div class="muted">관리자 전용 페이지</div>' +
    '<label class="f" style="width:240px">관리자 비밀번호<input id="pin" class="pinbox pinmask" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off"></label>' +
    '<div class="muted">' + (hash ? '숫자 4자리를 입력하면 바로 들어가요' : '처음 비밀번호는 0000이에요 · 설정에서 바꿀 수 있어요') + '</div>' +
    '<button class="btn ghost" id="pinlost">비밀번호를 잊었어요</button><a class="muted" href="./?c=' + CID + '">회원 화면으로 돌아가기</a></div>';
  const inp = $('#pin'); inp.focus();
  let wrongT = null;
  const ok = async () => (await pinHash(inp.value.trim())) === (hash || PIN_DEFAULT);
  const enter = () => { S.unlocked = true; try { sessionStorage.setItem('afutsal_pin_' + CID, '1'); } catch (e) {} loadAll(); };
  const wrong = () => { toast('비밀번호가 달라요'); inp.value = ''; inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); inp.focus(); };
  // 4자리가 되면 자동 확인 · 틀리면 잠깐 뒤 지우고 첫 자리부터 (더 긴 비밀번호는 계속 입력 후 Enter)
  inp.oninput = async () => {
    inp.value = inp.value.replace(/\D/g, ''); clearTimeout(wrongT);
    if (inp.value.length === 4) { if (await ok()) return enter(); wrongT = setTimeout(() => { if (inp.value.length === 4) wrong(); }, 700); }
  };
  // 잊었을 때: 팀을 만든 구글 계정으로 한 번 더 로그인하면 새 비밀번호를 정할 수 있음
  $('#pinlost').onclick = async () => {
    try { const r = IOS_APP ? await nativeSignIn(auth, providerOf(auth.currentUser)) : await signInWithPopup(auth, new GoogleAuthProvider()); if (!r) return toast('확인을 취소했어요'); if (r.user.uid !== S.club.owner) return toast('팀을 만든 계정으로 로그인해 주세요'); }
    catch (e) { return toast('확인을 취소했어요'); }
    const np = prompt('새 관리자 비밀번호 (숫자 4자리)') || '';
    if (!/^\d{4}$/.test(np)) return toast('숫자 4자리로 해주세요');
    await setDoc(D('config', 'main'), { pinHash: await pinHash(np) }, { merge: true }).catch(fail);
    toast('비밀번호를 바꿨어요'); enter();
  };
  inp.onkeydown = async (e) => { if (e.key === 'Enter' && inp.value) { clearTimeout(wrongT); if (await ok()) enter(); else wrong(); } };
}

async function loadAll() {
  $('#app').innerHTML = '<div class="center">불러오는 중...</div>';
  try {
    const cfg = await getDoc(D('config', 'main'));
    if (!cfg.exists()) return renderSetup();
    S.cfg = cfg.data();
    const [ms, gs, ts, sk] = await Promise.all([getDocs(CL('members')), getDocs(CL('games')), getDocs(CL('tx')), getDoc(D('private', 'skills'))]);
    S.members = ms.docs.map((d) => d.data());
    S.games = gs.docs.map((d) => gameIn(d.data())).sort((a, b) => (a.date < b.date ? -1 : 1));
    S.txs = ts.docs.map((d) => d.data()).sort((a, b) => (a.dt < b.dt ? -1 : 1));
    S.skills = sk.exists() ? sk.data() : {};
    getDocs(CL('profiles')).then((q) => { S.profs = {}; q.docs.forEach((d) => (S.profs[d.id] = d.data())); if (S.view === 'team' || S.view === 'week') render(); }).catch(() => {});
    S.claims = {}; S.goals = []; S.polls = []; S.pvotes = []; S.avotes = []; S.sugs = [];
    const live = (col, key) => onSnapshot(CL(col), (q) => { S[key] = q.docs.map((d) => Object.assign({ id: d.id }, d.data())); if (S.view === 'polls' || (key === 'videos' && S.view === 'stats')) render(); if (key === 'sugs' || key === 'reqs') render(); }, () => {});
    if (!S.pollSub) S.pollSub = [live('polls', 'polls'), live('pollvotes', 'pvotes'), live('anonvotes', 'avotes'), live('videos', 'videos'), live('suggest', 'sugs'), live('requests', 'reqs')];
    getDocs(CL('claims')).then((q) => { q.docs.forEach((d) => (S.claims[d.id] = d.data())); S.claimsLoaded = true; if (S.view === 'week') render(); }).catch(() => {});
    if (!S.goalSub) S.goalSub = onSnapshot(CL('goals'), (q) => { S.goals = q.docs.map((d) => Object.assign({ id: d.id }, d.data())); if (S.view === 'stats') render(); }, () => {});
    render();
    if (!S.voteSub) S.voteSub = onSnapshot(CL('votes'), (snap) => {
      const v = {};
      snap.docs.forEach((d) => { const x = d.data(); (v[x.gid] = v[x.gid] || {})[x.name] = { v: x.v, at: x.at || 0, self: true }; });
      S.votes = v; if (S.view === 'week' || S.view === 'team') render(); schedulePublish();
    }, () => {});
    schedulePublish();
  } catch (e) {
    $('#app').innerHTML = '<div class="center"><b>불러오기 실패</b><div class="muted">' + esc(e.message) + '</div><div class="muted">Firebase 보안 규칙을 새로 넣었는지 확인해 주세요.</div></div>';
  }
}

/* ---------------- 처음 설정: 구글시트 가져오기 ---------------- */
/* 시간 고르기: 무한 스크롤 대신 '오전/오후 ○시' + '○○분'(00·10·20·30·40·50) */
function timeSel(id, val) {
  const p = String(val || '16:00').split(':'), h = +p[0] || 0, mi = +p[1] || 0, ms = [0, 10, 20, 30, 40, 50];
  if (ms.indexOf(mi) < 0) { ms.push(mi); ms.sort((a, b) => a - b); }
  return '<span class="tsel" id="' + id + '"><select data-h aria-label="시">' + [...Array(24)].map((_, i) => '<option value="' + i + '"' + (i === h ? ' selected' : '') + '>' + (i < 12 ? '오전 ' : '오후 ') + ((i % 12) || 12) + '시</option>').join('') +
    '</select><select data-m aria-label="분">' + ms.map((x) => '<option value="' + x + '"' + (x === mi ? ' selected' : '') + '>' + String(x).padStart(2, '0') + '분</option>').join('') + '</select></span>';
}
function timeVal(root, id) { const el = root.querySelector('#' + id); return String(el.querySelector('[data-h]').value).padStart(2, '0') + ':' + String(el.querySelector('[data-m]').value).padStart(2, '0'); }

/* ---------------- 처음 시작: 폰에서 4단계로 끝내는 팀 설정 ---------------- */
function renderSetup() {
  const W = S.wiz = S.wiz || { step: 1, sport: '', dow: 0, time: '16:00', place: '', fee: 30000, guestFee: 10000, account: '', me: '', names: '', pin: '' };
  const DOW = '일월화수목금토';
  const chip = (attr, val, on, label) => '<button class="wchip' + (on ? ' on' : '') + '" ' + attr + '="' + val + '">' + label + '</button>';
  const steps = ['종목', '경기', '회비', '회원'];
  let body = '';
  if (W.step === 1) body = '<h2>어떤 운동을 하나요?</h2><div class="wbig">' +
    '<button class="wsport' + (W.sport === 'futsal' ? ' on' : '') + '" data-sport="futsal"><b>⚽ 풋살</b><span>한 팀 5~6명</span></button>' +
    '<button class="wsport' + (W.sport === 'soccer' ? ' on' : '') + '" data-sport="soccer"><b>🥅 축구</b><span>한 팀 11명</span></button></div>';
  if (W.step === 2) body = '<h2>보통 언제 경기하나요?</h2><div class="wl">요일</div><div class="wchips">' + [...DOW].map((d, i) => chip('data-dow', i, W.dow === i, d)).join('') + '</div>' +
    '<div class="wl">시간</div>' + timeSel('wt', W.time) +
    '<div class="wl">구장 (선택)</div><input class="win" id="wp" placeholder="예: OO풋살장" value="' + esc(W.place) + '">';
  if (W.step === 3) body = '<h2>회비는 얼마인가요?</h2><div class="wl">월회비 (정회원)</div><div class="wchips">' + [0, 20000, 30000, 40000, 50000].map((v) => chip('data-fee', v, W.fee === v, v ? won(v) + '원' : '없음')).join('') + '</div>' +
    '<div class="wl">게스트 참가비 (1회)</div><div class="wchips">' + [0, 5000, 10000, 15000, 20000].map((v) => chip('data-gfee', v, W.guestFee === v, v ? won(v) + '원' : '없음')).join('') + '</div>' +
    '<div class="wl">모임통장 계좌 (선택 · 회원 화면에 복사 버튼으로 떠요)</div><input class="win" id="wa" placeholder="예: 카카오뱅크 3333-00-0000000" value="' + esc(W.account) + '">';
  if (W.step === 4) body = '<h2>회원을 넣어주세요</h2><div class="wl">내 이름 (관리자도 회원으로 참여)</div><input class="win" id="wme" placeholder="예: 홍길동" value="' + esc(W.me) + '">' +
    '<div class="wl">다른 회원 이름 (한 줄에 한 명 · 나중에 추가해도 돼요)</div><textarea class="win" id="wn" rows="6" placeholder="김철수&#10;이영희&#10;박민수">' + esc(W.names) + '</textarea>' +
    '<div class="muted">회원은 나중에 링크로 가입 신청 → 승인으로 들어와요. 여기 이름을 넣어두면 승인할 때 자동으로 연결돼요.</div>' +
    '<div class="wl">관리자 비밀번호 (숫자 4자리)</div><input class="win pinmask" id="wpin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" placeholder="회원은 모르는 숫자로" value="' + esc(W.pin) + '">' +
    '<div class="muted">관리자 화면에 들어갈 때 써요. 잊어도 구글 계정으로 다시 정할 수 있어요.</div>';
  $('#app').innerHTML = '<div class="wiz"><div class="wtop"><b>' + esc(S.club.name) + '</b><span>팀 설정 ' + W.step + ' / 4</span></div>' +
    '<div class="wbar">' + steps.map((t, i) => '<i class="' + (i < W.step ? 'on' : '') + '"></i>').join('') + '</div>' + body +
    '<div class="wnav">' + (W.step > 1 ? '<button class="wback" id="wprev">이전</button>' : '') + '<button class="wnext" id="wnext">' + (W.step < 4 ? '다음' : '시작하기 🎉') + '</button></div>' +
    (W.step === 1 ? '<details class="wold"><summary>PC에서 엑셀로 가져오기 · 기타</summary><div class="setup3"><button class="scard" id="s1"><b>빈 상태로 시작</b><span>설정 없이 바로 시작</span></button>' +
      '<label class="scard"><b>구글시트 엑셀 가져오기</b><span>A-KICK 전용 구글시트 양식만 가능</span><input type="file" accept=".xlsx" id="f" hidden></label>' +
      '</div></details>' : '') + '</div>';
  const save = () => { const g = (id) => { const e = $(id); return e ? e.value.trim() : null; };
    if (W.step === 2) { W.time = timeVal(document, 'wt'); W.place = g('#wp'); } if (W.step === 3) W.account = g('#wa'); if (W.step === 4) { W.me = g('#wme'); W.names = $('#wn').value; W.pin = g('#wpin'); } };
  document.querySelectorAll('[data-sport]').forEach((b) => (b.onclick = () => { W.sport = b.dataset.sport; renderSetup(); }));
  document.querySelectorAll('[data-dow]').forEach((b) => (b.onclick = () => { save(); W.dow = +b.dataset.dow; renderSetup(); }));
  document.querySelectorAll('[data-fee]').forEach((b) => (b.onclick = () => { save(); W.fee = +b.dataset.fee; renderSetup(); }));
  document.querySelectorAll('[data-gfee]').forEach((b) => (b.onclick = () => { save(); W.guestFee = +b.dataset.gfee; renderSetup(); }));
  const pv = $('#wprev'); if (pv) pv.onclick = () => { save(); W.step--; renderSetup(); };
  $('#wnext').onclick = async () => {
    save();
    if (W.step === 1 && !W.sport) return toast('풋살인지 축구인지 골라주세요');
    if (W.step === 4 && !W.me) return toast('내 이름을 넣어주세요');
    if (W.step === 4 && !/^\d{4}$/.test(W.pin || '')) return toast('관리자 비밀번호를 숫자 4자리로 정해주세요');
    if (W.step < 4) { W.step++; return renderSetup(); }
    $('#wnext').disabled = true; $('#wnext').textContent = '만드는 중...';
    await finishSetup(W);
  };
  const f = $('#f'); if (f) f.onchange = (e) => e.target.files[0] && readOld(e.target.files[0]);
  const s1 = $('#s1'); if (s1) s1.onclick = async () => { S.cfg = baseCfg(); await setDoc(D('config', 'main'), S.cfg); toast('시작했어요 · 관리자 비밀번호는 0000이에요. 톱니바퀴에서 바꿔주세요', 7000); loadAll(); };
}
function baseCfg() { return { fee: 30000, guestFee: 10000, oneOff: 120000, rentPerGame: 0, cap: 12, time: '16:00', before: 7, after: 1, nextMonthDay: 25, dueDay: 30, reserve: 0, openChat: '', place: '', account: '', perSide: 5, maxSide: 6, dow: 0 }; }
async function finishSetup(W) {
  const soccer = W.sport === 'soccer';
  S.cfg = Object.assign(baseCfg(), { fee: W.fee, guestFee: W.guestFee, account: W.account, place: W.place, time: W.time, dow: W.dow,
    perSide: soccer ? 11 : 5, maxSide: soccer ? 11 : 6, cap: soccer ? 22 : 12, sport: W.sport, pinHash: await pinHash(W.pin) });
  try { sessionStorage.setItem('afutsal_pin_' + CID, '1'); } catch (e) {}
  const names = [W.me].concat(W.names.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 80);
  const list = [['config', 'main', S.cfg]];
  names.forEach((n, i) => list.push(['members', 'M' + String(i + 1).padStart(3, '0'), { id: 'M' + String(i + 1).padStart(3, '0'), name: n, join: today().substr(0, 7) + '-01', quit: '', state: '활동', fee: 0, payers: [n] }]));
  // 첫 경기: 오늘 이후 가장 가까운 정기 요일
  const d = new Date(today() + 'T00:00:00'); d.setDate(d.getDate() + ((W.dow - d.getDay() + 7) % 7));
  const gd = C.ymd(d);
  list.push(['games', 'G' + gd.replace(/-/g, ''), { id: 'G' + gd.replace(/-/g, ''), date: gd, time: W.time, type: '일회성', fee: 0, cap: S.cfg.cap, attend: [], deadline: '' }]);
  // 관리자 본인 이름 연결
  list.push(['claims', 'M001', { uid: S.uid, email: (auth.currentUser && auth.currentUser.email) || '', name: W.me, at: Date.now() }]);
  list.push(['users', S.uid, { mid: 'M001', name: W.me, at: Date.now() }]);
  try { await batchPut(list); } catch (e) { toast('저장 실패: ' + e.message, 6000); return renderSetup(); }
  S.wiz = null; toast('팀 준비 완료! 이번 주 경기도 만들어 뒀어요 ⚽', 6000); loadAll();
}
async function readOld(file) {
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const get = (n) => (wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) : []);
    if (!wb.Sheets['거래분류'] || !wb.Sheets['회원']) throw new Error('구글시트 엑셀이 아니에요 ("회원", "거래분류" 시트가 없어요).');
    const D = I.fromOldSheet(get);
    const bal = C.balance(D.txs);
    modal('<h2>이대로 가져올까요?</h2><div class="list">' +
      '<div class="li">회원 <b>' + D.members.length + '명</b></div><div class="li">경기 <b>' + D.games.length + '개</b></div>' +
      '<div class="li">거래 <b>' + D.txs.length + '건</b> · 마지막 잔액 <b>' + won(bal) + '원</b></div>' +
      '<div class="li">실력 점수 <b>' + Object.keys(D.skills).length + '명</b></div></div>' +
      '<div class="muted">구글시트 대시보드의 현재 잔액과 같으면 정상이에요. 연락처는 가져오지 않아요.</div>' +
      '<div class="row"><button class="btn" id="no">취소</button><button class="btn pri" id="yes">가져오기</button></div>', (m) => {
      m.querySelector('#no').onclick = closeModal;
      m.querySelector('#yes').onclick = async () => {
        m.querySelector('#yes').disabled = true; m.querySelector('#yes').textContent = '저장 중... (10초쯤)';
        const list = [];
        D.members.forEach((x) => list.push(['members', x.id, x]));
        D.games.forEach((x) => list.push(['games', x.id, x]));
        D.txs.forEach((x) => list.push(['tx', x.id, x]));
        list.push(['private', 'skills', { scores: D.skills, bundles: D.bundles }]);
        list.push(['config', 'main', D.cfg]);
        await batchPut(list);
        closeModal(); toast('가져오기 완료!'); loadAll();
      };
    });
  } catch (e) { toast(e.message, 6000); }
}

/* ---------------- 공통 계산 ---------------- */
/** 참석 = 관리자 체크와 회원 투표 중 나중 것 */
function latest(g, n) { const a = (g.log || {})[n], b = (S.votes[g.id] || {})[n]; return !a ? b : !b ? a : a.at >= b.at ? a : b; }
function attOf(g) {
  const out = new Set(g.attend || []), names = new Set([...Object.keys(g.log || {}), ...Object.keys(S.votes[g.id] || {})]);
  names.forEach((n) => { const L = latest(g, n); if (L.v === '참석') out.add(n); else out.delete(n); });
  return [...out];
}
const cfgC = () => Object.assign({ before: 7, after: 1, nextMonthDay: 25 }, S.cfg);
// 지금 걷는 회비의 달: '다음 달분 시작일'(기본 25일)부터는 다음 달, 그 전엔 이번 달
function payYM() { const t = today(); return +t.substr(8, 2) >= ((S.cfg && S.cfg.nextMonthDay) || 25) ? C.addYM(t.substr(0, 7), 1) : t.substr(0, 7); }
function activeAt(date) { return S.members.filter((m) => m.state !== '탈퇴' && (!m.join || m.join <= date) && (!m.quit || m.quit >= date)); }
function partLabel(t) {
  if (t.state === '무시') return t.reason || '제외';
  if (t.state === '확인필요') return t.reason || '확인 필요';
  const g = (id) => { const x = S.games.find((y) => y.id === id); return x ? md(x.date) : '경기 미정'; };
  return (t.parts || []).map((p) => {
    if (p.cls === '회비') return mon(p.ym || '') + ' 회비' + ((p.names || []).length > 1 ? ' ' + p.names.length + '명' : '');
    if (p.cls === '첫달회비') return '첫 달 회비 (' + (p.games || []).length + '경기)';
    if (p.cls === '게스트비') return '게스트 ' + (p.cnt || 1) + '명 → ' + g(p.gid);
    if (p.cls === '구장비') return '구장비 ' + (p.ym ? mon(p.ym) : g(p.gid));
    return p.cls + (p.name ? ' · ' + p.name : '');
  }).join(' + ');
}

/* ---------------- 화면 ---------------- */
const IC = {
  home: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  up: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
  gear: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  l: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
  r: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>',
  copy: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
};
function render() {
  const v = S.view, ym = payYM(), list = C.membersFor(S.members, ym), paid = C.duesPaid(S.txs, ym);
  const tab = (k, l) => '<button class="tab' + (v === k ? ' on' : '') + '" data-v="' + k + '">' + l + '</button>';
  const nav = '<header class="bar"><div class="bar-in"><a class="logo" href="' + MHOME + '" title="홈으로">' + esc(S.club.name) + '<small>관리자</small></a><nav class="tabs" aria-label="메뉴">' + tab('week', '이번 주') + tab('members', '회원 · 회비' + ((S.reqs || []).length ? ' <em class="badge">' + S.reqs.length + '</em>' : '')) + tab('ledger', '장부') + tab('stats', '경기기록') + tab('polls', '투표 · 건의' + (newSugs() ? ' <em class="badge">' + newSugs() + '</em>' : '')) + '</nav>' +
    '<div class="stats"><div class="stat"><span>통장 잔액</span><b>' + won(C.balance(S.txs)) + '<em>원</em></b></div><div class="stat"><span>' + mon(ym) + ' 회비</span><b>' + list.filter((m) => paid[m.name]).length + '<em> / ' + list.length + '명</em></b></div></div>' +
    '<label class="btn pri up">' + IC.up + '<span>거래내역 엑셀 넣기</span><input type="file" accept=".xlsx,.xls,.csv" id="up" hidden></label>' +
    '<a class="btn" href="' + MHOME + '">' + IC.home + ' 홈</a><button class="iconbtn" id="gear" aria-label="설정">' + IC.gear + '</button></div></header>';
  const body = v === 'week' ? weekHTML() : v === 'members' ? membersHTML() : v === 'team' ? teamHTML() : v === 'stats' ? statsHTML() : v === 'polls' ? pollsHTML() : ledgerHTML();
  mountCoach({ S, C, payYM, attOf, duesText, openSettings, demo: DEMO, go: (v) => { S.view = v; render(); window.scrollTo(0, 0); } });
  $('#app').innerHTML = (DEMO ? '<div class="demob"><span>👀 <b>총무 화면 체험</b> · 새로고침하면 처음으로 돌아가요</span><a href="./">나가기</a></div>' : '') + nav + '<main class="wrap">' + body + '</main>';
  document.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { S.view = b.dataset.v; render(); }));
  $('#up').onchange = (e) => e.target.files[0] && importBank(e.target.files[0]);
  $('#gear').onclick = openSettings;
  ({ week: bindWeek, members: bindMembers, team: bindTeam, ledger: bindLedger, stats: bindStats, polls: bindPolls })[v]();
  bindSort();
}

/* ---- 이번 주 ---- */
/** 새 팀 첫 화면: 무엇부터 할지 안내 (회원이 2명 이상 들어오면 사라짐) */
function startGuide() {
  if (!S.claimsLoaded || Object.keys(S.claims || {}).length > 1) return '';
  return '<section class="panel pad sguide"><b>처음이면 이 순서로 시작하세요</b><ol>' +
    '<li><button class="btn sm pri" id="mlink2">' + IC.copy + ' 회원 초대 문구 복사</button> → 팀 카톡방에 붙여넣기</li>' +
    '<li>가입 신청이 오면 위 <b>회원 · 회비</b> 탭에 빨간 숫자가 떠요 → 이름 확인하고 <b>승인</b></li>' +
    '<li>카카오뱅크 모임통장 거래내역 엑셀을 <b>거래내역 엑셀 넣기</b>로 올리면 회비·게스트비가 자동으로 체크돼요</li></ol></section>';
}
/** 직접 입력했는데 아직 통장 엑셀에서 짝을 못 찾은 건 */
function staleManual() {
  const bank = S.txs.filter((t) => !t.manual), last = bank.length ? C.dtDate(bank[bank.length - 1].dt) : '';
  return S.txs.filter((t) => t.manual && t.state !== '무시' && last && C.dtDate(t.dt) < C.addDays(last, -1));
}
function manualIssues() { return C.pendingManual(S.txs).list.map((t) => ({ t, d: C.diagnoseManual(t, S.txs) })).filter((x) => x.d.code !== 'wait'); }
function manualPill() {
  const pm = C.pendingManual(S.txs), iss = manualIssues(), gaps = C.balanceGaps(S.txs);
  if (!pm.n && !gaps.length) return '';
  return '<button class="pill ' + (iss.length || gaps.length ? 'warn' : 'gry') + '" id="mchk">' + (pm.n ? '직접 입력 ' + pm.n + '건 · 통장 확인 전' : '') +
    (iss.length ? ' · ' + iss.length + '건 확인 필요' : '') + (gaps.length ? (pm.n ? ' · ' : '') + '통장 잔액 안 맞는 곳 ' + gaps.length + '곳' : '') + '</button>';
}
/** 직접 입력·잔액을 통장(진짜)과 맞춰본 결과 */
function checkReport(title) {
  const iss = manualIssues(), gaps = C.balanceGaps(S.txs), wait = C.pendingManual(S.txs).n - iss.length;
  modal('<h2>' + (title || '통장과 맞춰보기') + '</h2>' +
    (iss.length ? '<div class="g-lbl2">직접 입력 ' + iss.length + '건 확인 필요</div>' + iss.map((x) => '<div class="chk"><b>' + esc(x.t.dt.substr(5, 5).replace('.', '/')) + ' ' + esc(x.t.desc) + ' ' + won(x.t.amt) + '원</b><span>' + esc(x.d.msg) + '</span><button class="btn xs pri" data-open="' + x.t.id + '">열어서 고치기</button></div>').join('') : '') +
    (gaps.length ? '<div class="g-lbl2">통장 잔액이 안 맞는 곳 ' + gaps.length + '곳</div>' + gaps.map((g) => '<div class="chk"><b>' + esc(g.from.substr(5, 11)) + ' → ' + esc(g.to.substr(5, 11)) + '</b><span>앞 거래 잔액에서 계산한 값과 ' + won(Math.abs(g.diff)) + '원 차이가 나요. 이 사이 거래가 엑셀에서 빠진 것 같아요. 그 기간을 포함해 거래내역 엑셀을 다시 받아 넣어주세요 (이미 있는 건은 중복으로 안 들어가요).</span></div>').join('') : '') +
    (!iss.length && !gaps.length ? '<div class="muted">문제없어요 👍' + (wait > 0 ? ' 직접 입력 ' + wait + '건은 통장 엑셀이 아직 그 날짜까지 안 들어와서 기다리는 중이에요.' : '') + '</div>' : (wait > 0 ? '<div class="muted">그 밖에 ' + wait + '건은 통장 엑셀이 그 날짜까지 안 들어와서 기다리는 중이에요 (정상).</div>' : '')) +
    '<div class="mfoot"><span style="flex:1"></span><button class="btn pri" id="cx">확인</button></div>', (m) => {
    m.querySelector('#cx').onclick = closeModal;
    m.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => { closeModal(); editTx(b.dataset.open); }));
  });
}
function weekHTML() {
  const days = [...Array(7)].map((_, i) => C.addDays(S.week, i));
  const need = S.txs.filter((t) => t.state === '확인필요');
  const other = need.some((t) => C.dtDate(t.dt) < days[0] || C.dtDate(t.dt) > days[6]);
  const head = '<div class="toolbar"><div class="weeknav"><button class="iconbtn sm" id="pw" aria-label="지난주">' + IC.l + '</button><b>' + md(days[0]) + ' – ' + md(days[6]) + '</b><button class="iconbtn sm" id="nw" aria-label="다음주">' + IC.r + '</button>' +
    (S.week !== monday(today()) ? '<button class="btn sm" id="tw">이번 주로</button>' : '') + '</div>' +
    '<button class="btn sm pri" id="madd">+ 직접 입력</button><button class="btn sm" id="mlink">' + IC.copy + ' 회원 링크 복사</button>' + manualPill() +
    (need.length ? '<button class="pill warn" id="jump">확인할 거래 ' + need.length + '건' + (other ? ' · 다른 주 보기' : '') + '</button>' : '<span class="pill ok">확인할 거래 없음</span>') + '</div>';
  let txN = 0;
  const rows = days.map((d, i) => {
    const txs = S.txs.filter((t) => C.dtDate(t.dt) === d); txN += txs.length;
    if (!txs.length) return '';
    return '<div class="drow' + (d === today() ? ' today' : '') + '"><div class="dlabel"><span>' + '월화수목금토일'[i] + '</span><b>' + md(d) + '</b>' + (d === today() ? '<em>오늘</em>' : '') + '</div><div class="dtx">' + txs.map(txHTML).join('') + '</div></div>';
  }).join('');
  const wg = S.games.filter((g) => g.date >= days[0] && g.date <= days[6]);
  const tg = wg.find((g) => !g.postponed && g.teams && g.teams.length >= 2);
  let teamBox = '';
  if (tg) {
    const pl = playersOf(tg), T = tg.teams.map((t) => t.filter((n) => pl.indexOf(n) >= 0));
    const head = '<section class="panel txpanel"><div class="tbhead"><span class="g-lbl2">' + md(tg.date) + ' 팀 편성' + (T.length >= 3 ? ' (3파전)' : '') + ' · ' + (tg.teamsPublic ? '회원 공개 중' : '회원 비공개') + '</span><button class="btn sm" data-team="' + tg.id + '">' + (T.length >= 3 ? '고치기 · 판 기록' : '고치기') + '</button></div>';
    teamBox = head + (T.length >= 3
      ? '<div class="tri sm">' + T.map((t, i) => '<div class="tcol t' + i + '"><div class="tlabel t' + i + '"><b>' + TEAMC[i] + '팀 ' + t.length + '명</b></div><div class="muted">' + esc(t.join(', ')) + '</div></div>').join('') + '</div>'
      : '<div class="tlabels"><div class="tlabel t0"><b>A팀 ' + tCnt(T[0].length) + '</b></div><div class="tlabel t1"><b>B팀 ' + tCnt(T[1].length) + '</b></div></div>' +
        '<div class="pitch sm"><span class="pl-mid"></span><span class="pl-circle"></span><span class="pl-boxL"></span><span class="pl-boxR"></span>' + pitchSide(T[0], 'L', 0, tg.id, true) + pitchSide(T[1], 'R', 1, tg.id, true) + '</div>' + rotNote(T)) + '</section>';
  }
  const side = wg.map(gameHTML).join('') + '<button class="newgame" data-newgame="' + days[6] + '">+ 이번 주 경기 만들기</button>';
  const ym = payYM(), list = C.membersFor(S.members, ym), paid = C.duesPaid(S.txs, ym);
  const unpaid = list.filter((m) => !paid[m.name]);
  const rentPaid = S.txs.some((t) => C.partsOf(t).some((p) => p.cls === '구장비' && p.ym === ym));
  const rent = C.gamesInMonth(S.games, ym).length * (S.cfg.rentPerGame || 0);
  const cur = today().substr(0, 7), curPaid = C.duesPaid(S.txs, cur), curMiss = C.membersFor(S.members, cur).filter((m) => !curPaid[m.name]).map((m) => m.name);
  const foot = '<div class="sumcol">' +
    '<div class="sum"><span>' + mon(ym) + ' 회비 미납</span><b>' + unpaid.length + '<em>명</em></b><small>' + esc(unpaid.map((m) => m.name).join(', ') || '모두 냈어요') + '</small><button class="btn sm" id="dues">' + IC.copy + ' 안내 문구 복사</button></div>' +
    (curMiss.length ? '<div class="sum bad"><span>' + mon(cur) + ' 회비 아직 안 냄</span><b>' + curMiss.length + '<em>명</em></b><small>' + esc(curMiss.join(', ')) + '</small></div>' : '') +
    (rent ? '<div class="sum"><span>' + md(ym + '-01') + ' 구장비 (' + C.gamesInMonth(S.games, ym).length + '경기)</span><b>' + won(rent) + '<em>원</em></b><small>' + (rentPaid ? '납부 완료' : '아직 안 냄') + '</small></div>' : '') +
    '</div>';
  return head + startGuide() + '<div class="wk"><div class="wk-main"><section class="panel txpanel"><div class="g-lbl2">이번 주 입출금 ' + txN + '건 <small>눌러서 자세히 보기·고치기</small></div>' + (rows || '<div class="empty">이번 주 입출금이 없어요</div>') + '</section>' + teamBox + '</div>' +
    '<div class="wk-side">' + side + foot + '</div></div>';
}
function txHTML(t) {
  const io = t.kind === '입금';
  const cls = t.state === '확인필요' ? 'ask' : t.state === '무시' ? 'ign' : '';
  let h = '<div class="tx ' + cls + '"><button class="tx-main" data-edit="' + t.id + '"><span class="tx-top"><span class="tx-name">' + esc(t.desc) + '</span><span class="tx-amt ' + (io ? 'pos' : 'neg') + '">' + (io ? '+' : '−') + won(t.amt) + '</span></span><span class="tx-sub">' + (t.manual ? '<em class="mtag' + (C.diagnoseManual(t, S.txs).code !== 'wait' ? ' bad' : '') + '">직접 입력 · ' + (C.diagnoseManual(t, S.txs).code !== 'wait' ? '확인 필요' : '통장 확인 전') + '</em> ' : '') + esc(partLabel(t)) + '</span></button>';
  if (t.state === '확인필요') {
    const acts = [];
    if (t.suggest && t.suggest.label) acts.push(['sug', t.suggest.label, 'pri']);
    const gN = '게스트 ' + Math.max(1, Math.floor(t.amt / S.cfg.guestFee)) + '명';
    if (io) { if (!(t.suggest && t.suggest.label === gN)) acts.push(['guest', gN]); acts.push(['etcin', '기타수입']); }
    else { acts.push(['refund', '환불']); acts.push(['field', '구장비']); acts.push(['etcout', '기타지출']); }
    acts.push(['ign', '무시']);
    h += '<div class="acts">' + acts.map((a) => '<button class="btn xs ' + (a[2] || '') + '" data-q="' + a[0] + '" data-id="' + t.id + '">' + esc(a[1]) + '</button>').join('') + '</div>';
  }
  return h + '</div>';
}
function gameHTML(g) {
  const att = attOf(g);
  const roster = activeAt(g.date).map((m) => m.name);
  att.forEach((n) => roster.indexOf(n) < 0 && roster.push(n));
  const guests = C.guestNames(S.txs, g.id, att);
  const total = att.length + guests.length;
  const status = sideTxt(total);
  if (g.postponed) return '<div class="game off"><div class="g-head"><b>' + md(g.date) + ' (' + C.dayName(g.date) + ') ' + esc(g.time || '') + '</b><span class="pp">' + esc(g.postponed) + '</span></div><div class="muted">이 경기는 열리지 않았어요. 출석·경기기록 계산에서 빠져요.</div></div>';
  return '<div class="game"><div class="g-head"><b>' + md(g.date) + ' (' + C.dayName(g.date) + ') ' + esc(g.time || '') + '</b><span>정원 ' + (g.cap || S.cfg.cap) + '</span></div>' +
    '<div class="g-total"><b>' + total + '</b><span>명</span><em class="' + (total >= minN() ? 'ok' : 'low') + '">' + status + '</em></div>' +
    cdHTML(g) +
    '<div class="g-sec"><div class="g-lbl">회원 ' + att.length + '명 <small>투표 ' + Object.keys(S.votes[g.id] || {}).length + '명 · 눌러서 직접 체크 · 빨강 = 불참 응답</small></div><div class="chips">' +
    roster.map((n) => { const L = latest(g, n), on = att.indexOf(n) >= 0; return '<button class="mchip' + (on ? ' on' : L && L.v === '불참' ? ' no' : '') + '" data-att="' + esc(n) + '" data-g="' + g.id + '" aria-pressed="' + on + '" title="' + (L ? (L.self ? '회원 투표: ' : '직접 체크: ') + L.v : '응답 없음') + '">' + esc(n) + (L && L.self ? '<i class="vdot"></i>' : '') + '</button>'; }).join('') + '</div></div>' +
    '<button class="dl" data-dl="' + g.id + '">투표 마감 ' + (g.deadline ? esc(g.deadline.replace('T', ' ').substr(5).replace('-', '/')) : '없음 (경기 시작까지)') + ' · 바꾸기</button>' +
    '<div class="g-sec"><div class="g-lbl">게스트 ' + guests.length + '명 <small>입금 기준</small></div><div class="chips">' +
    (guests.length ? guests.map((n) => '<span class="gchip">' + esc(n) + '</span>').join('') : '<span class="g-none">아직 없음</span>') + '</div>' +
    (pullSrc(g) ? '<button class="pullg" data-pull="' + g.id + '">↩ ' + md(pullSrc(g).date) + ' 경기 게스트 ' + guestParts(pullSrc(g).id).filter((x) => !x.p.self).reduce((a, x) => a + (x.p.cnt || 1), 0) + '명 불러오기 (우천·연기)</button>' : '') + '</div>' +
    '<div class="g-btns"><button class="btn g-btn" data-team="' + g.id + '">⚽ 팀 편성' + (g.teams ? ' 보기' : '') + '</button><button class="btn g-btn2" data-recruit="' + g.id + '">' + IC.copy + ' 모집글</button></div></div>';
}
/* ---- 연기된 경기의 게스트를 새 경기로 불러오기 ---- */
function guestParts(gid) { const out = []; S.txs.forEach((t) => { if (t.state === '무시') return; (t.parts || []).forEach((p) => { if (p.cls === '게스트비' && p.gid === gid) out.push({ t, p }); }); }); return out; }
/** 이 경기 바로 전 경기가 이미 지났고(오늘 이전), 게스트가 있고, 아직 연기 처리가 안 됐으면 불러오기 대상 */
function pullSrc(g) {
  const prev = S.games.filter((x) => x.date < g.date && x.date < today()).slice(-1)[0];
  return prev && !prev.postponed && (Date.parse(g.date) - Date.parse(prev.date)) / 864e5 <= 21 && guestParts(prev.id).length ? prev : null;
}
async function pullGuests(gid) {
  const g = S.games.find((x) => x.id === gid), src = pullSrc(g); if (!src) return;
  const list = guestParts(src.id), n = list.filter((x) => !x.p.self).reduce((a, x) => a + (x.p.cnt || 1), 0);
  if (!confirm(md(src.date) + ' 경기 게스트 ' + n + '명을 ' + md(g.date) + ' 경기로 옮길까요?\n\n' + md(src.date) + ' 경기는 "' + md(g.date) + '로 연기"로 표시되고, 출석·경기기록 계산에서 빠져요.')) return;
  const touched = new Set();
  list.forEach(({ t, p }) => { p.gid = g.id; t.note = ((t.note || '') + ' ' + md(src.date) + ' 우천 → ' + md(g.date) + ' 연기').trim(); touched.add(t); });
  src.postponed = md(g.date) + '로 연기';
  await batchPut([...touched].map((t) => ['tx', t.id, t]));
  await putGame(src); render(); toast('게스트 ' + n + '명을 ' + md(g.date) + ' 경기로 불러왔어요');
}
/* ---- 투표 마감 카운트다운 ---- */
function dlTs(g) { return g.deadline ? Date.parse(g.deadline) : Date.parse(g.date + 'T' + (g.time || '23:59')); }
function left(ms) { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), p = (n) => String(n).padStart(2, '0');
  return (d ? d + '일 ' : '') + p(Math.floor(s % 86400 / 3600)) + ':' + p(Math.floor(s % 3600 / 60)) + ':' + p(s % 60); }
function cdHTML(g) {
  const t = dlTs(g);
  if (Date.now() >= t) return '<div class="cd done"><span>투표</span><b>마감됐어요</b></div>';
  const d = new Date(t), dd = C.ymd(d);
  return '<div class="cd" data-cd="' + t + '"><span>투표 마감까지<small>' + md(dd) + '(' + C.dayName(dd) + ') ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' 마감</small></span><b>' + left(t - Date.now()) + '</b></div>';
}
setInterval(() => document.querySelectorAll('[data-cd]').forEach((el) => {
  const ms = +el.dataset.cd - Date.now();
  if (ms <= 0) { el.classList.add('done'); el.removeAttribute('data-cd'); el.querySelector('b').textContent = '마감됐어요'; return; }
  el.querySelector('b').textContent = left(ms);
}), 1000);
function bindWeek() {
  $('#pw').onclick = () => { S.week = C.addDays(S.week, -7); render(); };
  $('#nw').onclick = () => { S.week = C.addDays(S.week, 7); render(); };
  const j = $('#jump'); if (j) j.onclick = () => { const t = S.txs.find((x) => x.state === '확인필요'); S.week = monday(C.dtDate(t.dt)); render(); };
  document.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => editTx(b.dataset.edit)));
  document.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => quick(b.dataset.id, b.dataset.q)));
  document.querySelectorAll('[data-att]').forEach((b) => (b.onclick = async () => {
    const g = S.games.find((x) => x.id === b.dataset.g), n = b.dataset.att;
    const on = attOf(g).indexOf(n) >= 0, vt = (S.votes[g.id] || {})[n];
    g.log = g.log || {};
    if (!on) g.log[n] = { v: '참석', at: Date.now() };
    else {
      g.attend = (g.attend || []).filter((x) => x !== n);
      if (vt && vt.v === '참석') g.log[n] = { v: '불참', at: Date.now() };   // 회원이 참석 눌렀는데 총무가 뺀 경우만 '불참'
      else delete g.log[n];                                                  // 그 외에는 '응답 없음'으로 되돌림
    }
    g.attend = attOf(g);
    render(); await putGame(g);
  }));
  document.querySelectorAll('[data-recruit]').forEach((b) => (b.onclick = () => recruitText(b.dataset.recruit)));
  document.querySelectorAll('[data-pull]').forEach((b) => (b.onclick = () => pullGuests(b.dataset.pull)));
  document.querySelectorAll('[data-team]').forEach((b) => (b.onclick = () => { S.gid = b.dataset.team; S.view = 'team'; S.pick = null; render(); window.scrollTo(0, 0); }));
  document.querySelectorAll('[data-newgame]').forEach((b) => (b.onclick = () => newGameAsk(b.dataset.newgame)));
  document.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = () => editDeadline(b.dataset.dl)));
  const ma = $('#madd'); if (ma) ma.onclick = () => addManual();
  const mc = $('#mchk'); if (mc) mc.onclick = () => checkReport();
  const ml = $('#mlink'), ml2 = $('#mlink2'); if (ml2) ml2.onclick = () => ml.click(); if (ml) ml.onclick = () => copy('⚽ ' + S.club.name + ' 온라인 라커룸에 초대합니다\n' + MEMBER_URL + '\n\n① 링크 열고 구글 로그인\n② 내 실명 쓰고 가입 신청\n③ 관리자 승인 후 바로 입장 🙌\n\n카톡에서 로그인이 안 되면 \'사파리/크롬으로 열기\' 버튼을 눌러주세요.');
  $('#dues').onclick = duesText;
  const tw = $('#tw'); if (tw) tw.onclick = () => { S.week = monday(today()); render(); };
}
/* 종목·인원 설정 (풋살 기본 5~6명, 축구는 설정에서 11명) */
const perSide = () => S.cfg.perSide || 5, maxSide = () => Math.max(perSide(), S.cfg.maxSide || perSide() + 1), minN = () => perSide() * 2;
function sideTxt(total) { return C.sideLabel(total, perSide(), maxSide()); }
function newGameAsk(date) {
  if (S.cfg.dow != null) { const d = new Date(C.addDays(date, -6) + 'T00:00:00'); d.setDate(d.getDate() + ((S.cfg.dow - d.getDay() + 7) % 7)); date = C.ymd(d); }
  modal('<h2>경기 만들기</h2><div class="row"><label class="f">날짜<input id="nd" type="date" value="' + esc(date) + '"></label><label class="f">시간' + timeSel('nt', S.cfg.time || '16:00') + '</label></div>' +
    '<div class="muted">요일·시간 상관없이 만들 수 있어요. 기본 시간은 설정에서 바꿔요.</div><div class="mfoot"><span style="flex:1"></span><button class="btn" id="cx">취소</button><button class="btn pri" id="ok">만들기</button></div>', (m) => {
    m.querySelector('#cx').onclick = closeModal;
    m.querySelector('#ok').onclick = () => { const d = m.querySelector('#nd').value, t = timeVal(m, 'nt'); if (!d) return toast('날짜를 골라주세요'); if (S.games.some((g) => g.id === 'G' + d.replace(/-/g, ''))) return toast('그 날은 이미 경기가 있어요'); closeModal(); newGame(d, t); };
  });
}
async function newGame(date, time) {
  const id = 'G' + date.replace(/-/g, '');
  const g = { id, date, time: time || S.cfg.time || '16:00', type: S.cfg.rentPerGame ? '정기' : '일회성', fee: S.cfg.rentPerGame || S.cfg.oneOff, cap: S.cfg.cap || 12, attend: [], deadline: '' };
  S.games.push(g); S.games.sort((a, b) => (a.date < b.date ? -1 : 1)); render(); await putGame(g); toast(md(date) + ' 경기를 만들었어요'); wxNow(g);
}


/** 경기가 생기면 그 경기 날씨를 바로 받아 회원 화면에 공유 (이후엔 회원 앱이 6시간마다 새로) */
async function wxNow(g) {
  const loc = S.cfg.wxLoc || { lat: 35.8714, lon: 128.6014 };
  if ((Date.parse(g.date) - Date.now()) / 864e5 > 15) return;
  try { const w = await C.fetchWx(loc.lat, loc.lon, g.date, g.time); await setDoc(D('wx', g.id), Object.assign(w, { gid: g.id, date: g.date, time: g.time || '', at: Date.now() })); } catch (e) {}
}
/* ---------------- 팀 편성 ---------------- */
const TEAMC = ['A', 'B', 'C'];
// 팀 인원별 대형 (가로 경기장 왼쪽 절반 기준 x%, y%) · 첫 자리는 GK
const FORM = {
  3: [[8, 50], [30, 30], [30, 70]],
  4: [[8, 50], [22, 50], [38, 28], [38, 72]],
  5: [[8, 50], [20, 50], [31, 22], [31, 78], [43, 50]],
  6: [[8, 50], [19, 28], [19, 72], [30, 50], [43, 25], [43, 75]],
  7: [[8, 50], [19, 28], [19, 72], [30, 22], [30, 78], [43, 36], [43, 64]],
  8: [[6, 50], [17, 22], [17, 50], [17, 78], [30, 25], [30, 50], [30, 75], [43, 50]],
  9: [[6, 50], [17, 22], [17, 50], [17, 78], [30, 25], [30, 50], [30, 75], [43, 35], [43, 65]],
  10: [[6, 50], [16, 15], [16, 38], [16, 62], [16, 85], [29, 25], [29, 50], [29, 75], [43, 35], [43, 65]],
  11: [[6, 50], [16, 15], [16, 38], [16, 62], [16, 85], [30, 15], [30, 38], [30, 62], [30, 85], [43, 35], [43, 65]]
};
const scores = () => (S.skills.scores = S.skills.scores || {});
const bundles = () => (S.skills.bundles = S.skills.bundles || {});
const putSkills = () => setDoc(D('private', 'skills'), { scores: scores(), bundles: bundles() });
function scoreOf(n) { const v = scores()[n]; return v >= 1 && v <= 5 ? v : 3; }
function playersOf(g) { const a = attOf(g); return a.concat(C.guestNames(S.txs, g.id, a)); }

function teamCost(T) {
  const avg = [], hi = [], lo = [], top = [], where = {};
  T.forEach((t, ti) => {
    let s = 0, h = 0, l = 0, v = 0;
    t.forEach((p) => { s += p.s; if (p.s >= 4) h++; if (p.s <= 2) l++; if (p.s === 5) v++; if (p.g) (where[p.g] = where[p.g] || {})[ti] = 1; });
    avg.push(s / Math.max(1, t.length)); hi.push(h); lo.push(l); top.push(v);
  });
  const gap = (a) => Math.max(...a) - Math.min(...a);
  let split = 0; Object.keys(where).forEach((k) => (split += Object.keys(where[k]).length - 1));
  return gap(avg) * 10 + gap(hi) * 0.6 + gap(lo) * 0.6 + gap(top) * 0.6 + split * 3;
}
function makeTeams(names, k) {
  const bd = bundles(), cnt = {};
  const P = names.map((n) => {
    const base = n.replace(/\s*일행\d+$/, ''), g = bd[base] ? '#' + bd[base] : base;
    cnt[g] = (cnt[g] || 0) + 1;
    return { n, s: scoreOf(n), g };
  });
  P.forEach((p) => { if (cnt[p.g] < 2) p.g = ''; });
  k = k || (names.length >= 18 ? 3 : 2); const cand = [];
  let best = 1e9;
  for (let it = 0; it < 3000; it++) {
    const a = P.slice().sort(() => Math.random() - 0.5), T = [...Array(k)].map(() => []);
    a.forEach((p, i) => T[i % k].push(p));
    const c = teamCost(T); cand.push([T, c]); if (c < best) best = c;
  }
  const good = cand.filter((x) => x[1] <= best + 0.3), pick = good[Math.floor(Math.random() * good.length)][0];
  return pick.map((t) => t.map((p) => p.n).sort((x, y) => x.localeCompare(y, 'ko')));
}
function teamOf(g) {
  const players = playersOf(g);
  if (!g.teams) return null;
  const inT = new Set([].concat(...g.teams));
  const missing = players.filter((n) => !inT.has(n)), gone = [...inT].filter((n) => players.indexOf(n) < 0);
  return { teams: g.teams, missing, gone };
}
const numOf = (name) => { const m = S.members.find((x) => x.name === name); const p = m && (S.profs || {})[m.id]; return p && p.num ? p.num : ''; };
function pitchSide(team, side, ti, gid, plain) {
  const ord = C.order(team, gid + ':' + ti), f = FORM[Math.min(11, Math.max(3, ord.length))] || FORM[5];
  return ord.map((name, i) => {
    const pos = f[i] || [46, 10 + ((i - f.length) * 16) % 80];
    const x = side === 'L' ? pos[0] : 100 - pos[0];
    if (plain) return '<div class="tok t' + ti + ' plain" style="left:' + x + '%;top:' + pos[1] + '%"><span class="tok-c">' + numOf(name) + '</span><span class="tok-n">' + esc(name) + (i === 0 ? ' <i>GK</i>' : '') + '</span></div>';
    const sel = S.pick === name ? ' sel' : '';
    return '<button class="tok t' + ti + sel + '" style="left:' + x + '%;top:' + pos[1] + '%" data-pick="' + esc(name) + '" aria-label="' + esc(name) + '"><span class="tok-c">' + (numOf(name) || '') + '</span><span class="tok-n">' + esc(name) + (i === 0 ? ' <i>GK</i>' : '') + '</span></button>';
  }).join('');
}
function teamHTML() {
  const g = S.games.find((x) => x.id === S.gid);
  if (!g) { S.view = 'week'; return weekHTML(); }
  const players = playersOf(g), st = teamOf(g);
  const head = '<div class="toolbar"><button class="btn" id="back">' + IC.l + ' 이번 주</button><b class="t-title">' + md(g.date) + ' (' + C.dayName(g.date) + ') ' + esc(g.time || '') + ' · ' + players.length + '명</b>' +
    '<span style="flex:1"></span><span class="ntg" role="group" aria-label="팀 수"><button class="' + (nTeamsOf(g) === 2 ? 'on' : '') + '" data-nt="2">2팀</button><button class="' + (nTeamsOf(g) === 3 ? 'on' : '') + '" data-nt="3">3파전</button></span>' + (st ? '<button class="btn ' + (g.teamsPublic ? 'on-pub' : '') + '" id="pubT">' + (g.teamsPublic ? '회원에게 공개 중 · 숨기기' : '회원에게 공개하기') + '</button><button class="btn" id="copyT">' + IC.copy + ' 카톡 문구 복사</button>' : '') + '<button class="btn pri" id="mk">' + (st ? '다시 짜기' : '팀 짜기') + '</button></div>';
  if (players.length < 4) return head + '<div class="panel pad">참석자가 ' + players.length + '명이에요. 이번 주 화면에서 회원 참석을 체크하거나 게스트 입금을 확인해 주세요.</div>';
  let warn = '';
  if (st && (st.missing.length || st.gone.length)) warn = '<div class="tnote">팀을 짠 뒤 인원이 바뀌었어요' + (st.missing.length ? ' · 추가: <b>' + esc(st.missing.join(', ')) + '</b>' : '') + (st.gone.length ? ' · 빠짐: <b>' + esc(st.gone.join(', ')) + '</b>' : '') + ' → <button class="btn sm" id="mk2">다시 짜기</button></div>';
  if (!st) return head + '<div class="panel pad center2"><div>참석 <b>' + players.length + '명</b> · 실력 점수가 비슷하게, 일행은 같은 팀으로 짜요.</div><button class="btn pri" id="mk3" style="min-height:48px;padding:0 28px">팀 짜기</button></div>' + scoreList(players);
  const T = st.teams.map((t) => t.filter((n) => players.indexOf(n) >= 0));
  const sum = (t) => t.reduce((a, n) => a + scoreOf(n), 0);
  const label = (t, i) => '<div class="tlabel t' + i + '"><b>' + TEAMC[i] + '팀 ' + (T.length === 2 ? tCnt(t.length) : t.length + '명') + '</b><span>합 ' + sum(t) + '</span></div>';
  if (T.length >= 3) return head + warn + '<div class="tri">' + T.map((t, i) => '<div class="tcol t' + i + '">' + label(t, i) + '<div class="tplist">' + t.map((n) => '<button class="tp' + (S.pick === n ? ' sel' : '') + '" data-pick="' + esc(n) + '">' + (numOf(n) ? '<em>' + numOf(n) + '</em>' : '') + esc(n) + '</button>').join('') + '</div></div>').join('') + '</div>' +
    '<div class="muted" style="margin:8px 0 14px">선수를 <b>꾹 눌러 끌어다</b> 다른 팀 선수 위에 놓으면 서로 바뀌어요 · 한 번씩 눌러서 바꿔도 돼요</div>' + matchPanel(g) + scoreList(players);
  const pitch = '<div class="pitchwrap"><div class="tlabels">' + label(T[0], 0) + label(T[1], 1) + '</div><div class="pitch"><span class="pl-mid"></span><span class="pl-circle"></span><span class="pl-boxL"></span><span class="pl-boxR"></span>' +
    pitchSide(T[0], 'L', 0, g.id) + pitchSide(T[1], 'R', 1, g.id) + '</div>' +
    (T[2] ? '<div class="tlabel t2" style="margin-top:10px"><b>C팀 ' + T[2].length + '명 (대기)</b><span>' + esc(T[2].join(', ')) + '</span></div>' : '') +
    rotNote(T) + '<div class="muted" style="margin-top:8px">동그라미 숫자 = 실력 점수 · 선수를 <b>꾹 눌러 끌어다</b> 상대 팀 선수 위에 놓거나, 차례로 눌러 <b>서로 자리 바꾸기</b> · 점수는 아래에서 고쳐요</div></div>';
  return head + warn + pitch + (needRot(T) ? rotHTML(g, T) : '') + scoreList(players);
}
function triTxt(g) { const M = (S.games.find((x) => x.id === g.id) || {}).matches || []; if (!M.length) return '3파전'; const r = C.standings(3, M)[0]; return '3파전 ' + M.length + '판 · 1위 ' + TEAMC[r.t] + '팀 (승점 ' + r.pts + ')'; }
const nTeamsOf = (g) => g.nTeams || (g.teams && g.teams.length >= 3 ? 3 : playersOf(g).length >= perSide() * 3 ? 3 : 2);
/** 3파전 판 기록: 관리자가 판마다 결과를 넣으면 순위가 자동 계산되고 회원 화면에도 보임 */
const triOf = (g) => Object.assign({ min: 10, rest: 3, n: 9, early: 2, start: g.time || S.cfg.time || '16:00' }, g.tri || {});
const TCI = ['🟠', '🔵', '🟢'];
/** 3파전 진행 방식: 한 판 시간 · 휴식 · 판 수 · 시작 시간 → 타임테이블 (회원 화면에도 공개) */
function triTimeHTML(g) {
  const t = triOf(g), P = C.triPlan(t), T = (g.teams || []).map((x) => x.filter((n) => playersOf(g).indexOf(n) >= 0));
  const num = (k, l, v, mn, mx) => '<label class="f">' + l + '<input type="number" data-tri="' + k + '" min="' + mn + '" max="' + mx + '" inputmode="numeric" value="' + v + '"></label>';
  return '<div class="panel pad"><div class="ph"><div class="g-lbl2">⏱ 3파전 진행 방식 · ' + T.map((x) => x.length).join('/') + '명</div><span><button class="btn sm" id="ttcal">⌚ 알람 받기</button> <button class="btn sm" id="ttcp">' + IC.copy + ' 타임테이블 복사</button></span></div>' +
    '<div class="trow4">' + num('min', '한 판 (분)', P.min, 3, 40) + num('rest', '판 사이 휴식 (분)', P.rest, 0, 20) + num('n', '총 판 수', P.n, 1, 30) + num('early', '마지막 판 일찍 끝내기 (분)', P.early, 0, 10) + '<label class="f">시작 시간<input type="time" data-tri="start" value="' + esc(t.start) + '"></label></div>' +
    '<div class="tpre">빠른 선택 <button class="btn xs" data-tpre="10,3,9">10분 × 9판</button><button class="btn xs" data-tpre="15,6,6">15분 × 6판</button><button class="btn xs" data-tpre="12,4,6">12분 × 6판</button><button class="btn xs" data-tpre="8,2,12">8분 × 12판</button></div>' +
    '<div class="tsum ' + (P.fair ? 'ok' : 'warn') + '">' + (P.fair ? '✅ 공평해요 · 모든 팀이 ' + P.play[0] + '판(' + P.play[0] * P.min + '분) 뛰고 ' + (P.n - P.play[0]) + '판 쉬어요' : '⚠️ 판 수가 3의 배수가 아니라 팀마다 뛰는 판 수가 달라요 (' + P.play.map((x, i) => TEAMC[i] + ' ' + x + '판').join(' · ') + ')') + ' · ' + esc(t.start) + ' 시작 → <b>' + P.end + ' 끝</b> (총 ' + P.total + '분' + (P.early ? ' · 마지막 판 ' + (P.min - P.early) + '분' : '') + ')</div>' +
    '<table class="ttab"><thead><tr><th>판</th><th>시간</th><th>경기</th><th>쉬는 팀</th></tr></thead><tbody>' + P.rows.map((r) => '<tr><td>' + (r.i + 1) + '판</td><td>' + r.s + ' – ' + r.e + '</td><td><b class="tn t' + r.a + '">' + TEAMC[r.a] + '</b> : <b class="tn t' + r.b + '">' + TEAMC[r.b] + '</b></td><td><span class="tn t' + r.off + '">' + TEAMC[r.off] + '</span></td></tr>').join('') + '</tbody></table></div>';
}
/** 3파전 타임테이블 → 캘린더 파일(.ics): 판 시작·종료 시각에 정시 알림 (아이폰 캘린더 → 애플워치로 진동 알림) */
function triIcs(g) {
  const t = triOf(g), P = C.triPlan(t), d = g.date.replace(/-/g, ''), hm = (x) => x.replace(':', '') + '00', now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  // 아이폰 캘린더는 '끝난 시각 기준' 알림을 지원하지 않아서, 판마다 [경기 일정(시작 알림)] + [종료 표시 일정(종료 알림)] 두 개로 만듦
  const evt = (uid, s0, e0, sum, alarms) => ['BEGIN:VEVENT', 'UID:akick-' + g.id + '-' + uid + '@apharmga.github.io', 'DTSTAMP:' + now,
    'DTSTART;TZID=Asia/Seoul:' + d + 'T' + hm(s0), 'DTEND;TZID=Asia/Seoul:' + d + 'T' + hm(e0), 'SUMMARY:' + sum]
    .concat(...alarms.map(([tr, desc]) => ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + desc, 'TRIGGER:' + tr, 'END:VALARM']), ['END:VEVENT']).join('\r\n');
  const ev = [].concat(...P.rows.map((r) => [
    evt(r.i + 1, r.s, r.e, '⚽ ' + (r.i + 1) + '판 ' + TEAMC[r.a] + ':' + TEAMC[r.b] + ' (' + TEAMC[r.off] + ' 휴식)', (r.i ? [['-PT1M', (r.i + 1) + '판 1분 전 · 준비해요 ' + TEAMC[r.a] + ':' + TEAMC[r.b]]] : []).concat([['PT0S', (r.i + 1) + '판 시작 ' + TEAMC[r.a] + ':' + TEAMC[r.b]]])),
    evt((r.i + 1) + 'end', r.e, r.e, '🔔 ' + (r.i + 1) + '판 종료 · 휴식', [['PT0S', (r.i + 1) + '판 종료 · 휴식']])]));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AnQuA//A-KICK//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:A-KICK 3파전',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE']
    .concat(ev, ['END:VCALENDAR']).join('\r\n');
}
function triCal(g) {
  if (IOS_APP) return triAlarms(g);
  const url = URL.createObjectURL(new Blob([triIcs(g)], { type: 'text/calendar;charset=utf-8' })), a = document.createElement('a');
  a.href = url; a.download = 'A-KICK_' + g.date + '_3파전.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('캘린더 파일을 받았어요 · 열어서 [모두 추가]를 누르면 판 시작·종료 정시, 그리고 2판부터는 시작 1분 전에도 알림이 와요', 6000);
}
/** 아이폰 앱: 캘린더 파일 대신 앱 알림으로 바로 등록 (판 시작 · 2판부터 1분 전 · 판 종료) */
async function triAlarms(g) {
  const P = C.triPlan(triOf(g)), at = (hm) => new Date(g.date + 'T' + hm + ':00+09:00'), L = [];
  P.rows.forEach((r) => {
    const vs = TEAMC[r.a] + ':' + TEAMC[r.b];
    if (r.i) L.push({ at: new Date(at(r.s).getTime() - 60000), title: '⏱ ' + (r.i + 1) + '판 1분 전', body: '준비해요 · ' + vs + ' (' + TEAMC[r.off] + ' 휴식)' });
    L.push({ at: at(r.s), title: '⚽ ' + (r.i + 1) + '판 시작', body: vs + ' (' + TEAMC[r.off] + ' 휴식)' });
    L.push({ at: at(r.e), title: '🔔 ' + (r.i + 1) + '판 종료', body: r.i + 1 < P.rows.length ? '휴식 · 다음 판 ' + P.rows[r.i + 1].s : '오늘 경기 끝! 수고했어요' });
  });
  try { const n = await scheduleAlarms(g.id, L); toast(n ? '알림 ' + n + '개를 등록했어요 · 애플워치에도 그대로 울려요' : '이미 지난 경기라 등록할 알림이 없어요', 5000); }
  catch (e) { toast(e.message || '알림 등록 실패', 6000); }
}
function triCopy(g) {
  const t = triOf(g), P = C.triPlan(t);
  return '⚽ ' + md(g.date) + '(' + C.dayName(g.date) + ') 3파전 타임테이블 (' + P.min + '분 × ' + P.n + '판)\n' + P.rows.map((r) => r.s + ' ' + (r.i + 1) + '판 ' + TCI[r.a] + TEAMC[r.a] + ' : ' + TCI[r.b] + TEAMC[r.b] + ' (' + TCI[r.off] + TEAMC[r.off] + ' 휴식)').join('\n') + '\n' + P.end + ' 종료\n- 판 사이 ' + P.rest + '분 휴식' + (P.fair ? ' · 모든 팀 ' + P.play[0] + '판씩 동일' : '') + '\n- 승 3점 · 무 1점 · ' + P.n + '판 후 1위 결정';
}
/* ---------- 2팀 교대(로테이션): 한 팀이 구장 최대 인원(maxSide)보다 많을 때 구간마다 순서대로 쉼 ---------- */
const tCnt = (n) => n > maxSide() ? n + '명 <em class="rotb">🔁 ' + maxSide() + '명 뛰고 ' + (n - maxSide()) + '명 교대</em>' : n + '명';
const rotNote = (T) => needRot(T) ? '<div class="rotnote">🔁 한 팀 ' + maxSide() + '명만 뛰고, 남는 사람은 구간마다 돌아가며 쉬어요 · 그림은 팀 전체 명단이에요</div>' : '';
const needRot = (T) => T.length === 2 && Math.max(T[0].length, T[1].length) > maxSide();
const rotTeams = (g) => (g.teams || []).slice(0, 2).map((x) => x.filter((n) => playersOf(g).indexOf(n) >= 0));
const rotOf = (g) => Object.assign({ min: 15, rest: 2, n: C.rotN(rotTeams(g), maxSide()), early: 0, start: g.time || S.cfg.time || '16:00' }, g.rot || {});
function rotHTML(g, T) {
  const t = rotOf(g), P = C.rotPlan(T, maxSide(), t), F = maxSide();
  const num = (k, l, v, mn, mx) => '<label class="f">' + l + '<input type="number" data-rot="' + k + '" min="' + mn + '" max="' + mx + '" inputmode="numeric" value="' + v + '"></label>';
  const offTxt = (o) => o.length ? o.map(esc).join(', ') : '<span class="muted">-</span>';
  return '<div class="panel pad"><div class="ph"><div class="g-lbl2">🔁 ' + F + '대' + F + ' 교대 타임테이블 · ' + T.map((x) => x.length).join('/') + '명</div><span><button class="btn sm" id="rtcal">⌚ 알람 받기</button> <button class="btn sm" id="rtcp">' + IC.copy + ' 타임테이블 복사</button></span></div>' +
    '<div class="muted" style="margin-bottom:8px">한 팀에 ' + F + '명까지만 뛰어서, 남는 사람이 <b>구간마다 순서대로 쉬어요.</b> 쉬는 순서는 팀 명단 순서예요.</div>' +
    '<div class="trow4">' + num('min', '한 구간 (분)', P.min, 3, 40) + num('rest', '교대 시간 (분)', P.rest, 0, 10) + num('n', '구간 수', P.n, 1, 30) + num('early', '마지막 구간 일찍 끝내기 (분)', P.early, 0, 10) + '<label class="f">시작 시간<input type="time" data-rot="start" value="' + esc(t.start) + '"></label></div>' +
    '<div class="tsum ' + (P.fair ? 'ok' : 'warn') + '">' + (P.fair ? '✅ 공평해요 · 쉬는 사람은 모두 같은 횟수(' + P.min + '분씩)만 쉬어요' : '⚠️ 구간 수 때문에 쉬는 횟수가 사람마다 달라요 · 구간 수를 ' + C.rotN(T, F) + '로 하면 공평해요') + ' · ' + esc(t.start) + ' 시작 → <b>' + P.end + ' 끝</b></div>' +
    '<table class="ttab"><thead><tr><th>구간</th><th>시간</th><th>A팀 휴식</th><th>B팀 휴식</th></tr></thead><tbody>' +
    P.rows.map((r) => '<tr><td>' + (r.i + 1) + '구간</td><td>' + r.s + ' – ' + r.e + '</td><td>' + offTxt(r.off[0]) + '</td><td>' + offTxt(r.off[1]) + '</td></tr>').join('') + '</tbody></table></div>';
}
function rotCopy(g) {
  const T = rotTeams(g), P = C.rotPlan(T, maxSide(), rotOf(g)), F = maxSide();
  return '⚽ ' + md(g.date) + '(' + C.dayName(g.date) + ') ' + F + '대' + F + ' 교대 타임테이블\n(한 팀 ' + F + '명씩 뛰고, 남는 사람은 구간마다 돌아가며 쉬어요)\n\n' +
    P.rows.map((r) => (r.i + 1) + '구간 ' + r.s + '~' + r.e + '\n  🟠A팀 휴식: ' + (r.off[0].join(', ') || '없음') + '\n  🔵B팀 휴식: ' + (r.off[1].join(', ') || '없음')).join('\n') + '\n\n' + P.end + ' 종료 · 교대 시간 ' + P.rest + '분';
}
function rotAlarmList(g) {
  const T = rotTeams(g), P = C.rotPlan(T, maxSide(), rotOf(g)), at = (hm) => new Date(g.date + 'T' + hm + ':00+09:00'), L = [];
  const who = (r) => ['A ' + (r.off[0].join(', ') || '없음'), 'B ' + (r.off[1].join(', ') || '없음')].join(' · ');
  P.rows.forEach((r) => {
    if (r.i) L.push({ at: new Date(at(r.s).getTime() - 60000), s: r.s, title: '⏱ 1분 뒤 ' + (r.i + 1) + '구간 · 교대 준비', body: '쉴 사람: ' + who(r) });
    L.push({ at: at(r.s), s: r.s, title: '⚽ ' + (r.i + 1) + '구간 시작', body: '휴식: ' + who(r) });
  });
  const last = P.rows[P.rows.length - 1];
  L.push({ at: at(last.e), s: last.e, title: '🔔 경기 끝', body: '수고했어요!' });
  return L;
}
function rotCal(g) {
  const L = rotAlarmList(g);
  if (IOS_APP) return scheduleAlarms(g.id + ':rot', L).then((n) => toast(n ? '알림 ' + n + '개를 등록했어요 · 애플워치에도 울려요' : '이미 지난 경기라 등록할 알림이 없어요', 5000)).catch((e) => toast(e.message || '알림 등록 실패', 6000));
  const T = rotTeams(g), P = C.rotPlan(T, maxSide(), rotOf(g)), d = g.date.replace(/-/g, ''), now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', hm = (x) => x.replace(':', '') + '00';
  const who = (r) => 'A ' + (r.off[0].join(', ') || '없음') + ' · B ' + (r.off[1].join(', ') || '없음');
  const evt = (uid, s0, e0, sum, alarms) => ['BEGIN:VEVENT', 'UID:akick-' + g.id + '-rot-' + uid + '@apharmga.github.io', 'DTSTAMP:' + now, 'DTSTART;TZID=Asia/Seoul:' + d + 'T' + hm(s0), 'DTEND;TZID=Asia/Seoul:' + d + 'T' + hm(e0), 'SUMMARY:' + sum]
    .concat(...alarms.map(([tr, desc]) => ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + desc, 'TRIGGER:' + tr, 'END:VALARM']), ['END:VEVENT']).join('\r\n');
  // 구간마다 일정 1개: 시작 정시 알림 + (2구간부터) 1분 전 알림, 마지막에 '경기 끝' 일정
  const ev = P.rows.map((r) => evt(r.i + 1, r.s, r.e, '⚽ ' + (r.i + 1) + '구간 · 휴식 ' + who(r), (r.i ? [['-PT1M', '1분 뒤 ' + (r.i + 1) + '구간 · 쉴 사람 ' + who(r)]] : []).concat([['PT0S', (r.i + 1) + '구간 시작 · 휴식 ' + who(r)]])));
  const last = P.rows[P.rows.length - 1]; ev.push(evt('end', last.e, last.e, '🔔 경기 끝', [['PT0S', '경기 끝 · 수고했어요']]));
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AnQuA//A-KICK//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:A-KICK 교대',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE'].concat(ev, ['END:VCALENDAR']).join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })), a = document.createElement('a');
  a.href = url; a.download = 'A-KICK_' + g.date + '_교대.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('캘린더 파일을 받았어요 · 열어서 [모두 추가]를 누르면 구간 시작마다, 2구간부터는 1분 전에도 알림이 와요', 6000);
}
function matchPanel(g) {
  const M = g.matches || [], R = C.standings(3, M);
  return triTimeHTML(g) + '<div class="panel pad"><div class="ph"><div class="g-lbl2">🏆 3파전 기록 · ' + M.length + '판</div><button class="btn sm pri" id="madd3">+ 판 결과 넣기</button></div>' +
    '<table class="sttab"><thead><tr><th>순위</th><th>팀</th><th>판</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr></thead><tbody>' +
    R.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><b class="tn t' + r.t + '">' + TEAMC[r.t] + '팀</b></td><td>' + r.p + '</td><td>' + r.w + '</td><td>' + r.d + '</td><td>' + r.l + '</td><td>' + (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga) + '</td><td><b>' + r.pts + '</b></td></tr>').join('') + '</tbody></table>' +
    (M.length ? '<div class="mlist">' + M.map((m, i) => '<div class="mrow"><span>' + (i + 1) + '판</span><b class="tn t' + m.a + '">' + TEAMC[m.a] + '</b><strong>' + m.sa + ' : ' + m.sb + '</strong><b class="tn t' + m.b + '">' + TEAMC[m.b] + '</b><button class="x" data-mdel="' + i + '" aria-label="' + (i + 1) + '판 지우기">✕</button></div>').join('') + '</div>' : '<div class="muted" style="margin-top:8px">순서는 A:B → B:C → C:A 고정 (3의 배수 판이면 모든 팀이 똑같이 뛰고 쉬어요). 판이 끝날 때마다 결과를 넣으면 승 3점 · 무 1점으로 순위가 바로 계산돼요.</div>') + '</div>';
}
function addMatch(g) {
  const M = g.matches || [], last = M[M.length - 1];
  const [a, b] = [[0, 1], [1, 2], [2, 0]][M.length % 3];   // 고정 순서 A:B → B:C → C:A (결과 상관없이 모든 팀이 2판 뛰고 1판 쉼)
  const sel = (id, v) => '<select id="' + id + '">' + TEAMC.map((t, i) => '<option value="' + i + '"' + (i === v ? ' selected' : '') + '>' + t + '팀</option>').join('') + '</select>';
  modal('<h2>' + (M.length + 1) + '판 결과</h2><div class="mform"><div>' + sel('ma', a) + '<input id="sa" type="number" min="0" max="30" inputmode="numeric" value="0"></div><span>:</span><div><input id="sb" type="number" min="0" max="30" inputmode="numeric" value="0">' + sel('mb', b) + '</div></div>' +
    '<div class="muted">고정 순서(A:B → B:C → C:A)로 다음 판 팀을 미리 골라둬요. 실제와 다르면 바꿔서 넣으세요.</div><div class="mfoot"><span style="flex:1"></span><button class="btn" id="cx">취소</button><button class="btn pri" id="ok">저장</button></div>', (m) => {
    m.querySelector('#cx').onclick = closeModal;
    m.querySelector('#ok').onclick = async () => {
      const x = { a: +m.querySelector('#ma').value, b: +m.querySelector('#mb').value, sa: Math.max(0, +m.querySelector('#sa').value || 0), sb: Math.max(0, +m.querySelector('#sb').value || 0) };
      if (x.a === x.b) return toast('서로 다른 두 팀을 골라주세요');
      g.matches = M.concat([x]); closeModal(); render(); await putGame(g); toast((M.length + 1) + '판 결과를 넣었어요');
    };
  });
}
function scoreList(players) {
  return '<div class="panel pad"><div class="g-lbl2" style="margin-bottom:10px">실력 점수 (관리자만 보여요 · 카톡에는 이름만 나가요)</div><div class="slist">' +
    players.map((n) => '<div class="srow"><span>' + esc(n) + (scores()[n] ? '' : ' <em class="tag gry">새</em>') + '</span><span class="seg5">' + [1, 2, 3, 4, 5].map((v) => '<button class="' + (scoreOf(n) === v ? 'on' : '') + '" data-sc="' + esc(n) + '" data-v="' + v + '" aria-label="' + esc(n) + ' ' + v + '점">' + v + '</button>').join('') + '</span></div>').join('') +
    '</div><div class="muted" style="margin-top:8px">5 에이스 · 4 잘함 · 3 보통(모르면 3) · 2 초보 · 1 입문</div></div>';
}
function bindTeam() {
  const g = S.games.find((x) => x.id === S.gid); if (!g) return;
  $('#back').onclick = () => { S.view = 'week'; render(); };
  const mk = async () => { g.teams = makeTeams(playersOf(g), nTeamsOf(g)); S.pick = null; render(); await putGame(g); toast('팀을 짰어요 · 다시 누르면 새로 짜요'); };
  document.querySelectorAll('[data-nt]').forEach((b) => (b.onclick = async () => { const k = +b.dataset.nt; if (nTeamsOf(g) === k) return; if ((g.matches || []).length && !confirm('3파전 판 기록이 있어요. 팀 수를 바꾸면 기록이 지워져요. 바꿀까요?')) return; g.nTeams = k; if (k !== 3) delete g.matches; if (g.teams) { g.teams = makeTeams(playersOf(g), k); } S.pick = null; render(); await putGame(g); toast(k === 3 ? '3팀으로 나눴어요 (3파전)' : '2팀으로 나눴어요'); }));
  const m3 = $('#madd3'); if (m3) m3.onclick = () => addMatch(g);
  const saveTri = async (patch) => { g.tri = Object.assign(triOf(g), patch); render(); await putGame(g); };
  document.querySelectorAll('[data-tri]').forEach((el) => (el.onchange = () => { const k = el.dataset.tri; saveTri({ [k]: k === 'start' ? el.value : Math.max(+el.min, Math.min(+el.max, +el.value || 0)) }); }));
  document.querySelectorAll('[data-tpre]').forEach((b) => (b.onclick = () => { const [mi, re, n] = b.dataset.tpre.split(',').map(Number); saveTri({ min: mi, rest: re, n }); }));
  const tc = $('#ttcp'); if (tc) tc.onclick = () => copy(triCopy(g));
  const tcal = $('#ttcal'); if (tcal) tcal.onclick = () => triCal(g);
  const saveRot = async (patch) => { g.rot = Object.assign(rotOf(g), patch); render(); await putGame(g); };
  document.querySelectorAll('[data-rot]').forEach((el) => (el.onchange = () => { const k = el.dataset.rot; saveRot({ [k]: k === 'start' ? el.value : Math.max(+el.min, Math.min(+el.max, +el.value || 0)) }); }));
  const rc = $('#rtcp'); if (rc) rc.onclick = () => copy(rotCopy(g));
  const rcal = $('#rtcal'); if (rcal) rcal.onclick = () => rotCal(g);
  document.querySelectorAll('[data-mdel]').forEach((b) => (b.onclick = async () => { const i = +b.dataset.mdel; if (!confirm((i + 1) + '판 기록을 지울까요?')) return; g.matches = g.matches.filter((_, j) => j !== i); render(); await putGame(g); }));
  ['#mk', '#mk2', '#mk3'].forEach((id) => { const b = $(id); if (b) b.onclick = mk; });
  const pb = $('#pubT'); if (pb) pb.onclick = async () => { g.teamsPublic = !g.teamsPublic; render(); await putGame(g); toast(g.teamsPublic ? '회원 화면에 팀이 보여요' : '회원 화면에서 팀을 숨겼어요'); };
  const cp = $('#copyT'); if (cp) cp.onclick = () => {
    const T = g.teams.map((t) => t.filter((n) => playersOf(g).indexOf(n) >= 0));
    copy('⚽ ' + md(g.date) + '(' + C.dayName(g.date) + ') ' + g.time + ' 팀 편성 (' + playersOf(g).length + '명)\n\n' +
      T.map((t, i) => (i === 0 ? '🟠' : i === 1 ? '🔵' : '🟢') + ' ' + TEAMC[i] + '팀 (' + t.length + '명)\n' + t.join(', ')).join('\n\n') + '\n\n즐겁게 차요! 다치지 않게 조심하세요 🙌');
  };
  const swap = async (a, n) => {
    const ia = g.teams.findIndex((t) => t.indexOf(a) >= 0), ib = g.teams.findIndex((t) => t.indexOf(n) >= 0);
    if (ia < 0 || ib < 0 || ia === ib) return false;
    g.teams[ia][g.teams[ia].indexOf(a)] = n; g.teams[ib][g.teams[ib].indexOf(n)] = a; S.pick = null;
    render(); await putGame(g); toast(a + ' ↔ ' + n + ' 자리 바꿈'); return true;
  };
  document.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = async () => {
    if (dragDone) return;
    const n = b.dataset.pick;
    if (!S.pick) { S.pick = n; return render(); }
    if (S.pick === n) { S.pick = null; return render(); }
    if (!(await swap(S.pick, n))) { S.pick = n; render(); }
  }));
  bindDrag(swap);
  document.querySelectorAll('[data-sc]').forEach((b) => (b.onclick = async () => { scores()[b.dataset.sc] = +b.dataset.v; render(); await putSkills(); }));
}

/** 꾹 눌러서 끌어다 놓기: 0.3초 누르면 선수가 손가락을 따라오고, 다른 팀 선수 위에서 떼면 서로 바뀜 */
let dragDone = false;
function bindDrag(swap) {
  const els = document.querySelectorAll('[data-pick]'); if (!els.length) return;
  let st = null, tm = null, ghost = null, over = null;
  const end = () => { clearTimeout(tm); tm = null; if (ghost) ghost.remove(); ghost = null; if (over) over.classList.remove('dropto'); over = null; if (st && st.el) st.el.classList.remove('dragging'); document.body.classList.remove('pickdrag'); st = null; };
  const at = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest('[data-pick]'); };
  els.forEach((el) => {
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      st = { el, x: e.clientX, y: e.clientY, on: false, id: e.pointerId };
      tm = setTimeout(() => {
        if (!st) return; st.on = true; dragDone = true; el.classList.add('dragging'); document.body.classList.add('pickdrag');
        ghost = el.cloneNode(true); ghost.className = el.className.replace('dragging', '') + ' dragghost'; ghost.removeAttribute('style');
        const r = el.getBoundingClientRect(); ghost.style.width = r.width + 'px'; document.body.appendChild(ghost);
        ghost.style.left = st.x + 'px'; ghost.style.top = st.y + 'px';
        if (navigator.vibrate) navigator.vibrate(15);
      }, 300);
    });
  });
  const move = (e) => {
    if (!st) return;
    if (!st.on) { if (Math.abs(e.clientX - st.x) > 8 || Math.abs(e.clientY - st.y) > 8) end(); return; }
    ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    const t = at(e.clientX, e.clientY), ok = t && t !== st.el ? t : null;
    if (over !== ok) { if (over) over.classList.remove('dropto'); over = ok; if (over) over.classList.add('dropto'); }
  };
  const up = (e) => {
    if (!st) return; const was = st.on, from = st.el.dataset.pick, t = was ? at(e.clientX, e.clientY) : null; end();
    if (was) { setTimeout(() => (dragDone = false), 50); if (t && t.dataset.pick !== from) swap(from, t.dataset.pick); }
  };
  document.onpointermove = move; document.onpointerup = up; document.onpointercancel = () => { end(); dragDone = false; };
  if (!window.__dragTouch) { window.__dragTouch = 1; document.addEventListener('touchmove', (e) => { if (document.body.classList.contains('pickdrag')) e.preventDefault(); }, { passive: false }); }
}
function editDeadline(gid) {
  const g = S.games.find((x) => x.id === gid), def = C.addDays(g.date, -1) + 'T22:00';
  modal('<h2>' + md(g.date) + ' 경기 · 투표 마감</h2><div class="row"><label class="f">마감 날짜<input id="dlv" type="date" value="' + esc((g.deadline || def).substr(0, 10)) + '"></label><label class="f">마감 시간' + timeSel('dlt', (g.deadline || def).substr(11, 5)) + '</label></div><div class="muted">마감이 지나면 회원 화면의 투표 버튼이 잠겨요. 비우면 경기 시작까지 투표할 수 있어요.</div>' +
    '<div class="mfoot"><button class="btn ghost" id="clr">마감 없음</button><span style="flex:1"></span><button class="btn" id="cx">취소</button><button class="btn pri" id="ok">저장</button></div>', (m) => {
    m.querySelector('#cx').onclick = closeModal;
    m.querySelector('#clr').onclick = async () => { g.deadline = ''; closeModal(); render(); await putGame(g); };
    m.querySelector('#ok').onclick = async () => { g.deadline = m.querySelector('#dlv').value ? m.querySelector('#dlv').value + 'T' + timeVal(m, 'dlt') : ''; closeModal(); render(); await putGame(g); toast('투표 마감을 저장했어요'); };
  });
}

/* ---------------- 회원 화면용 공개 데이터 (실력 점수·거래 상세는 넣지 않음) ---------------- */
let pubT = null;
function schedulePublish() { if (!S.cfg) return; clearTimeout(pubT); pubT = setTimeout(() => publish().catch(() => {}), 1200); }
function pubData() {
  const t = today(), ym = payYM(), list = C.membersFor(S.members, ym), paid = C.duesPaid(S.txs, ym);
  const act = S.members.filter((m) => m.state !== '탈퇴');
  const games = S.games.filter((g) => g.date >= t).slice(0, 2).map((g) => {
    const a = attOf(g);
    return { id: g.id, date: g.date, postponed: !!g.postponed, time: g.time || '', cap: g.cap || S.cfg.cap, deadline: g.deadline || '', attend: a,
             guests: C.guestNames(S.txs, g.id, a), teams: g.teamsPublic && g.teams ? g.teams.map((x) => x.filter((n) => playersOf(g).indexOf(n) >= 0).join('|')) : [], matches: g.teamsPublic && g.matches ? g.matches : [], tri: g.teamsPublic && g.teams && g.teams.length >= 3 ? triOf(g) : null, rot: g.teamsPublic && g.teams && g.teams.length === 2 && needRot(rotTeams(g)) ? rotOf(g) : null };
  });
  const past = S.games.filter((g) => g.date < t && !g.postponed);
  const records = {};
  act.forEach((m) => {
    const mine = past.filter((g) => !m.join || g.date >= m.join), hits = mine.map((g) => attOf(g).indexOf(m.name) >= 0);
    records[m.name] = { total: mine.length, came: hits.filter(Boolean).length, last: hits.slice(-8).map((x) => (x ? 1 : 0)) };
  });
  const ledger = [];
  for (let k = 2; k >= 0; k--) {
    const y = C.addYM(t.substr(0, 7), -k), b = C.book(S.txs, S.games, y), end = S.txs.filter((x) => C.ymOf(x.dt) <= y);
    ledger.push({ ym: y, fee: b.fee, guest: b.guest, guestN: b.guestN, field: b.field, etcIn: b.etcIn, etcOut: b.etcOut, net: b.net, end: end.length ? C.balance(end) : 0 });
  }
  let bal = 0;
  const txs = S.txs.map((x) => { bal = !x.manual && x.bal ? x.bal : bal + (x.kind === '입금' ? x.amt : -x.amt); return { dt: x.dt.substr(0, 16).replace(/\./g, '-'), io: x.kind === '입금' ? 1 : 0, amt: x.amt, who: x.desc, what: x.state === '확인필요' ? '관리자 확인 중' : partLabel(x), off: x.state === '무시' ? 1 : 0, bal, pend: x.manual ? 1 : 0 }; }).slice(-1500);
  const played = S.games.filter((g) => g.date <= t && g.date >= statFrom() && !g.postponed).slice(-200).map((g) => { const pl = playersOf(g); return { id: g.id, date: g.date, players: pl, teams: g.teams ? g.teams.map((x) => x.filter((n) => pl.indexOf(n) >= 0).join('|')) : [], matches: g.matches || [] }; });
  return { updatedAt: new Date().toISOString(), xpAdj: S.cfg.xpAdj || {}, wxLoc: S.cfg.wxLoc || null, club: S.club.name, sport: S.cfg.sport || '', perSide: perSide(), maxSide: maxSide(), txs, played, statFrom: statFrom(), place: S.cfg.place || '', members: act.map((m) => ({ id: m.id, name: m.name })), games, records, ledger,
           dues: { ym, fee: S.cfg.fee, dueDay: S.cfg.dueDay || 30, account: S.cfg.account || '', paid: list.filter((m) => paid[m.name]).map((m) => m.name), unpaid: list.filter((m) => !paid[m.name]).map((m) => m.name) } };
}
async function publish() {
  await setDoc(D('pub', 'state'), pubData());
  // 추천 '활성 팀' 판정용 요약 (연결된 회원 수 · 치른 경기 수) → 추천한 관리자가 볼 수 있음
  if (!S.claimsLoaded) return;
  const st = { m: Object.keys(S.claims || {}).length, g: S.games.filter((g) => g.date <= today() && !g.postponed).length };
  if (JSON.stringify(st) !== JSON.stringify(S.club.stat || null)) { S.club.stat = st; await setDoc(doc(db, 'clubs', CID), { stat: st }, { merge: true }).catch(() => {}); }
}

/* ---- 빠른 처리 ---- */
async function quick(id, q) {
  const t = S.txs.find((x) => x.id === id), GF = S.cfg.guestFee;
  if (q === 'sug' && t.suggest) {
    if (t.suggest.state === '무시') q = 'ign';
    else if (t.suggest.cls === '게스트비') q = 'guest';
    else if (t.suggest.cls === '환불') q = 'refund';
    else return editTx(id, t.suggest.cls);
  }
  if (q === 'guest') {
    const n = Math.max(1, Math.floor(t.amt / GF)), g = C.nearestGame(S.games, t.dt, cfgC());
    t.parts = [{ cls: '게스트비', amt: t.amt, cnt: n, name: t.desc, gid: g ? g.id : '' }];
  } else if (q === 'refund') t.parts = [{ cls: '환불', amt: t.amt, name: (t.suggest && t.suggest.name) || t.desc }];
  else if (q === 'field') { const g = C.nextGameAfter(S.games, t.dt); t.parts = [{ cls: '구장비', amt: t.amt, gid: g ? g.id : '' }]; }
  else if (q === 'etcin') t.parts = [{ cls: '기타수입', amt: t.amt }];
  else if (q === 'etcout') t.parts = [{ cls: '기타지출', amt: t.amt }];
  else if (q === 'ign') { t.parts = []; t.state = '무시'; t.reason = '무시'; }
  if (q !== 'ign') { t.state = '확인'; t.reason = ''; }
  delete t.suggest;
  render(); await putTx(t); toast('처리했어요 · 틀렸으면 카드를 눌러 고치세요');
}

/* ---- 거래 수정 ---- */
const CLS = ['회비', '첫달회비', '게스트비', '구장비', '환불', '기타수입', '기타지출', '이자'];
function editTx(id, presetCls) {
  const t = S.txs.find((x) => x.id === id);
  let parts = JSON.parse(JSON.stringify(t.parts || []));
  if (!parts.length) parts = [{ cls: presetCls || (t.kind === '입금' ? '게스트비' : '기타지출'), amt: t.amt }];
  parts.forEach((p) => { if (p.cls === '게스트비' && !p.cnt && S.cfg.guestFee && p.amt % S.cfg.guestFee === 0) p.cnt = p.amt / S.cfg.guestFee; });
  if (presetCls === '회비') Object.assign(parts[0], { names: [t.desc], ym: payYM() });
  const gOpts = (sel) => '<option value="">— 경기 선택 —</option>' + S.games.slice(-12).map((g) => '<option value="' + g.id + '"' + (g.id === sel ? ' selected' : '') + '>' + md(g.date) + ' (' + C.dayName(g.date) + ')</option>').join('');
  const partHTML = (p, i) => '<div class="part" data-i="' + i + '"><div class="row">' +
    '<label class="f">분류<select data-k="cls">' + CLS.map((c) => '<option' + (c === p.cls ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>' +
    '<label class="f">금액<input data-k="amt" type="number" value="' + (p.amt || 0) + '"></label>' +
    '<label class="f">이름 (여러 명은 쉼표)<input data-k="names" value="' + esc((p.names && p.names.length ? p.names : [p.name || '']).join(', ')) + '"></label></div><div class="row">' +
    '<label class="f">귀속월 (회비·정기대관)<input data-k="ym" placeholder="2026-11" value="' + esc(p.ym || '') + '"></label>' +
    '<label class="f">경기 (게스트비)' + (p.cls === '게스트비' ? ' <b class="req">필수</b>' : '') + '<select data-k="gid"' + (p.cls === '게스트비' && !p.gid ? ' class="need"' : '') + '>' + gOpts(p.gid) + '</select></label>' +
    '<label class="f">인원<input data-k="cnt" type="number" min="1" value="' + (p.cnt || 1) + '"></label></div>' +
    (parts.length > 1 ? '<button class="btn ghost" data-del="' + i + '">이 항목 삭제</button>' : '') + '</div>';
  const draw = () => modal('<h2>' + esc(t.desc) + ' · ' + (t.kind === '입금' ? '' : '−') + won(t.amt) + '원</h2><div class="muted">' + esc(t.dt) + (t.note ? ' · ' + esc(t.note) : '') + '</div>' +
    parts.map(partHTML).join('') +
    '<div class="row"><button class="btn" id="add">+ 나눠 넣기 (예: 회비 + 경기비)</button><button class="btn" id="nextg">게스트비 → 다음 경기로 이월</button></div>' +
    '<label class="f">메모<input id="note" value="' + esc(t.note || '') + '"></label>' +
    (t.manual ? manualTools(t) : '') +
    '<div class="row"><button class="btn ghost" id="ign">무시(장부 제외)</button><button class="btn" id="cancel">취소</button><button class="btn pri" id="save">저장</button></div>', (m) => {
    const read = () => m.querySelectorAll('.part').forEach((el) => {
      const p = parts[+el.dataset.i], v = (k) => el.querySelector('[data-k="' + k + '"]').value.trim();
      p.cls = v('cls'); p.amt = +v('amt') || 0; p.cnt = +v('cnt') || 1; p.ym = v('ym'); p.gid = v('gid');
      const ns = v('names').split(',').map((x) => x.trim()).filter(Boolean);
      if (p.cls === '회비' || p.cls === '첫달회비') { p.names = ns; delete p.name; }
      else if (p.cls === '게스트비' && ns.length > 1) { p.name = ns[0]; p.names = ns; p.cnt = Math.max(p.cnt, ns.length); }   // 게스트 이름 여러 명 → 인원도 맞춤
      else { p.name = ns[0] || ''; delete p.names; }
      if (p.cls !== '게스트비') { delete p.cnt; }
      if (!p.ym) delete p.ym; if (!p.gid) delete p.gid;
    });
    m.querySelector('#add').onclick = () => { read(); const used = parts.reduce((a, p) => a + p.amt, 0); parts.push({ cls: '게스트비', amt: Math.max(0, t.amt - used), cnt: 1 }); draw(); };
    m.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { read(); parts.splice(+b.dataset.del, 1); draw(); }));
    m.querySelector('#nextg').onclick = () => {
      read(); const p = parts.find((x) => x.cls === '게스트비'); if (!p) return toast('게스트비 항목이 없어요');
      const cur = S.games.find((g) => g.id === p.gid), nx = S.games.find((g) => g.date > (cur ? cur.date : C.dtDate(t.dt)));
      if (!nx) return toast('다음 경기가 아직 없어요. 경기를 먼저 만들어 주세요.');
      p.gid = nx.id; t.note = ((t.note || '') + ' ' + (cur ? md(cur.date) : '') + ' → ' + md(nx.date) + ' 이월').trim(); draw();
    };
    m.querySelector('#cancel').onclick = closeModal;
    bindManualTools(m, t);
    m.querySelector('#ign').onclick = async () => { t.state = '무시'; t.parts = []; t.reason = '무시'; delete t.suggest; closeModal(); render(); await putTx(t); };
    m.querySelector('#save').onclick = async () => {
      read();
      if (t.manual) {                                    // 직접 입력 건: 날짜·이름·금액 고친 것도 함께 저장
        const d = m.querySelector('#fxd').value, n = m.querySelector('#fxn').value.trim(), a = +m.querySelector('#fxa').value || 0;
        if (!d || !n || !a) return toast('날짜·이름·금액을 넣어주세요');
        const amtChanged = a !== t.amt; t.dt = d.replace(/-/g, '.') + ' 12:00:00'; t.desc = n; t.amt = a;
        if (amtChanged) {
          const r = C.classify(t, { cfg: cfgC(), games: S.games, members: S.members, alias: C.aliasMap(S.members), done: S.txs.filter((x) => x.id !== t.id) });
          t.parts = r.parts; t.state = r.state; t.reason = r.reason || ''; if (r.suggest) t.suggest = r.suggest; else delete t.suggest;
          t.note = m.querySelector('#note').value.trim(); S.txs.sort((x, y) => (x.dt < y.dt ? -1 : 1));
          const g2 = (t.parts || []).filter((p) => p.cls === '게스트비');
          if (g2.length) { g2.forEach((p) => delete p.gid); t.state = '확인필요'; t.reason = '게스트비 경기 선택 필요'; closeModal(); render(); await putTx(t); editTx(t.id); return toast('금액을 바꿨어요 · 게스트 ' + g2.reduce((a, p) => a + (p.cnt || 1), 0) + '명 · 어느 경기인지 골라주세요', 6000); }
          closeModal(); render(); await putTx(t); toast('금액을 바꿔서 분류를 다시 잡았어요 · ' + (t.reason || '확인 필요'), 6000); return;
        }
        S.txs.sort((x, y) => (x.dt < y.dt ? -1 : 1));
      }
      if (parts.some((p) => p.cls === '게스트비' && !p.gid)) { m.querySelectorAll('[data-k="gid"]').forEach((el) => !el.value && el.classList.add('need')); return toast('게스트비는 어느 경기인지 꼭 골라주세요', 5000); }
      const sum = parts.reduce((a, p) => a + p.amt, 0);
      if (sum !== t.amt) return toast('나눈 금액 합계(' + won(sum) + ')가 거래 금액(' + won(t.amt) + ')과 달라요', 5000);
      t.parts = parts; t.state = '확인'; t.reason = ''; t.note = m.querySelector('#note').value.trim(); delete t.suggest;
      closeModal(); render(); await putTx(t);
      const gp = parts.filter((p) => p.cls === '게스트비'), gg = gp.length && S.games.find((g) => g.id === gp[0].gid);
      toast(gg ? '저장했어요 · ' + md(gg.date) + ' 경기 게스트 ' + gp.reduce((a, p) => a + (p.cnt || 1), 0) + '명으로 잡혔어요' : '저장했어요', 5000);
    };
  });
  draw();
}

/* ---- 직접 입력 (통장 엑셀 없이 한 건씩) ----
   구글시트 시절 겪은 문제를 막는 장치:
   ① 엑셀을 나중에 넣으면 같은 돈이 두 번 잡힘 → 엑셀 넣을 때 같은 거래(같은 금액·구분, 하루 차이, 이름 비슷)를 찾아 자동으로 합침
   ② 합칠 때 직접 고른 분류가 사라짐 → 분류·메모를 통장 거래가 그대로 이어받음
   ③ 이미 통장 엑셀에 있는 걸 또 입력 → 저장 전에 알려줌 / 같은 건 두 번 입력 → 한 번 더 확인
   ④ 이름이 달라 짝을 못 찾으면 영원히 남음 → '통장에 안 보여요' 경고 + 직접 짝 지어주기·지우기
   ⑤ 잔액이 헷갈림 → 직접 입력 건은 '통장 확인 전'으로 따로 표시 */
function addManual() {
  const names = [...new Set(S.members.filter((m) => m.state !== '탈퇴').map((m) => m.name).concat(S.txs.slice(-300).map((t) => t.desc)))].slice(0, 200);
  const F = { kind: '입금', date: today(), amt: 0, name: '', memo: '' };
  const chips = () => (F.kind === '입금' ? [['회비', S.cfg.fee], ['게스트 1명', S.cfg.guestFee], ['게스트 2명', S.cfg.guestFee * 2]] : [['구장비(1회)', S.cfg.rentPerGame || S.cfg.oneOff], ['일회성 구장', S.cfg.oneOff]])
    .filter((c) => c[1]).map((c) => '<button class="btn xs" data-amt="' + c[1] + '">' + c[0] + ' ' + won(c[1]) + '</button>').join('');
  modal('<h2>직접 입력</h2><div class="muted">통장 엑셀 없이 한 건씩 넣어요. 나중에 엑셀을 넣으면 같은 거래와 자동으로 합쳐져서 두 번 잡히지 않아요.</div>' +
    '<div class="seg"><button data-kind="입금" class="on">입금</button><button data-kind="출금">출금</button></div>' +
    '<div class="row"><label class="f">날짜<input id="md" type="date" value="' + F.date + '"></label><label class="f"><span id="mnl">보낸 사람</span><input id="mn" list="mnlist" placeholder="통장에 찍힌 이름"></label></div><datalist id="mnlist">' + names.map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist>' +
    '<label class="f">금액<input id="ma" type="number" inputmode="numeric" placeholder="원"></label><div class="row" id="mchips">' + chips() + '</div>' +
    '<label class="f" id="mgw" hidden>어느 경기 게스트비인가요? <b class="req">필수</b><select id="mg"><option value="">— 경기 선택 —</option>' + S.games.filter((g) => !g.postponed).slice(-8).reverse().map((g) => '<option value="' + g.id + '">' + md(g.date) + ' (' + C.dayName(g.date) + ')</option>').join('') + '</select></label>' +
    '<label class="f">메모 (선택)<input id="mm" maxlength="40"></label>' +
    '<div class="mprev" id="mprev">이름과 금액을 넣으면 어떻게 분류될지 보여드려요</div>' +
    '<div class="mfoot"><span style="flex:1"></span><button class="btn" id="mx">취소</button><button class="btn pri" id="mok">저장</button></div>', (m) => {
    const read = () => { F.date = m.querySelector('#md').value; F.name = m.querySelector('#mn').value.trim(); F.amt = +m.querySelector('#ma').value || 0; F.memo = m.querySelector('#mm').value.trim(); };
    const mk = () => ({ id: 'H' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), dt: F.date.replace(/-/g, '.') + ' 12:00:00', kind: F.kind, amt: F.amt, desc: F.name, bal: 0, type: '직접입력', memo: F.memo, manual: true });
    const prev = () => {
      read(); const box = m.querySelector('#mprev');
      if (!F.name || !F.amt || !F.date) { box.textContent = '이름과 금액을 넣으면 어떻게 분류될지 보여드려요'; box.className = 'mprev'; return null; }
      const t = mk(), dupBank = S.txs.find((x) => !x.manual && C.sameTx(t, x)), dupMan = S.txs.find((x) => x.manual && C.sameTx(t, x, 0));
      const r = C.classify(t, { cfg: cfgC(), games: S.games, members: S.members, alias: C.aliasMap(S.members), done: S.txs.slice() });
      let dg = null; const dg0 = !dupBank && !dupMan ? C.diagnoseManual(t, S.txs) : null;
      box.className = 'mprev' + (dupBank || dupMan || (dg0 && dg0.code !== 'wait') ? ' warn' : '');
      box.innerHTML = dupBank ? '⚠ 통장 내역에 이미 있어요: ' + esc(dupBank.dt.substr(5, 11)) + ' ' + esc(dupBank.desc) + ' ' + won(dupBank.amt) + '원 — 따로 넣을 필요 없어요'
        : dupMan ? '⚠ 같은 건을 이미 직접 입력했어요 (' + esc(dupMan.dt.substr(5, 5)) + '). 진짜 두 번째 입금일 때만 저장하세요'
        : (dg = C.diagnoseManual(t, S.txs)).code !== 'wait' ? '⚠ ' + esc(dg.msg) + '<br><small>그래도 맞으면 저장하세요. 자동 분류: ' + esc(r.reason || '확인 필요') + '</small>'
        : '자동 분류: <b>' + esc(r.state === '확인필요' ? '확인 필요 — ' + (r.reason || '') : r.reason || '') + '</b> <small>(저장 후 눌러서 바꿀 수 있어요)</small>';
      m.querySelector('#mgw').hidden = !(r.parts || []).some((p) => p.cls === '게스트비');
      return { t, r, dupBank, dupMan };
    };
    const bindChips = () => m.querySelectorAll('[data-amt]').forEach((b) => (b.onclick = () => { m.querySelector('#ma').value = b.dataset.amt; prev(); }));
    m.querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => {
      F.kind = b.dataset.kind; m.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b));
      m.querySelector('#mnl').textContent = F.kind === '입금' ? '보낸 사람' : '받는 곳';
      m.querySelector('#mchips').innerHTML = chips(); bindChips(); prev();
    }));
    bindChips();
    ['#md', '#mn', '#ma', '#mm'].forEach((id) => (m.querySelector(id).oninput = prev));
    m.querySelector('#mg').onchange = (e) => e.target.classList.remove('need');
    m.querySelector('#mx').onclick = closeModal;
    m.querySelector('#mok').onclick = async () => {
      const x = prev(); if (!x) return toast('날짜·이름·금액을 넣어주세요');
      if (x.dupBank && !confirm('통장 내역에 같은 거래가 이미 있어요.\n그래도 따로 저장할까요? (다른 입금일 때만)')) return;
      if (x.dupMan && !confirm('같은 건을 이미 직접 입력했어요.\n진짜 두 번째 입금이에요?')) return;
      const isGuest = (x.r.parts || []).some((p) => p.cls === '게스트비'), gsel = m.querySelector('#mg').value;
      if (isGuest && !gsel) { m.querySelector('#mg').classList.add('need'); return toast('게스트비는 어느 경기인지 꼭 골라주세요', 5000); }
      if (isGuest) x.r.parts.forEach((p) => { if (p.cls === '게스트비') p.gid = gsel; });
      const t = x.t; t.parts = x.r.parts; t.state = x.r.state; t.reason = x.r.reason || ''; if (x.r.suggest) t.suggest = x.r.suggest; t.addedAt = new Date().toISOString();
      S.txs = S.txs.concat([t]).sort((a, b) => (a.dt < b.dt ? -1 : 1)); closeModal(); render(); await putTx(t);
      const gg = isGuest && S.games.find((g) => g.id === gsel);
      toast('저장했어요 · ' + (t.state === '확인필요' ? '분류를 골라주세요' : gg ? md(gg.date) + ' 경기 ' + t.reason : t.reason), 5000);
      if (t.state === '확인필요') editTx(t.id);
    };
  });
}
function manualTools(t) {
  const dg = C.diagnoseManual(t, S.txs);
  return '<div class="mtool"><div class="g-lbl2">직접 입력한 거래 · 통장과 맞춰본 결과</div>' +
    '<div class="mdiag ' + (dg.code === 'wait' ? '' : 'warn') + '">' + (dg.code === 'wait' ? '⏳ ' : '⚠ ') + esc(dg.msg) + '</div>' +
    dg.cands.map((x) => '<button class="btn xs" data-merge="' + x.id + '">' + esc(x.dt.substr(5, 11)) + ' ' + esc(x.desc) + ' ' + won(x.amt) + '원' + (x.amt !== t.amt ? '이 맞아요 (통장 기준으로 합치기)' : '과 합치기') + '</button>').join('') +
    '<div class="row"><label class="f">날짜<input id="fxd" type="date" value="' + C.dtDate(t.dt) + '"></label><label class="f">이름<input id="fxn" value="' + esc(t.desc) + '"></label><label class="f">금액<input id="fxa" type="number" value="' + t.amt + '"></label></div>' +
    '<div class="muted">날짜·이름·금액을 고치고 아래 [저장]을 누르세요. 금액을 바꾸면 분류는 새 금액으로 다시 잡혀요.</div><button class="btn xs danger" id="mdel">🗑 직접 입력 삭제</button></div>';
}
function bindManualTools(m, t) {
  if (!t.manual) return;
  m.querySelectorAll('[data-merge]').forEach((b) => (b.onclick = async () => {
    const x = S.txs.find((y) => y.id === b.dataset.merge);
    const same = x.amt === t.amt;
    if (!confirm(x.desc + ' ' + won(x.amt) + '원(통장)과 합칠까요?\n' + (same ? '직접 고른 분류가 통장 거래로 옮겨가고, ' : '금액이 달라서 통장 금액·분류를 그대로 쓰고, ') + '직접 입력 건은 지워져요.')) return;
    if (same) { x.parts = t.parts; x.state = t.state; x.reason = t.reason; } x.note = [x.note, t.note, '직접 입력(' + md(C.dtDate(t.dt)) + ')과 합침'].filter(Boolean).join(' · '); delete x.suggest;
    S.txs = S.txs.filter((y) => y.id !== t.id); closeModal(); render();
    await putTx(x); await deleteDoc(D('tx', t.id)).catch(fail); toast('합쳤어요');
  }));
  m.querySelector('#mdel').onclick = async () => {
    if (!confirm(t.desc + ' ' + won(t.amt) + '원 직접 입력을 삭제할까요?\n(통장 엑셀로 들어온 거래는 그대로 남아요)')) return;
    S.txs = S.txs.filter((y) => y.id !== t.id); closeModal(); render(); schedulePublish();
    await deleteDoc(D('tx', t.id)).catch(fail); toast('지웠어요');
  };
}

/* ---- 카카오뱅크 엑셀 넣기 ---- */
/* 통장 엑셀 읽기: xlsx·xls·csv(한글 깨짐 자동 처리) · 비밀번호 걸린 파일 안내 */
async function bankRows(file) {
  const buf = await file.arrayBuffer();
  let wb;
  try {
    if (/\.csv$/i.test(file.name)) {
      let txt = new TextDecoder('utf-8').decode(buf);
      if (txt.indexOf('\uFFFD') >= 0) txt = new TextDecoder('euc-kr').decode(buf);
      wb = XLSX.read(txt, { type: 'string', cellDates: true });
    } else wb = XLSX.read(buf, { cellDates: true });
  } catch (e) {
    if (/password|encrypt|ECMA-376|CFB/i.test(e.message)) throw new Error('비밀번호가 걸린 엑셀이에요. 엑셀에서 열고 [다른 이름으로 저장] → 비밀번호 없이 저장한 파일을 넣어주세요.');
    throw new Error('엑셀 파일을 열지 못했어요: ' + e.message);
  }
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
}
const hN = (v) => String(v == null ? '' : v).replace(/\s/g, '');
/** 전에 '칸 고르기'로 알려준 은행 양식이면 그 설정으로 */
function savedMap(rows) {
  for (const m of (S.cfg.bankMaps || [])) {
    const r = rows.findIndex((row) => (row || []).map(hN).join('|') === m.sig);
    if (r >= 0) return { hr: r, c: m.c };
  }
  return null;
}
/** 자동 인식 실패 → 엑셀 첫 줄들을 보여주고 칸을 한 번만 골라주면 다음부터 자동 */
function mapBank(rows, file) {
  const top = rows.slice(0, 15), W = Math.min(12, Math.max(...top.map((r) => (r || []).length), 1));
  const ROLE = [['', '안 씀'], ['dt', '날짜(일시)'], ['tm', '시간'], ['in', '입금액'], ['out', '출금액'], ['amt', '금액(±)'], ['kind', '입금/출금 구분'], ['desc', '입금자·내용'], ['bal', '잔액'], ['memo', '메모']];
  const cellT = (v) => esc(v instanceof Date ? C.dtStr(v) : v == null ? '' : String(v)).slice(0, 22);
  let hr = 0;
  modal('<h2>통장 엑셀 칸 알려주기</h2><div class="muted">처음 보는 은행 양식이에요. ① 칸 제목이 있는 줄을 누르고 ② 각 칸이 무엇인지 골라주세요. 한 번만 하면 다음부터 자동으로 읽어요.</div>' +
    '<div class="bmap"><table><tbody>' + top.map((r, i) => '<tr data-hr="' + i + '"><th>' + (i + 1) + '</th>' + [...Array(W)].map((_, j) => '<td>' + cellT((r || [])[j]) + '</td>').join('') + '</tr>').join('') + '</tbody>' +
    '<tfoot><tr><th></th>' + [...Array(W)].map((_, j) => '<td><select data-col="' + j + '">' + ROLE.map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select></td>').join('') + '</tr></tfoot></table></div>' +
    '<div class="mfoot"><span class="muted" id="bmmsg">필수: 날짜 · (입금액·출금액 또는 금액) · 입금자</span><span style="flex:1"></span><button class="btn" id="bmx">취소</button><button class="btn pri" id="bmok">이걸로 읽기</button></div>', (m) => {
    const pick = (i) => { hr = i; m.querySelectorAll('[data-hr]').forEach((tr) => tr.classList.toggle('on', +tr.dataset.hr === i)); };
    m.querySelectorAll('[data-hr]').forEach((tr) => (tr.onclick = () => pick(+tr.dataset.hr)));
    const g0 = C.guessBank(rows); pick(g0 ? g0.hr : 0);
    m.querySelector('#bmx').onclick = closeModal;
    m.querySelector('#bmok').onclick = async () => {
      const c = {}; m.querySelectorAll('[data-col]').forEach((x) => { if (x.value) c[x.value] = +x.dataset.col; });
      if (c.dt === undefined || c.desc === undefined || (c.in === undefined && c.out === undefined && c.amt === undefined)) return toast('날짜 · 금액 · 입금자 칸은 꼭 골라주세요');
      try { C.parseWith(rows, { hr, c }); } catch (e) { return toast('이 설정으로는 거래를 못 읽었어요. 칸을 다시 확인해 주세요'); }
      S.cfg.bankMaps = [{ sig: (rows[hr] || []).map(hN).join('|'), c }].concat(S.cfg.bankMaps || []).slice(0, 3);
      await putCfg(); closeModal(); toast('이 은행 양식을 기억했어요'); importBank(file, rows);
    };
  });
}
async function importBank(file, rows0) {
  try {
    const rows = rows0 || await bankRows(file);
    let parsed;
    try { parsed = C.parseBankRows(rows, savedMap(rows)); }
    catch (e) { if (e.code === 'NEED_MAP') return mapBank(rows, file); throw e; }
    const have = new Set(S.txs.map((t) => t.id));
    const fresh = parsed.filter((t) => !have.has(t.id)).sort((a, b) => (a.dt < b.dt ? -1 : 1));
    if (!fresh.length) return toast('새 거래가 없어요 (' + parsed.length + '건 모두 이미 있음)', 4000);
    // 직접 입력해 둔 건과 같은 통장 거래면: 분류·메모를 이어받고 직접 입력 건은 지움 (이중 계산 방지)
    const merged = C.matchManual(fresh, S.txs);
    merged.forEach(([b, mt]) => { b._from = mt; });
    const recent = S.txs.filter((t) => t.state === '확인필요' && !t.manual);
    const pairs = C.pairRefunds(fresh.filter((t) => !t._from).concat(recent));
    pairs.forEach(([a, b]) => [a, b].forEach((x) => { x.state = '무시'; x.parts = []; x.reason = '취소·환불 상계 (' + x.desc + ')'; delete x.suggest; }));
    const ctx = { cfg: cfgC(), games: S.games, members: S.members, alias: C.aliasMap(S.members), done: S.txs.slice() };
    let auto = 0, need = 0;
    fresh.forEach((t) => {
      if (t._from) {
        const mt = t._from; delete t._from;
        t.parts = mt.parts || []; t.state = mt.state; t.reason = mt.reason || ''; if (mt.suggest) t.suggest = mt.suggest;
        t.note = [mt.note, '직접 입력(' + md(C.dtDate(mt.dt)) + ')과 합침'].filter(Boolean).join(' · ');
      } else if (!t._paired) {
        const r = C.classify(t, ctx);
        t.parts = r.parts; t.state = r.state; t.reason = r.reason || ''; if (r.suggest) t.suggest = r.suggest;
      }
      t.addedAt = new Date().toISOString();
      if (t.state === '확인필요') need++; else auto++;
      ctx.done.push(t);
    });
    const touched = fresh.concat(recent.filter((t) => t._paired)), gone = merged.map((x) => x[1].id);
    S.txs = S.txs.filter((t) => !touched.some((x) => x.id === t.id) && gone.indexOf(t.id) < 0).concat(touched).sort((a, b) => (a.dt < b.dt ? -1 : 1));
    await batchPut(touched.map((t) => ['tx', t.id, t]));
    for (const id of gone) await deleteDoc(D('tx', id)).catch(() => {});
    const last = fresh[fresh.length - 1];
    S.week = monday(C.dtDate((S.txs.find((t) => t.state === '확인필요') || last).dt));
    S.view = 'week'; render();
    toast('새 거래 ' + fresh.length + '건 · 자동 확정 ' + auto + '건 · 확인 ' + need + '건' + (gone.length ? ' · 직접 입력 ' + gone.length + '건 합침' : '') + ' · 잔액 ' + won(C.balance(S.txs)) + '원', 7000);
    if (manualIssues().length || C.balanceGaps(S.txs).length) checkReport('엑셀 넣고 확인할 것');
  } catch (e) { toast(e.message, 7000); }
}

/* ---- 문구 ---- */
function duesText() {
  const ym = payYM(), list = C.membersFor(S.members, ym), paid = C.duesPaid(S.txs, ym);
  const done = list.filter((m) => paid[m.name]).map((m) => m.name), left = list.filter((m) => !paid[m.name]).map((m) => m.name);
  copy('📢 ' + mon(ym) + ' 회비 안내\n\n💰 ' + won(S.cfg.fee) + '원 · ' + (+ym.substr(5, 2) - 1 || 12) + '/' + (S.cfg.dueDay || 30) + '까지\n' +
    (S.cfg.account ? '🏦 ' + S.cfg.account + '\n' : '') + '\n✅ 납부 완료 (' + done.length + '명)\n' + (done.join(', ') || '-') +
    '\n\n🙋 아직 (' + left.length + '명)\n' + (left.join(', ') || '없음 🎉'));
}
function recruitText(gid) {
  const g = S.games.find((x) => x.id === gid), att = attOf(g), total = att.length + C.guestNames(S.txs, gid, att).length;
  copy('⚽ ' + md(g.date) + '(' + C.dayName(g.date) + ') ' + g.time + ' ' + (S.cfg.place || '') + ' 게스트 ' + Math.max(1, minN() - total) + '명 구해요!\n\n' +
    '✅ 실력 무관 · 초보 환영 · 1인 참가 OK\n✅ 참가비 ' + won(S.cfg.guestFee) + '원\n\n현재 ' + total + '명 확정 🙌' + (S.cfg.openChat ? '\n' + S.cfg.openChat : ''));
}
function backup() {
  const blob = new Blob([JSON.stringify({ at: new Date().toISOString(), cfg: S.cfg, members: S.members, games: S.games, txs: S.txs, skills: S.skills }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'a-kick-백업-' + today() + '.json'; a.click();
}

/* ---- 회원 ---- */
function membersHTML() {
  const ym = payYM(), paid = C.duesPaid(S.txs, ym), due = C.membersFor(S.members, ym).map((m) => m.name);
  const card = (m) => {
    const tag = m.state === '탈퇴' ? '<span class="tag gry">탈퇴 ' + esc(m.quit || '') + '</span>' : due.indexOf(m.name) < 0 ? '<span class="tag gry">' + mon(C.startYM(m) || ym) + '부터</span>' : paid[m.name] ? '<span class="tag grn">' + mon(ym) + ' 납부</span>' : '<span class="tag red">' + mon(ym) + ' 미납</span>';
    const others = (m.payers || []).filter((p) => p !== m.name);
    return '<button class="mcard" data-m="' + m.id + '"><span class="m-top"><b>' + esc(m.name) + '</b>' + tag + '</span><span class="m-sub">가입 ' + esc(m.join || '-') + (others.length ? ' · 함께 입금 ' + esc(others.join(', ')) : '') + '</span></button>';
  };
  const act = S.members.filter((m) => m.state !== '탈퇴').sort((a, b) => (a.join < b.join ? -1 : 1));
  const quit = S.members.filter((m) => m.state === '탈퇴');
  return reqHTML() + '<div class="pagehead"><h1>회원 <span>' + act.length + '명</span></h1><div class="ph-act"><button class="btn" id="dues2">' + IC.copy + ' 미납자 안내 문구</button><button class="btn pri" id="addm">+ 신규 회원</button></div></div>' +
    '<div class="mgrid">' + act.map(card).join('') + '</div>' +
    (quit.length ? '<details class="quit"><summary>탈퇴 회원 ' + quit.length + '명</summary><div class="mgrid">' + quit.map(card).join('') + '</div></details>' : '');
}
/* ---- 가입 신청 승인 ---- */
function reqHTML() {
  const rs = (S.reqs || []).slice().sort((a, b) => a.at - b.at);
  if (!rs.length) return '';
  const act = S.members.filter((m) => m.state !== '탈퇴');
  return '<div class="panel pad reqbox"><div class="g-lbl2">가입 신청 ' + rs.length + '건 · 승인해야 회원 화면이 열려요</div>' + rs.map((r) => {
    const nm = r.name.trim(), same = S.members.filter((m) => m.name === nm || (m.payers || []).some((p) => p.replace(/\s/g, '') === nm.replace(/\s/g, '')));
    // 같은 이름이 있으면 자동으로 고르지 않음: 기존 회원 본인인지, 동명이인 새 사람인지 관리자가 직접 고름
    return '<div class="req"><div class="rq"><b>' + esc(r.name) + '</b><small>' + esc(r.email || '') + '</small>' +
      (same.length ? '<em class="dup">⚠ 같은 이름 회원이 있어요: ' + same.map((m) => esc(m.name) + ' (가입 ' + esc(m.join || '-') + (S.claims[m.id] ? ' · ' + esc(S.claims[m.id].email || '연결됨') : ' · 아직 미가입') + ')').join(', ') + ' — 본인인지 꼭 확인하세요</em>' : '') + '</div>' +
      '<select data-rsel="' + r.id + '">' + (same.length ? '<option value="?" selected>— 누구인지 골라주세요 —</option>' : '') + '<option value="">+ 새 회원으로 등록' + (same.length ? ' (동명이인)' : ' (' + esc(r.name) + ')') + '</option>' + act.map((m) => '<option value="' + m.id + '">' + esc(m.name) + (S.claims[m.id] ? ' (연결됨: ' + esc(S.claims[m.id].email || '') + ')' : '') + '</option>').join('') + '</select>' +
      '<button class="btn pri sm" data-rok="' + r.id + '">승인</button><button class="btn ghost sm" data-rno="' + r.id + '">거절</button></div>';
  }).join('') + '</div>';
}
async function approve(uid) {
  const r = S.reqs.find((x) => x.id === uid), mid = document.querySelector('[data-rsel="' + uid + '"]').value;
  if (mid === '?') return toast('기존 회원 본인인지, 새 회원(동명이인)인지 먼저 골라주세요');
  let m = S.members.find((x) => x.id === mid);
  if (!m) {
    let name = r.name.trim();
    if (S.members.some((x) => x.name === name)) {          // 동명이인: 팀 안에서 겹치지 않는 표시 이름 필수
      let k = 2; while (S.members.some((x) => x.name === r.name.trim() + k)) k++;
      name = (prompt('같은 이름 회원이 이미 있어요.\n이 사람을 구분할 이름을 정해주세요 (예: ' + r.name.trim() + 'B, ' + r.name.trim() + '(91))', r.name.trim() + k) || '').trim();
      if (!name) return;
      if (S.members.some((x) => x.name === name)) return toast('그 이름도 이미 있어요. 다른 이름으로 해주세요');
    }
    m = { id: 'M' + String(S.members.length + 1).padStart(3, '0'), name, join: today(), quit: '', state: '활동', fee: 0, payers: [r.name.trim()] };
    if (name !== r.name.trim()) m.realName = r.name.trim();   // 동명이인: 통장에 찍히는 실제 이름
    while (S.members.some((x) => x.id === m.id)) m.id = 'M' + String(+m.id.slice(1) + 1).padStart(3, '0');
    if (!confirm(m.name + ' 님을 새 회원(가입일 오늘)으로 등록하고 승인할까요?')) return;
    S.members.push(m); await putMember(m);
  } else if (S.claims[m.id] && S.claims[m.id].uid !== uid) {
    if (!confirm('⚠ ' + m.name + ' 님은 이미 ' + (S.claims[m.id].email || '다른 계정') + '으로 쓰고 있어요.\n\n동명이인이면 [취소] 후 \'새 회원으로 등록\'을 고르세요.\n같은 사람이 계정을 바꾼 거라면 [확인] (기존 계정은 로그아웃돼요).')) return;
    await deleteDoc(D('users', S.claims[m.id].uid)).catch(() => {});
  }
  const b = writeBatch(db);
  b.set(D('claims', m.id), { uid, email: r.email || '', name: m.name, at: Date.now() });
  b.set(D('users', uid), { mid: m.id, name: m.name, at: Date.now() });
  b.delete(D('requests', uid));
  await b.commit().catch(fail);
  S.claims[m.id] = { uid, email: r.email || '', name: m.name };
  await publish().catch(() => {});
  toast(m.name + ' 님 승인 완료 · 지금 바로 들어갈 수 있어요'); render();
}
function bindMembers() {
  document.querySelectorAll('[data-rok]').forEach((b) => (b.onclick = () => approve(b.dataset.rok)));
  document.querySelectorAll('[data-rno]').forEach((b) => (b.onclick = async () => { if (confirm('이 신청을 거절할까요?')) await deleteDoc(D('requests', b.dataset.rno)).catch(fail); }));
  $('#addm').onclick = () => editMember(null);
  $('#dues2').onclick = duesText;
  document.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => editMember(b.dataset.m)));
}
function editMember(id) {
  const m = id ? S.members.find((x) => x.id === id) : { id: 'M' + String(S.members.length + 1).padStart(3, '0'), name: '', join: today(), quit: '', state: '활동', fee: 0, payers: [] };
  modal('<h2>' + (id ? esc(m.name) + ' 수정' : '신규 회원') + '</h2><div class="row">' +
    '<label class="f">이름<input id="n" value="' + esc(m.name) + '"></label><label class="f">가입일<input id="j" type="date" value="' + esc(m.join) + '"></label>' +
    '<label class="f">상태<select id="s"><option' + (m.state !== '탈퇴' ? ' selected' : '') + '>활동</option><option' + (m.state === '탈퇴' ? ' selected' : '') + '>탈퇴</option></select></label>' +
    '<label class="f">탈퇴일<input id="q" type="date" value="' + esc(m.quit || '') + '"></label></div>' +
    '<label class="f">통장에 찍히는 이름 (여러 개면 쉼표 · 동반지인이 대신 내면 그 이름도)<input id="p" value="' + esc((m.payers || []).join(', ')) + '"></label>' +
    '<div class="card" style="background:#F6F7FA" id="fm"></div>' +
    (id ? '<div class="xpadj"><span>EXP 지급·차감 <small>지금까지 ' + ((S.cfg.xpAdj || {})[m.id] || 0) + '</small></span><input id="xpa" type="number" inputmode="numeric" placeholder="예: 100 또는 -50"></div>' : '') +
    (id ? '<div class="linkacc">' + (S.claims[m.id] ? '연결된 구글 계정: <b>' + esc(S.claims[m.id].email || '') + '</b> <button class="btn xs" id="unl">연결 해제</button>' : '<span class="muted">아직 이 이름을 고른 계정이 없어요</span>') + '</div>' : '') +
    (id && m.state !== '탈퇴' ? '<div class="kick"><button class="btn" id="kick">🚪 강퇴 (팀에서 내보내기)</button>' + (memberUnused(m) ? '<button class="btn ghost" id="mdel">🗑 기록 없는 회원 완전 삭제</button>' : '') + '</div>' : '') +
    '<div class="row"><button class="btn" id="c">취소</button><button class="btn" id="cp">안내 문구 복사</button><button class="btn pri" id="ok">저장</button></div>', (el) => {
    const calc = () => {
      const j = el.querySelector('#j').value, mm = { name: el.querySelector('#n').value.trim(), join: j, fee: m.fee };
      const st = C.startYM(mm), fm = C.firstMonth(mm, S.games, S.cfg);
      if (id) {                                       // 기존 회원: 달마다 실제로 낸 회비
        const rows = []; let ym = st;
        for (let k = 0; ym && ym <= payYM() && k < 24; k++, ym = C.addYM(ym, 1)) {
          let amt = 0;
          S.txs.forEach((t) => C.partsOf(t).forEach((p) => { if ((p.cls === '회비' || p.cls === '첫달회비') && p.ym === ym && (p.names || []).indexOf(m.name) >= 0) amt += p.amt / Math.max(1, p.names.length); }));
          const due = C.membersFor(S.members, ym).some((x) => x.id === m.id);
          rows.push('<div class="hrow"><span>' + mon(ym) + '분</span>' + (amt ? '<b class="pos">' + won(amt) + '원 납부</b>' : due ? '<b class="neg">미납</b>' : '<span class="muted">대상 아님</span>') + '</div>');
        }
        el.querySelector('#fm').innerHTML = '<div class="g-lbl2">회비 납부 내역</div>' + (rows.join('') || '<span class="muted">가입일을 넣어주세요</span>') + '<div class="muted" style="margin-top:6px">지금 월회비 ' + won(S.cfg.fee) + '원 · 함께 입금하는 사람 몫은 나눠서 표시돼요</div>';
      } else {
        el.querySelector('#fm').innerHTML = j ? (fm && fm.games.length && +j.substr(8, 2) !== 1 ? '<b>첫 달 회비 ' + won(fm.amt) + '원</b> (' + mon(fm.ym) + ' 남은 ' + fm.games.length + '경기 × ' + won(S.cfg.guestFee) + ')<br>' : '') + '<b>' + mon(st) + '분부터 매달 ' + won(S.cfg.fee) + '원</b><div class="muted">이 금액이 들어오면 자동으로 확정돼요. 남은 경기는 이번 주 화면에서 만들어 두세요.</div>' : '';
      }
      return { mm, st, fm };
    };
    calc(); el.querySelector('#j').onchange = calc;
    el.querySelector('#c').onclick = closeModal;
    const kk = el.querySelector('#kick'); if (kk) kk.onclick = () => kickMember(m);
    const md = el.querySelector('#mdel'); if (md) md.onclick = () => deleteMember(m);
    const ul = el.querySelector('#unl'); if (ul) ul.onclick = async () => {
      const c = S.claims[m.id]; if (!confirm(m.name + ' 이름과 ' + (c.email || '') + ' 계정 연결을 해제할까요?\n해제하면 그 사람은 이름을 다시 골라야 해요.')) return;
      await deleteDoc(D('claims', m.id)); await deleteDoc(D('users', c.uid)).catch(() => {}); delete S.claims[m.id]; closeModal(); toast('연결을 해제했어요');
    };
    el.querySelector('#cp').onclick = () => {
      const { mm, st, fm } = calc();
      copy(mm.name + '님 ' + S.club.name + ' 가입을 환영해요! 🙌\n' + (fm && fm.games.length && +mm.join.substr(8, 2) !== 1 ? mon(fm.ym) + '은 남은 ' + fm.games.length + '경기분 ' + won(fm.amt) + '원만 입금해 주시면 되고,\n' : '') +
        mon(st) + '부터는 매달 ' + won(S.cfg.fee) + '원이에요.' + (S.cfg.account ? '\n🏦 ' + S.cfg.account : ''));
    };
    el.querySelector('#ok').onclick = async () => {
      const nn = el.querySelector('#n').value.trim(); if (!nn) return toast('이름을 넣어주세요');
      if (S.members.some((x) => x.id !== m.id && x.name === nn)) return toast('같은 이름 회원이 이미 있어요. 동명이인이면 ' + nn + 'B처럼 구분해 주세요');
      m.name = nn;
      m.join = el.querySelector('#j').value; m.state = el.querySelector('#s').value; m.quit = el.querySelector('#q').value;
      if (m.state === '탈퇴' && !m.quit) m.quit = today();
      m.payers = el.querySelector('#p').value.split(',').map((x) => x.trim()).filter(Boolean); if (m.payers.indexOf(m.name) < 0) m.payers.unshift(m.name);
      if (!id) S.members.push(m);
      const xa = el.querySelector('#xpa'), xv = xa ? Math.round(+xa.value || 0) : 0;
      if (xv) { S.cfg.xpAdj = S.cfg.xpAdj || {}; S.cfg.xpAdj[m.id] = (S.cfg.xpAdj[m.id] || 0) + xv; await putCfg(); }
      closeModal(); render(); await putMember(m); toast(xv ? '저장했어요 · EXP ' + (xv > 0 ? '+' : '') + xv : '저장했어요');
    };
  });
}

/** 회비·게스트비 기록이나 출석 기록이 하나도 없는 회원 (테스트·잘못 만든 회원) */
function memberUnused(m) {
  const inTx = S.txs.some((t) => C.partsOf(t).some((p) => (p.names || []).indexOf(m.name) >= 0 || p.name === m.name));
  const inGame = S.games.some((g) => (g.attend || []).indexOf(m.name) >= 0 || (g.log || {})[m.name]);
  return !inTx && !inGame;
}
/** 강퇴: 탈퇴 처리 + 구글 계정 연결 끊기 → 그 사람 앱에서 바로 팀 화면이 닫힘. 장부·출석 기록은 남김 */
async function kickMember(m) {
  if (!confirm('⚠ ' + m.name + ' 님을 강퇴할까요?\n\n· 앱에서 바로 팀 화면이 닫혀요\n· 다시 들어오려면 가입 신청 → 관리자 승인이 필요해요\n· 회비·출석 기록은 장부에 그대로 남아요')) return;
  const c = S.claims[m.id];
  try {
    if (c) { await deleteDoc(D('claims', m.id)); await deleteDoc(D('users', c.uid)).catch(() => {}); await deleteDoc(D('requests', c.uid)).catch(() => {}); delete S.claims[m.id]; }
    m.state = '탈퇴'; if (!m.quit) m.quit = today();
    closeModal(); render(); await putMember(m); toast(m.name + ' 님을 강퇴했어요');
  } catch (e) { fail(e); }
}
/** 기록 없는 회원은 명단에서 완전히 지움 (테스트 계정 정리용) */
async function deleteMember(m) {
  if (!memberUnused(m)) return toast('회비·출석 기록이 있어서 지울 수 없어요. 강퇴를 써주세요');
  if (!confirm(m.name + ' 님을 명단에서 완전히 지울까요? 되돌릴 수 없어요.')) return;
  const c = S.claims[m.id];
  try {
    if (c) { await deleteDoc(D('claims', m.id)); await deleteDoc(D('users', c.uid)).catch(() => {}); await deleteDoc(D('requests', c.uid)).catch(() => {}); delete S.claims[m.id]; }
    await deleteDoc(D('members', m.id)); await deleteDoc(D('profiles', m.id)).catch(() => {});
    S.members = S.members.filter((x) => x.id !== m.id); closeModal(); render(); schedulePublish(); toast(m.name + ' 님을 지웠어요');
  } catch (e) { fail(e); }
}

/* ---- 장부 ---- */
function ledgerHTML() {
  if (!S.txs.length) return '<div class="panel">거래가 없어요</div>';
  const first = C.ymOf(S.txs[0].dt), last = C.addYM(today().substr(0, 7), 1), data = [];
  for (let ym = first; ym <= last; ym = C.addYM(ym, 1)) {
    const b = C.book(S.txs, S.games, ym), end = S.txs.filter((t) => C.ymOf(t.dt) <= ym);
    data.unshift(Object.assign({ ym, end: end.length ? C.balance(end) : null }, b));
  }
  const rows = sortRows(data, 'ledger').map((b) => '<tr><th scope="row">' + b.ym.replace('-', '. ') + '</th><td>' + won(b.fee) + '</td><td>' + won(b.guest) + '<small>' + b.guestN + '명</small></td><td>' + won(b.etcIn) + '</td><td>' + won(b.field) + '</td><td>' + won(b.etcOut) + '</td><td class="' + (b.net >= 0 ? 'pos' : 'neg') + '"><b>' + (b.net >= 0 ? '+' : '') + won(b.net) + '</b></td><td>' + (b.end == null ? '-' : won(b.end)) + '</td><td><button class="btn xs" data-settle="' + b.ym + '">정산 문구</button></td></tr>');
  const th = (k, l) => sortTh('ledger', k, l);
  return '<div class="pagehead"><h1>장부</h1><span class="muted">회비는 귀속월, 게스트비·구장비는 경기 달 기준 · 통장은 그 달 마지막 거래 기준 · 제목을 누르면 기본 → 내림차순 → 오름차순</span></div>' +
    '<div class="panel tablewrap"><table><thead><tr>' + th('ym', '월') + th('fee', '회비') + th('guest', '게스트비') + th('etcIn', '기타 수입') + th('field', '구장비') + th('etcOut', '기타 지출') + th('net', '그 달 남은 돈') + th('end', '월말 통장') + '<th></th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}

/* ---- 정렬: 제목 누를 때마다 기본 → 내림차순 → 오름차순 ---- */
S.sort = {};
function sortRows(rows, tb) {
  const st = S.sort[tb]; if (!st || !st.d) return rows;
  return rows.slice().sort((a, b) => { const x = a[st.k], y = b[st.k]; const c = typeof x === 'string' ? String(x).localeCompare(String(y), 'ko') : (x == null ? -1e15 : x) - (y == null ? -1e15 : y); return st.d === 1 ? -c : c; });
}
function sortTh(tb, k, l) {
  const st = S.sort[tb] || {}, on = st.k === k && st.d;
  return '<th class="sortable' + (on ? ' on' : '') + '" data-sort="' + tb + ':' + k + '" aria-sort="' + (on ? (st.d === 1 ? 'descending' : 'ascending') : 'none') + '">' + l + '<i>' + (on ? (st.d === 1 ? '▼' : '▲') : '↕') + '</i></th>';
}
function bindSort() {
  document.querySelectorAll('[data-sort]').forEach((h) => (h.onclick = () => {
    const [tb, k] = h.dataset.sort.split(':'), st = S.sort[tb] || {};
    S.sort[tb] = st.k === k ? { k, d: ((st.d || 0) + 1) % 3 } : { k, d: 1 };
    render();
  }));
}

/* ---- 스탯 · 하이라이트 (관리자 페이지) ---- */
function statFrom() { return S.cfg.statFrom || (S.club.created || '').substr(0, 10) || '2000-01-01'; }
function playedGames() { return S.games.filter((g) => g.date <= today() && g.date >= statFrom() && !g.postponed).map((g) => ({ id: g.id, date: g.date, players: playersOf(g), teams: g.teams || [] })); }
function statsHTML() {
  const games = playedGames(), months = [...new Set(games.map((g) => g.date.substr(0, 7)))].sort().reverse();
  if (S.sym == null) S.sym = months[0] || '';
  const base = S.members.filter((m) => m.state !== '탈퇴').map((m) => m.name);
  const data = C.statTable(games, S.goals, S.sym, base).filter((r) => r.ap || base.indexOf(r.name) >= 0);
  const top = (k, l, unit) => {
    const mx = Math.max(0, ...data.map((r) => r[k])), who = data.filter((r) => r[k] === mx && mx > 0).map((r) => r.name);
    return '<div class="sum"><span>' + l + '</span><b>' + (mx ? mx + '<em>' + unit + '</em>' : '-') + '</b><small>' + esc(who.join(', ') || '아직 없음') + '</small></div>';
  };
  const th = (k, l) => sortTh('stats', k, l);
  const rows = sortRows(data, 'stats').map((r) => '<tr><th scope="row">' + esc(r.name) + '</th><td>' + r.gp + '</td><td>' + r.g + '</td><td>' + r.a + '</td><td><b>' + r.ap + '</b></td></tr>').join('');
  const gl = games.filter((g) => !S.sym || g.date.substr(0, 7) === S.sym).reverse().map((g) => {
    const gs = S.goals.filter((x) => x.gid === g.id), sc = C.score(g, S.goals);
    return '<div class="glog"><div class="glh"><b>' + md(g.date) + ' (' + C.dayName(g.date) + ')</b>' + (g.teams.length >= 3 ? '<span>' + triTxt(g) + '</span>' : g.teams.length >= 2 ? '<span>A ' + sc[0] + ' : ' + sc[1] + ' B</span>' : '') + '</div>' +
      (gs.length ? gs.map((x) => '<div class="gli">⚽ <b>' + esc(x.scorer) + '</b>' + (x.assist ? ' <span class="muted">도움 ' + esc(x.assist) + '</span>' : '') + '<small>' + esc(x.byName || '') + ' 입력</small><button class="btn xs ghost" data-gdel="' + x.id + '">삭제</button></div>').join('') : '<div class="muted">기록 없음 · 회원 화면 \'경기기록\' 탭에서 누구나 넣을 수 있어요</div>') + '</div>';
  }).join('');
  return '<div class="pagehead"><h1>경기기록</h1><div class="ph-act"><select id="sym"><option value="">전체 기간</option>' + months.map((m) => '<option value="' + m + '"' + (m === S.sym ? ' selected' : '') + '>' + m.replace('-', '년 ') + '월</option>').join('') + '</select></div></div>' +
    '<div class="evnote">🔒 아래 1위 정리는 관리자만 보여요. · 골·도움은 ' + md(statFrom()) + ' 경기부터 집계 (설정에서 변경)</div>' +
    '<div class="sumrow">' + top('g', (S.sym ? mon(S.sym) : '전체') + ' 득점 1위', '골') + top('a', '도움 1위', '개') + top('ap', '공격포인트 1위', 'P') + top('gp', '출석 1위', '경기') + '</div>' +
    '<div class="statgrid"><div class="panel tablewrap"><table><thead><tr>' + th('name', '이름') + th('gp', '경기') + th('g', '골') + th('a', '도움') + th('ap', '공격P') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="scol">' + vidPanel() + '<div class="panel pad"><div class="g-lbl2" style="margin-bottom:8px">경기별 기록</div>' + (gl || '<div class="muted">이 기간 경기가 없어요</div>') + '</div></div></div>';
}
/* ---- 투표 · 공지 · 건의함 ---- */
const newSugs = () => (S.sugs || []).filter((x) => !x.done).length;
const pollOpen = (p) => !p.closed && (!p.deadline || Date.now() < Date.parse(p.deadline));
const pvOf = (p) => (p.anon ? S.avotes || [] : S.pvotes).filter((v) => v.pid === p.id);
function pollOpts(p) {
  const vs = pvOf(p), adds = [...new Set(vs.map((v) => v.add).filter(Boolean))];
  const opts = (p.options || []).concat(adds.filter((a) => !(p.options || []).some((o) => o.text === a)).map((a) => ({ id: 'u:' + a, text: a, user: 1 })));
  return opts.map((o) => Object.assign({}, o, { who: vs.filter((v) => (v.picks || []).indexOf(o.id) >= 0).map((v) => (p.anon ? '' : v.name)) })).sort((a, b) => b.who.length - a.who.length);
}
function pollsHTML() {
  const ps = S.polls.slice().sort((a, b) => (a.created < b.created ? 1 : -1)), mem = S.members.filter((m) => m.state !== '탈퇴');
  const card = (p) => {
    const vs = pvOf(p), opts = pollOpts(p), mx = Math.max(1, ...opts.map((o) => o.who.length));
    const not = p.anon ? [] : mem.filter((m) => !vs.some((v) => v.mid === m.id)).map((m) => m.name);
    return '<div class="panel pad pcard"><div class="ph"><b>' + esc(p.title) + (p.anon ? ' <small class="muted">🔒 익명</small>' : '') + '</b><span class="pill ' + (pollOpen(p) ? 'ok' : '') + '">' + (pollOpen(p) ? '진행 중' : '마감') + '</span></div>' +
      (p.desc ? '<div class="pdesc">' + esc(p.desc) + '</div>' : '') +
      '<div class="muted">' + (p.multi ? '복수 선택' : '하나만 선택') + (p.allowAdd ? ' · 회원 보기 추가 가능' : '') + ' · ' + (p.deadline ? md(p.deadline.substr(0, 10)) + ' ' + p.deadline.substr(11, 5) + ' 마감' : '마감 없음') + ' · 참여 ' + vs.length + '/' + mem.length + '명</div>' +
      opts.map((o) => '<div class="bar2"><div class="bl"><span>' + esc(o.text) + (o.user ? ' <em class="tag gry">회원 추가</em>' : '') + '</span><b>' + o.who.length + '</b></div><div class="bt"><i style="width:' + (o.who.length / mx * 100) + '%"></i></div>' + (p.anon ? '' : '<small>' + esc(o.who.join(', ')) + '</small>') + '</div>').join('') +
      (p.anon ? '<div class="muted" style="margin-top:6px">🔒 익명 투표라 누가 뭘 골랐는지는 관리자 화면에도 안 나와요</div>' : '') + (not.length ? '<div class="muted" style="margin-top:6px">아직 안 한 사람: ' + esc(not.join(', ')) + '</div>' : '') +
      '<div class="row" style="margin-top:10px"><button class="btn sm" data-pcopy="' + p.id + '">' + IC.copy + ' 카톡 공지 문구</button>' + (pollOpen(p) ? '<button class="btn sm" data-pclose="' + p.id + '">지금 마감</button>' : '') + '<button class="btn sm" data-pedit="' + p.id + '">설정 고치기</button><button class="btn sm ghost" data-pdel="' + p.id + '">삭제</button></div></div>';
  };
  const sugs = (S.sugs || []).slice().sort((a, b) => b.at - a.at);
  return '<div class="pagehead"><h1>투표 · 공지 · 건의함</h1><div class="ph-act"><button class="btn pri" id="newp">+ 새 투표 · 공지</button></div></div>' +
    '<div class="statgrid"><div class="pcol">' + (ps.length ? ps.map(card).join('') : '<div class="panel pad muted">아직 만든 투표가 없어요. 예: "우리 팀 이름 정하기"</div>') + '</div>' +
    '<div class="panel pad"><div class="g-lbl2" style="margin-bottom:8px">건의함 ' + (newSugs() ? '· 새 건의 ' + newSugs() + '건' : '') + '</div>' +
    (sugs.length ? sugs.map((x) => '<div class="sug' + (x.done ? ' done' : '') + '"><div class="sh"><b>' + (x.anon ? '익명' : esc(x.name)) + '</b><small>' + new Date(x.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</small><button class="btn xs" data-sdone="' + x.id + '">' + (x.done ? '다시 열기' : '확인함') + '</button></div><div class="st2">' + esc(x.text) + '</div></div>').join('') : '<div class="muted">아직 들어온 건의가 없어요</div>') + '</div></div>';
}
function bindPolls() {
  $('#newp').onclick = () => newPoll();
  document.querySelectorAll('[data-pclose]').forEach((b) => (b.onclick = async () => { const p = S.polls.find((x) => x.id === b.dataset.pclose); p.closed = true; await setDoc(D('polls', p.id), clean(p)).catch(fail); render(); }));
  document.querySelectorAll('[data-pdel]').forEach((b) => (b.onclick = async () => { if (!confirm('이 투표를 지울까요? 결과도 같이 사라져요.')) return; await deleteDoc(D('polls', b.dataset.pdel)).catch(fail); S.pvotes.filter((v) => v.pid === b.dataset.pdel).forEach((v) => deleteDoc(D('pollvotes', v.id)).catch(() => {})); (S.avotes || []).filter((v) => v.pid === b.dataset.pdel).forEach((v) => deleteDoc(D('anonvotes', v.id)).catch(() => {})); }));
  document.querySelectorAll('[data-pedit]').forEach((b) => (b.onclick = () => newPoll(S.polls.find((x) => x.id === b.dataset.pedit))));
  document.querySelectorAll('[data-pcopy]').forEach((b) => (b.onclick = () => {
    const p = S.polls.find((x) => x.id === b.dataset.pcopy);
    copy('📢 ' + p.title + (p.desc ? '\n\n' + p.desc : '') + '\n\n🗳 투표하기 👉 ' + MEMBER_URL + (p.deadline ? '\n⏰ ' + md(p.deadline.substr(0, 10)) + '(' + C.dayName(p.deadline.substr(0, 10)) + ') ' + p.deadline.substr(11, 5) + ' 마감' : ''));
  }));
  document.querySelectorAll('[data-sdone]').forEach((b) => (b.onclick = async () => { const x = S.sugs.find((y) => y.id === b.dataset.sdone); x.done = !x.done; const o = clean(x); delete o.id; await setDoc(D('suggest', x.id), o).catch(fail); render(); }));
}
function newPoll(old) {
  const e = old || {}, voted = old ? pvOf(old).length : 0, dl = e.deadline || '';
  const ck = (id, on, lbl, dis) => '<label class="chk"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '> ' + lbl + '</label>';
  modal('<h2>' + (old ? '투표 · 공지 고치기' : '새 투표 · 공지') + '</h2><label class="f">제목<input id="pt" placeholder="예: 우리 팀 이름 정하기" maxlength="60" value="' + esc(e.title || '') + '"></label>' +
    '<label class="f">설명 · 공지 내용 (선택)<textarea id="pd" rows="3" placeholder="예: 후보 중에 골라주세요. 좋은 이름 있으면 직접 추가해도 돼요!">' + esc(e.desc || '') + '</textarea></label>' +
    '<label class="f">보기 (한 줄에 하나 · 공지만 할 거면 비워두세요)<textarea id="po" rows="4" placeholder="OO FC&#10;킥앤런&#10;일요일의 전설">' + esc((e.options || []).map((o) => o.text).join('\n')) + '</textarea></label>' +
    (old && voted ? '<div class="muted">이미 ' + voted + '명이 투표했어요. 보기 이름을 고쳐도 그 보기에 들어간 표는 그대로예요. 보기를 지우면 그 표는 결과에서 빠져요.</div>' : '') +
    '<div class="row">' + ck('pm', e.multi, '여러 개 고를 수 있게') + ck('pa', old ? e.allowAdd : true, '회원이 보기 추가 가능') + ck('pan', e.anon, '🔒 익명 투표 (누가 뭘 골랐는지 안 보임)', voted) + '</div>' +
    (voted ? '<div class="muted">익명 여부는 투표가 시작되면 바꿀 수 없어요 (이미 낸 표가 섞이지 않게).</div>' : '') +
    '<div class="row"><label class="f">마감 날짜 (비우면 마감 없음)<input id="pdl" type="date" value="' + dl.substr(0, 10) + '"></label><label class="f">마감 시간' + timeSel('pdt', dl.substr(11, 5) || '22:00') + '</label></div>' +
    (old ? '' : '<div class="muted">만들면 회원이 앱을 열 때 아직 안 한 투표가 바로 팝업으로 떠요.</div>') +
    '<div class="mfoot"><span style="flex:1"></span><button class="btn" id="cx">취소</button><button class="btn pri" id="ok">' + (old ? '저장' : '만들기') + '</button></div>', (m) => {
    m.querySelector('#cx').onclick = closeModal;
    m.querySelector('#ok').onclick = async () => {
      const title = m.querySelector('#pt').value.trim(); if (!title) return toast('제목을 넣어주세요');
      const lines = m.querySelector('#po').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20);
      const prev = e.options || []; let n = prev.reduce((a, o) => Math.max(a, +String(o.id).replace(/\D/g, '') || 0), 0);
      // 같은 자리·같은 이름의 보기는 id 유지 → 이미 들어간 표가 따라감
      const used = new Set(), ids = lines.map((t) => { const o = prev.find((x) => x.text === t && !used.has(x.id)); if (o) used.add(o.id); return o ? o.id : ''; });
      const options = lines.map((t, i) => { let oid = ids[i]; if (!oid && prev[i] && !used.has(prev[i].id)) { oid = prev[i].id; used.add(oid); } return { id: oid || 'o' + (++n), text: t }; });
      const id = old ? old.id : 'P' + Date.now().toString(36);
      const dlv = m.querySelector('#pdl').value ? m.querySelector('#pdl').value + 'T' + timeVal(m, 'pdt') : '';
      const p = { title, desc: m.querySelector('#pd').value.trim(), options, multi: m.querySelector('#pm').checked, allowAdd: m.querySelector('#pa').checked,
        anon: voted ? !!e.anon : m.querySelector('#pan').checked, deadline: dlv, created: e.created || new Date().toISOString(),
        closed: old ? (e.closed && !(dlv && Date.parse(dlv) > Date.now() && dlv !== e.deadline)) : false };
      await setDoc(D('polls', id), p).catch(fail); closeModal(); toast(old ? '고쳤어요' : '만들었어요 · 카톡 공지 문구도 복사해 보세요'); S.view = 'polls'; render();
    };
  });
}
/* 하이라이트: 유튜브 '일부공개' 링크를 붙이면 회원 화면 안에서 재생·댓글·시간 태그 */
function ytId(u) {
  u = String(u || '').trim();
  const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/))([A-Za-z0-9_-]{11})/) || u.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : '';
}
function vidPanel() {
  const vs = (S.videos || []).slice().sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1));
  return '<div class="panel pad"><div class="ph"><div class="g-lbl2">🎬 하이라이트 ' + vs.length + '개</div><button class="btn sm pri" id="vadd">+ 하이라이트 추가</button></div>' +
    (vs.length ? vs.map((v) => '<div class="vrow"><img src="https://i.ytimg.com/vi/' + v.yt + '/default.jpg" alt=""><div><b>' + esc(v.title || '하이라이트') + '</b><small>' + (v.date ? md(v.date) + ' 경기' : '') + '</small></div>' +
      '<button class="btn xs" data-vcopy="' + v.id + '">' + IC.copy + ' 카톡 문구</button><button class="btn xs ghost" data-vdel="' + v.id + '">삭제</button></div>').join('')
      : '<div class="muted">구장에서 받은 영상을 유튜브에 <b>일부공개</b>로 올리고, 링크를 붙여넣으세요. 회원은 앱 안에서 보고 댓글·시간 태그를 남길 수 있어요.</div>') + '</div>';
}
function addVideo() {
  const gs = S.games.filter((g) => !g.postponed && g.date <= C.addDays(today(), 1)).slice(-10).reverse();
  modal('<h2>하이라이트 추가</h2><div class="muted">유튜브 앱 → 업로드할 때 공개 범위 <b>일부공개</b> → 공유 → 링크 복사 후 붙여넣기</div>' +
    '<label class="f">유튜브 링크<input id="vu" placeholder="https://youtu.be/..." inputmode="url"></label><div id="vprev" class="muted"></div>' +
    '<label class="f">어느 경기 영상인가요? <b class="req">필수</b><select id="vg"><option value="">— 경기 선택 —</option>' + gs.map((g) => '<option value="' + g.id + '">' + md(g.date) + ' (' + C.dayName(g.date) + ')</option>').join('') + '</select></label>' +
    '<label class="f">제목 (선택)<input id="vt" maxlength="40" placeholder="예: 1쿼터 · A팀 득점 모음"></label>' +
    '<div class="mfoot"><span style="flex:1"></span><button class="btn" id="cx">취소</button><button class="btn pri" id="ok">추가</button></div>', (m) => {
    const u = m.querySelector('#vu'), pv = m.querySelector('#vprev');
    u.oninput = () => { const id = ytId(u.value); pv.innerHTML = id ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="" style="width:200px;border-radius:8px;margin-top:6px">' : u.value ? '⚠ 유튜브 링크가 아닌 것 같아요' : ''; };
    m.querySelector('#cx').onclick = closeModal;
    m.querySelector('#ok').onclick = async () => {
      const id = ytId(u.value), gid = m.querySelector('#vg').value, g = S.games.find((x) => x.id === gid);
      if (!id) return toast('유튜브 링크를 확인해 주세요');
      if (!g) { m.querySelector('#vg').classList.add('need'); return toast('어느 경기 영상인지 골라주세요'); }
      const n = (S.videos || []).filter((x) => x.gid === gid).length;
      const v = { yt: id, gid, date: g.date, title: m.querySelector('#vt').value.trim() || md(g.date) + ' 하이라이트 ' + (n + 1), at: Date.now() };
      const vid = 'V' + Date.now().toString(36);
      await setDoc(D('videos', vid), v).catch(fail); closeModal(); toast('추가했어요 · 회원 화면에 바로 떠요'); vcopy(Object.assign({ id: vid }, v));
    };
  });
}
function vcopy(v) { copy('🎬 ' + v.title + ' 올라왔어요!\n앱에서 보고 명장면에 댓글 남겨주세요 (시간 쓰면 그 장면으로 이동해요)\n👉 ' + MEMBER_URL + '&v=' + v.id, '카톡 공지 문구를 복사했어요'); }
function bindStats() {
  $('#sym').onchange = (e) => { S.sym = e.target.value; render(); };
  const va = $('#vadd'); if (va) va.onclick = addVideo;
  document.querySelectorAll('[data-vcopy]').forEach((b) => (b.onclick = () => vcopy(S.videos.find((x) => x.id === b.dataset.vcopy))));
  document.querySelectorAll('[data-vdel]').forEach((b) => (b.onclick = async () => {
    if (!confirm('이 하이라이트를 앱에서 지울까요? 댓글도 같이 지워져요.\n(유튜브 영상 자체는 그대로 있어요)')) return;
    const id = b.dataset.vdel; await deleteDoc(D('videos', id)).catch(fail);
    const cs = await getDocs(CL('vcomments')).catch(() => null); if (cs) cs.docs.filter((d) => d.data().vid === id).forEach((d) => deleteDoc(d.ref).catch(() => {}));
  }));
  document.querySelectorAll('[data-gdel]').forEach((b) => (b.onclick = async () => { if (!confirm('이 기록을 지울까요?')) return; await deleteDoc(D('goals', b.dataset.gdel)).catch(fail); }));
}

function bindLedger() {
  document.querySelectorAll('[data-settle]').forEach((b) => (b.onclick = () => {
    const ym = b.dataset.settle, x = C.book(S.txs, S.games, ym), end = S.txs.filter((t) => C.ymOf(t.dt) <= ym);
    const inc = x.fee + x.guest + x.etcIn, out = x.field + x.etcOut;
    copy('📒 ' + mon(ym) + ' 모임통장 정산\n\n💰 들어온 돈 +' + won(inc) + '\n· 회비 ' + won(x.fee) + '\n· 게스트비 ' + won(x.guest) + ' (' + x.guestN + '명)' + (x.etcIn ? '\n· 기타 ' + won(x.etcIn) : '') +
      '\n\n💸 나간 돈 −' + won(out) + '\n· 구장비 ' + won(x.field) + (x.etcOut ? '\n· 기타 ' + won(x.etcOut) : '') +
      '\n\n📊 ' + mon(ym) + ' 남은 돈 ' + (x.net >= 0 ? '+' : '') + won(x.net) + '\n🏦 월말 통장 잔액 ' + won(end.length ? C.balance(end) : 0) + '원\n\n거래내역 원본이 궁금하신 분은 언제든 말씀해주세요 😊');
  }));
}

/* ---- 설정 ---- */
const CFG = [['fee', '월회비', 'number'], ['guestFee', '게스트비', 'number'], ['rentPerGame', '정기대관 회당 구장비', 'number'], ['oneOff', '일회성 구장비', 'number'],
  ['cap', '기본 정원', 'number'], ['perSide', '한 팀 최소 인원 (풋살 5 · 축구 11)', 'number'], ['maxSide', '한 팀 최대 인원 (풋살 6 · 축구 11)', 'number'], ['time', '경기 시간', 'text'], ['nextMonthDay', '이 날짜부터 들어온 회비는 다음 달분', 'number'], ['dueDay', '회비 마감일', 'number'],
  ['reserve', '비상금 (남겨둘 돈)', 'number'], ['statFrom', '골·도움 집계 시작일', 'date'], ['place', '구장 이름', 'text'], ['account', '모임통장 (예: 카카오뱅크 3333-00-0000000)', 'text'], ['openChat', '오픈채팅 링크', 'text']];
function openSettings() { openSettingsReal(); }
/* ---- 팀 테마 고르기 (추천 5개 + 직접 고르기) ---- */
function themeHTML() {
  const cur = S.club.theme || { main: C.THEMES[0].c[0], sub1: C.THEMES[0].c[1], sub2: C.THEMES[0].c[2] };
  return '<div class="sgrp"><div class="g-lbl2">팀 테마 · 회원 화면에도 똑같이 적용돼요</div><div class="thlist">' +
    C.THEMES.map((t) => '<button class="thp" data-th="' + t.c.join(',') + '"><span class="sw">' + t.c.map((c) => '<i style="background:' + c + '"></i>').join('') + '</span>' + esc(t.name) + '</button>').join('') + '</div>' +
    '<div class="thpick"><label>메인 · 상단 배경<input type="color" id="thm" value="' + cur.main + '"></label><label>서브1 · 버튼<input type="color" id="th1" value="' + cur.sub1 + '"></label><label>서브2 · 글씨·테두리<input type="color" id="th2" value="' + cur.sub2 + '"></label></div>' +
    '<div class="muted">색 칸을 누르면 색상판이 열려요. 메인색은 상단 오로라, 서브1은 누르는 버튼, 서브2는 글씨·테두리에 써요. 검정을 섞지 않아 탁해지지 않아요.</div></div>';
}
function readTheme(m) { return { main: m.querySelector('#thm').value, sub1: m.querySelector('#th1').value, sub2: m.querySelector('#th2').value }; }
function bindTheme(m) {
  const live = () => C.applyTheme(readTheme(m));
  ['#thm', '#th1', '#th2'].forEach((id) => (m.querySelector(id).oninput = live));
  m.querySelectorAll('[data-th]').forEach((b) => (b.onclick = () => { const c = b.dataset.th.split(','); m.querySelector('#thm').value = c[0]; m.querySelector('#th1').value = c[1]; m.querySelector('#th2').value = c[2]; live(); }));
}
function openSettingsReal() {
  const grp = (title, keys) => '<div class="sgrp"><div class="g-lbl2">' + title + '</div><div class="row2">' + CFG.filter(([k]) => keys.indexOf(k) >= 0).map(([k, l, ty]) => '<label class="f">' + l + '<input data-c="' + k + '" type="' + ty + '" value="' + esc(S.cfg[k] == null ? '' : S.cfg[k]) + '"></label>').join('') + '</div></div>';
  modal('<h2>설정</h2><div class="muted">팀 만든 구글 계정 + 관리자 비밀번호로만 열려요. 회원 화면에는 나오지 않아요.</div>' +
    grp('회비 · 게스트', ['fee', 'guestFee', 'nextMonthDay', 'dueDay']) + grp('구장 · 경기 인원', ['rentPerGame', 'oneOff', 'cap', 'perSide', 'maxSide', 'time', 'place']) + grp('안내 문구 · 기타', ['statFrom', 'account', 'openChat', 'reserve']) +
    '<div class="sgrp"><div class="g-lbl2">경기 날씨 지역 · 지금: <b id="wxcur">' + esc((S.cfg.wxLoc || {}).name || '대구 (기본)') + '</b></div><div class="refin"><input id="wxq" maxlength="40" placeholder="구장 주소 (예: 대구 북구 도남동)"><button class="btn" id="wxs">찾기</button><button class="btn" id="wxme">📍 지금 내 위치</button></div><div class="muted">구장에 있을 때 [지금 내 위치]를 누르면 가장 정확해요</div><div id="wxr" class="wxr"></div></div>' +
    themeHTML() + '<div class="sgrp" id="refbox"><div class="g-lbl2">추천</div><div class="muted">불러오는 중...</div></div>' +
    '<div class="sgrp"><div class="g-lbl2">관리자 비밀번호 바꾸기 (처음 0000)</div><label class="f">새 비밀번호 숫자 4자리 (바꿀 때만 입력)<input id="newpin" type="text" class="pinmask" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password"></label></div>' +
    '<div class="muted" style="margin-top:8px">A-KICK ' + C.VERSION + ' · <a href="privacy.html" target="_blank">개인정보처리방침</a> · <a href="terms.html" target="_blank">이용약관</a> · <button class="lnkb" id="devfb">💌 앱 개발자에게 건의</button> · <button class="lnkb" id="dona">☕ 후원</button></div>' +
    '<div class="mfoot"><button class="btn" id="bk">백업 내려받기</button><button class="btn ghost" id="lo">로그아웃</button><span style="flex:1"></span><button class="btn" id="cx">닫기</button><button class="btn pri" id="sv">저장</button></div>', (m) => {
    m.querySelector('#cx').onclick = () => { C.applyTheme(S.club.theme); closeModal(); };
    bindTheme(m); loadRef(m);
    m.querySelector('#devfb').onclick = async () => {
      const t = prompt('A-KICK 앱 개발자에게 보낼 건의·오류·원하는 기능을 적어주세요'); if (!t || !t.trim()) return;
      try { await addDoc(collection(db, 'feedback'), { text: t.trim().slice(0, 1000), uid: S.uid, email: (auth.currentUser && auth.currentUser.email) || '', cid: CID, club: S.club.name, name: '관리자', at: Date.now(), ver: C.VERSION }); toast('개발자에게 보냈어요. 고마워요 🙏'); } catch (e) { fail(e); }
    };
    m.querySelector('#dona').onclick = () => alert('🙏 A-KICK이 팀 운영에 도움이 되셨다면, 원하시는 만큼 후원으로 응원해 주셔도 됩니다.\n🌱 후원은 앱을 계속 다듬고 새 기능을 더하는 데 쓰입니다. 부담 갖지 않으셔도 됩니다. 😊\n\n카카오뱅크 3333-15-3268863 (예금주 장은총)\n\n마음이 닿을 때, 원하시는 만큼 후원해 주시면 감사히 받겠습니다.');
    // 구장 위치: 주소 검색(오픈스트리트맵) · 지금 내 위치 · 위도,경도 직접 입력
    const wxSave = async (name, lat, lon, box) => {
      S.cfg.wxLoc = { name, lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4 };
      await putCfg(); m.querySelector('#wxcur').textContent = name; box.textContent = '저장했어요 · 다음 경기 날씨부터 이 위치로 나와요';
      const g = S.games.find((x) => x.date >= today() && !x.postponed); if (g) wxNow(g); schedulePublish();
    };
    m.querySelector('#wxs').onclick = async () => {
      const q = m.querySelector('#wxq').value.trim(), box = m.querySelector('#wxr'); if (!q) return;
      const ll = q.match(/^\s*(3[3-9]\.\d+)\s*,\s*(12[4-9]\.\d+)\s*$/);
      if (ll) return wxSave('직접 입력 ' + ll[1] + ', ' + ll[2], +ll[1], +ll[2], box);
      box.textContent = '찾는 중...';
      try {
        const rs = await (await fetch('https://nominatim.openstreetmap.org/search?format=json&countrycodes=kr&accept-language=ko&limit=6&q=' + encodeURIComponent(q))).json();
        if (!rs.length) { box.textContent = '못 찾았어요. "대구 북구 도남동"처럼 시·구·동으로 넣어보세요'; return; }
        const nm = (r) => r.display_name.split(',').map((x) => x.trim()).filter((x) => !/^\d{5}$/.test(x) && x !== '대한민국').slice(0, 4).reverse().join(' ');
        box.innerHTML = rs.map((r, i) => '<button class="btn xs" data-wx="' + i + '">' + esc(nm(r)) + '</button>').join('');
        box.querySelectorAll('[data-wx]').forEach((b) => (b.onclick = () => { const r = rs[+b.dataset.wx]; wxSave(nm(r), +r.lat, +r.lon, box); }));
      } catch (e) { box.textContent = '찾기 실패: ' + e.message; }
    };
    m.querySelector('#wxme').onclick = () => {
      const box = m.querySelector('#wxr');
      if (!navigator.geolocation) return (box.textContent = '이 브라우저는 위치를 못 써요');
      box.textContent = '위치 확인 중... (허용을 눌러주세요)';
      navigator.geolocation.getCurrentPosition((p) => wxSave('구장 현장 위치', p.coords.latitude, p.coords.longitude, box),
        () => (box.textContent = '위치 권한이 꺼져 있어요. 주소로 찾아주세요'), { enableHighAccuracy: true, timeout: 15000 });
    };
    m.querySelector('#bk').onclick = backup;
    m.querySelector('#lo').onclick = () => { closeModal(); try { sessionStorage.clear(); } catch (e) {} signOut(auth); };
    m.querySelector('#sv').onclick = async () => {
      m.querySelectorAll('[data-c]').forEach((i) => (S.cfg[i.dataset.c] = i.type === 'number' ? +i.value : i.value.trim()));
      const np = m.querySelector('#newpin').value.trim(); if (np) { if (!/^\d{4}$/.test(np)) return toast('비밀번호는 숫자 4자리로 해주세요'); S.cfg.pinHash = await pinHash(np); }
      const th = readTheme(m);
      if (JSON.stringify(th) !== JSON.stringify(S.club.theme || null)) { S.club.theme = th; await setDoc(doc(db, 'clubs', CID), clean(S.club)).catch(fail); }
      await putCfg(); closeModal(); toast('저장했어요'); render();
    };
  });
}

/* ---- 추천 제도 ----
   총무가 다른 팀 총무를 데려오면: 그 팀이 '활성 팀'(구글 계정 연결 회원 5명 + 경기 2번)이 될 때
   추천한 쪽 Pro 3개월, 추천받은 팀 Pro 1개월 적립 (유료화되는 날 적용). 구장 코드는 운영자가 만듦 */
const REF_ROOT = new URL('./', location.href).href;
const OPERATOR = 'apharmga@gmail.com';
const RM = 5, RG = 2, R_GIVE = 3, R_GET = 1;
const refActive = (c) => !!c.stat && c.stat.m >= RM && c.stat.g >= RG;
const refBadges = [[1, '🤝', '첫 영입'], [3, '🔭', '스카우터'], [10, '🕴️', '에이전트']];
function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.getRandomValues(new Uint8Array(6))].map((x) => A[x % A.length]).join(''); }
async function teamsBy(code) { return (await getDocs(query(collection(db, 'clubs'), where('refBy', '==', code))).catch(() => ({ docs: [] }))).docs.map((d) => d.data()); }
async function loadRef(m) {
  const box = m.querySelector('#refbox'); if (!box) return;
  try {
    const mineQ = (await getDocs(query(collection(db, 'refs'), where('uid', '==', S.uid)))).docs;
    let code = (mineQ.find((d) => !d.data().venue) || {}).id;
    for (let i = 0; !code && i < 5; i++) { const c = genCode(); if (!(await getDoc(doc(db, 'refs', c))).exists()) { await setDoc(doc(db, 'refs', c), { uid: S.uid, at: Date.now() }); code = c; } }
    const teams = await teamsBy(code), act = teams.filter(refActive).length, link = REF_ROOT + '?ref=' + code;
    let me = '';
    if (S.club.refBy) {
      const ok = refActive(S.club), st = S.club.stat || { m: 0, g: 0 };
      me = '<div class="refme">추천 코드 <b>' + esc(S.club.refBy) + '</b>로 시작한 팀이에요 · ' + (ok ? '✅ 활성 팀 · <b>Pro ' + R_GET + '개월 적립</b>' : '⏳ 활성 팀이 되면 Pro ' + R_GET + '개월 적립 (회원 연결 ' + Math.min(st.m, RM) + '/' + RM + ' · 경기 ' + Math.min(st.g, RG) + '/' + RG + ')') + '</div>';
    } else if (Date.now() - Date.parse(S.club.created || 0) < 30 * 864e5) {
      me = '<div class="refin"><input id="rfin" maxlength="12" placeholder="받은 추천 코드 (팀 만든 뒤 30일까지)"><button class="btn" id="rfok">등록</button></div>';
    }
    box.innerHTML = '<div class="g-lbl2">추천 · 다른 팀 총무에게 A-KICK 알려주기</div>' +
      '<div class="refcode"><span>내 추천 코드</span><b>' + code + '</b><button class="btn pri" id="rfcp">추천 문구 복사</button></div>' +
      '<div class="refsum"><span>가입한 팀 <b>' + teams.length + '</b></span><span>활성 팀 <b>' + act + '</b></span><span>적립 <b>Pro ' + act * R_GIVE + '개월</b></span></div>' +
      '<div class="refbd">' + refBadges.map(([n, ic, t]) => '<span class="' + (act >= n ? 'on' : '') + '"><i>' + ic + '</i>' + t + '<small>활성 ' + n + '팀</small></span>').join('') + '</div>' +
      (teams.length ? '<div class="reflist">' + teams.map((c) => '<div><b>' + esc(c.name) + '</b><span>' + (refActive(c) ? '✅ 활성' : '⏳ 회원 ' + Math.min((c.stat || {}).m || 0, RM) + '/' + RM + ' · 경기 ' + Math.min((c.stat || {}).g || 0, RG) + '/' + RG) + '</span></div>').join('') + '</div>' : '') +
      '<div class="muted">추천받은 팀이 <b>활성 팀</b>(앱에 연결된 회원 ' + RM + '명 + 경기 ' + RG + '번)이 되면 나는 Pro ' + R_GIVE + '개월, 그 팀은 Pro ' + R_GET + '개월이 적립돼요. 지금은 무료라 유료 기능이 생기는 날 자동 적용돼요.</div>' + me +
      (S.uid && auth.currentUser && auth.currentUser.email === OPERATOR ? '<div id="venuebox"></div>' : '');
    box.querySelector('#rfcp').onclick = () => copy('⚽ 총무 일 줄여주는 앱 A-KICK 써보세요!\n모임통장 엑셀만 올리면 회비·게스트비 정리 끝, 참석 투표·팀 편성도 돼요.\n이 링크로 팀을 만들면 Pro 무료 이용권을 드려요 (유료화 때 적용)\n👉 ' + link);
    const ok = box.querySelector('#rfok');
    if (ok) ok.onclick = async () => {
      const rc = box.querySelector('#rfin').value.trim().toUpperCase(); if (!rc) return;
      const r = await getDoc(doc(db, 'refs', rc)).catch(() => null);
      if (!r || !r.exists()) return toast('없는 추천 코드예요');
      if (r.data().uid === S.uid) return toast('내 추천 코드는 내 팀에 쓸 수 없어요');
      try { await setDoc(doc(db, 'clubs', CID), { refBy: rc }, { merge: true }); S.club.refBy = rc; toast('추천 코드를 등록했어요'); loadRef(m); } catch (e) { fail(e); }
    };
    if (box.querySelector('#venuebox')) loadVenues(box.querySelector('#venuebox'), mineQ.filter((d) => d.data().venue));
  } catch (e) { box.innerHTML = '<div class="g-lbl2">추천</div><div class="muted">불러오지 못했어요: ' + esc(e.message) + '</div>'; logErr('추천 불러오기 실패: ' + e.message, e.stack); }
}
/** 운영자만: 구장 추천 코드 (구장이 정기대관 팀에게 A-KICK을 권하면 구장에도 적립) */
async function loadVenues(el, vs) {
  const rows = await Promise.all(vs.map(async (d) => { const t = await teamsBy(d.id); return [d.id, d.data().venue, t.length, t.filter(refActive).length]; }));
  el.innerHTML = '<div class="g-lbl2" style="margin-top:12px">운영자 · 구장 코드</div>' +
    (rows.length ? '<div class="reflist">' + rows.map((r) => '<div><b>' + esc(r[1]) + ' · ' + r[0] + '</b><span>가입 ' + r[2] + ' · 활성 ' + r[3] + ' · 구장판 ' + r[3] * R_GIVE + '개월</span><button class="btn xs" data-vcp="' + r[0] + '">링크</button></div>').join('') + '</div>' : '<div class="muted">아직 구장 코드가 없어요</div>') +
    '<div class="refin"><input id="vcode" maxlength="12" placeholder="코드 (예: DONAM)"><input id="vname" maxlength="20" placeholder="구장 이름"><button class="btn" id="vmk">만들기</button></div>';
  el.querySelectorAll('[data-vcp]').forEach((b) => (b.onclick = () => copy(REF_ROOT + '?ref=' + b.dataset.vcp)));
  el.querySelector('#vmk').onclick = async () => {
    const c = el.querySelector('#vcode').value.trim().toUpperCase(), n = el.querySelector('#vname').value.trim();
    if (!/^[A-Z0-9]{4,12}$/.test(c)) return toast('코드는 영문·숫자 4~12자로 해주세요'); if (!n) return toast('구장 이름을 넣어주세요');
    if ((await getDoc(doc(db, 'refs', c))).exists()) return toast('이미 있는 코드예요');
    try { await setDoc(doc(db, 'refs', c), { uid: S.uid, at: Date.now(), venue: n }); toast('구장 코드를 만들었어요'); loadVenues(el, vs.concat([{ id: c, data: () => ({ venue: n }) }])); } catch (e) { fail(e); }
  };
}

/* ---- 화면 아무 데나 끌어다 놓기 ---- */
let dragN = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragN++; $('#drop').hidden = false; });
window.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; $('#drop').hidden = true; } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault(); dragN = 0; $('#drop').hidden = true;
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (!S.cfg) return readOld(f);
  importBank(f);
});
