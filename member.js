import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, deleteUser } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, getDoc as _getDoc, setDoc as _setDoc, deleteDoc as _deleteDoc, writeBatch as _writeBatch, onSnapshot as _onSnapshot, query, where, getDocs as _getDocs, addDoc as _addDoc, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { demoData } from './demo.js';
/* 체험 팀(로그인 없이 둘러보기): 서버를 읽지도 쓰지도 않음. 누른 건 화면에만 반영되고 저장 안 됨 */
const DEMO_MSG = '체험 팀이라 저장되지 않아요 · 내 팀을 만들면 진짜로 저장돼요';
let tapAt = 0; addEventListener('pointerdown', () => (tapAt = Date.now()), true);
const noW = () => { if (Date.now() - tapAt < 2000) setTimeout(() => toast(DEMO_MSG), 60); return Promise.resolve(); };   // 배경 저장(업적 등)은 조용히, 직접 누른 것만 안내
const setDoc = (...a) => (S.demo ? noW() : _setDoc(...a)), deleteDoc = (...a) => (S.demo ? noW() : _deleteDoc(...a)), addDoc = (...a) => (S.demo ? noW() : _addDoc(...a));
const writeBatch = (d) => (S.demo ? { set() {}, update() {}, delete() {}, commit: noW } : _writeBatch(d));
const onSnapshot = (...a) => (S.demo ? () => {} : _onSnapshot(...a));
const getDoc = (...a) => (S.demo ? Promise.resolve({ exists: () => false, data: () => undefined }) : _getDoc(...a));
const getDocs = (...a) => (S.demo ? Promise.resolve({ docs: [], empty: true, size: 0 }) : _getDocs(...a));

/* 카카오톡 안 브라우저에서는 구글 로그인이 막혀 있어서 바깥 브라우저(크롬·사파리)로 엽니다 */
const UA = navigator.userAgent || '';
const IS_KAKAO = /KAKAOTALK/i.test(UA), IS_ANDROID = /Android/i.test(UA);
function openOutside() {
  const url = location.href;
  if (IS_KAKAO) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
  else if (IS_ANDROID) location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
}
if (IS_KAKAO) openOutside();
const INAPP = /KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|BAND\//i.test(UA);

const fb = initializeApp({
  apiKey: 'AIzaSyBZps4AWzRrf07yzSuIgydRO_Dn2qGrx9E',
  authDomain: 'a-futsal.firebaseapp.com',
  projectId: 'a-futsal',
  storageBucket: 'a-futsal.firebasestorage.app',
  messagingSenderId: '873470138264',
  appId: '1:873470138264:web:121893883d55576c577ded'
});
const auth = getAuth(fb), db = getFirestore(fb);

/* 오류 기록: 화면에서 난 오류를 운영자가 볼 수 있게 저장 (한 번 열 때 최대 5건, 같은 오류는 1번만) */
const OPERATOR = 'apharmga@gmail.com';
const errSeen = new Set();
function logErr(msg, stack) {
  try {
    msg = String(msg || '').slice(0, 500); if (!msg || errSeen.has(msg) || errSeen.size >= 5 || !auth.currentUser) return; errSeen.add(msg);
    addDoc(collection(db, 'errlog'), { at: Date.now(), uid: auth.currentUser.uid, cid: (typeof S !== 'undefined' && S.cid) || '', page: 'member', msg, stack: String(stack || '').slice(0, 2000), ua: UA.slice(0, 300), ver: (window.Core && window.Core.VERSION) || '' }).catch(() => {});
  } catch (e) {}
}
window.addEventListener('error', (e) => logErr(e.message, e.error && e.error.stack));
setTimeout(() => { try { const m = sessionStorage.getItem('akick_msg'); if (m) { sessionStorage.removeItem('akick_msg'); toast(m); } } catch (e) {} }, 800);
window.addEventListener('unhandledrejection', (e) => logErr(e.reason && (e.reason.message || e.reason), e.reason && e.reason.stack));

/* 홈 화면에 추가 (앱처럼 쓰기) */
try { const rq = new URLSearchParams(location.search).get('ref'); if (rq) localStorage.setItem('akick_ref', rq.toUpperCase().slice(0, 12)); } catch (e) {}
const refSaved = () => { try { return localStorage.getItem('akick_ref') || ''; } catch (e) { return ''; } };
const STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const IS_IOS = /iPhone|iPad|iPod/i.test(UA);
let installEv = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEv = e; if (S.tab === 'home' && S.pub) render(); });
function installCard() {
  let off = false; try { off = localStorage.getItem('akick_noinstall') === '1'; } catch (e) {}
  if (STANDALONE || off || INAPP || (!installEv && !IS_IOS)) return '';
  return '<section class="card inst"><b>📲 홈 화면에 추가하면 앱처럼 열려요</b>' +
    (installEv ? '<button class="bigbtn" id="inst">홈 화면에 추가</button>' : '<p class="muted">사파리 아래쪽 <b>공유 버튼(⬆)</b> → <b>홈 화면에 추가</b>를 눌러주세요.</p>') +
    '<button class="link" id="noinst">다시 보지 않기</button></section>';
}
const S = { pub: null, me: null, votes: {}, tab: 'home', uid: '', cid: '', club: null, owner: false, subs: [], voteSub: null, voteGid: '' };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => String(Math.round(Math.abs(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const md = (d) => (+d.substr(5, 2)) + '/' + (+d.substr(8, 2));
const day = (d) => '일월화수목금토'[new Date(d + 'T00:00:00').getDay()];
const mon = (ym) => (+ym.substr(5, 2)) + '월';
const LEGAL = '<small class="legal">시작하면 <a href="terms.html">이용약관</a>과 <a href="privacy.html">개인정보처리방침</a>에 동의하게 돼요</small>';
const CD = (...p) => doc(db, 'clubs', S.cid, ...p);
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
let tT = null;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tT); tT = setTimeout(() => (t.hidden = true), 2500); }
async function copy(text, done) { try { await navigator.clipboard.writeText(text); toast(done || '복사했어요'); } catch (e) { prompt('복사해서 쓰세요', text); } }
const view = (h) => ($('#app').innerHTML = h);

/* ---------------- 1. 로그인 ---------------- */
const IS_DEMO = new URLSearchParams(location.search).get('demo') === '1';
onAuthStateChanged(auth, (u) => { if (IS_DEMO) return startDemo(); if (!u) return renderLogin(); S.uid = u.uid; S.email = u.email || ''; start(); });
function renderLogin() {
  view('<div class="login"><div class="logo8"><div class="stk">A-KICK</div><div class="pills"><span class="p1">⚽ FUTSAL</span><span class="p2">🥅 FOOTBALL</span></div></div>' +
    '<p class="lt">우리 모임, 오늘도 킥오프!<br><span>참석 투표 · 팀 편성 · 회비 · 장부</span></p>' +
    (INAPP ? '<div class="warn"><b>카카오톡·밴드 안에서는 구글 로그인이 막혀 있어요.</b><br>아래 버튼을 누르면 ' + (/iPhone|iPad/i.test(UA) ? '사파리' : '크롬') + '로 바로 열려요.' +
      '<button id="ext" class="extbtn">' + (/iPhone|iPad/i.test(UA) ? '사파리' : '크롬') + '로 열기</button><button id="cpl" class="lnk">안 열리면 링크 복사</button></div>'
      : '<button class="gbtn" id="in"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>구글로 시작하기</button>' +
        '<small>처음이면 로그인 → 이름 쓰고 가입 신청 → 관리자 승인 후 입장</small>') + DEMO_BTN + LEGAL + '</div>');
  bindDemoBtn();
  const i = $('#in'); if (i) i.onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => toast(e.code === 'auth/popup-closed-by-user' ? '로그인을 취소했어요' : '로그인 실패: ' + e.message));
  const x = $('#ext'); if (x) x.onclick = openOutside;
  const c = $('#cpl'); if (c) c.onclick = () => copy(location.href, '링크를 복사했어요. 사파리·크롬 주소창에 붙여넣으세요');
}

/* ---------------- 체험 팀 둘러보기 ---------------- */
const DEMO_BTN = '<button class="demobtn" id="demo">👀 체험 팀 둘러보기 (샘플 · 로그인 없이 OK)</button>';
function bindDemoBtn() { const b = $('#demo'); if (b) b.onclick = () => (location.href = './?demo=1'); }
function startDemo() {
  const d = demoData(), g = d.pub.games[0];
  Object.assign(S, { demo: true, uid: 'demo', email: '', cid: 'demo', club: d.club, owner: false, pub: d.pub, me: d.me, polls: d.polls, pvotes: d.pvotes, avotes: d.avotes, ah: {},
    goals: d.goals, profs: d.profs, vcAll: [], videos: [], votes: d.votes, pollsLoaded: true, pvLoaded: true, rpsNet: 0, rpsToday: null, wx: d.wx, wxGid: g.id, voteGid: g.id,
    pollSub: [], goalSub: 1, profSub: 1, vcSub: 1, vidSub: 1, rpsSub: 1, myClubs: {}, seenAll: {} });
  document.title = '체험FC · A-KICK'; window.Core.applyTheme(null); achLoad(); render();
}
const exitDemo = () => (location.href = './');

/* ---------------- 2. 어느 팀인지 ---------------- */
async function start() {
  view('<div class="center">불러오는 중...</div>');
  achLoad();
  const meRef = doc(db, 'me', S.uid);
  let me = {}; try { const d = await getDoc(meRef); me = d.exists() ? d.data() : {}; } catch (e) {}
  S.myClubs = me.clubs || {}; S.seenAll = me.seen || {};
  const urlC = new URLSearchParams(location.search).get('c');
  const cid = urlC || me.last || '';
  if (!cid) return renderHome();
  try {
    const c = await getDoc(doc(db, 'clubs', cid));
    if (!c.exists()) { toast('없어진 팀이에요'); delete S.myClubs[cid]; await saveMyClubs(); return renderHome(); }
    S.cid = cid; S.club = c.data(); S.owner = S.club.owner === S.uid; window.Core.applyTheme(S.club.theme);
    if (!urlC) history.replaceState(null, '', './?c=' + cid);
    S.myClubs[cid] = S.club.name;
    setDoc(meRef, { clubs: S.myClubs, last: cid }, { merge: true }).catch(() => {});
    document.title = S.club.name;
    S.subs.forEach((f) => f()); S.subs = [];
    const u = await getDoc(CD('users', S.uid)); S.me = u.exists() ? u.data() : null;
    // 가입 승인제: 관리자가 승인해야(users 문서가 생겨야) 팀 화면이 열림
    if (!S.me && !S.owner) return renderRequest();
    // 관리자가 강퇴하거나 연결을 끊으면 내 users 문서가 사라짐 → 바로 안내 화면으로
    if (S.me && !S.owner) S.subs.push(onSnapshot(CD('users', S.uid), (d) => { if (!d.exists()) kickedView(); }, () => {}));
    S.subs.push(onSnapshot(CD('pub', 'state'), (d) => { S.pub = d.exists() ? d.data() : null; watchVotes(); render(); },
      (e) => view('<div class="center">불러오지 못했어요<br><small>' + esc(e.message) + '</small></div>')));
  } catch (e) { view('<div class="center">불러오지 못했어요<br><small>' + esc(e.message) + '</small></div>'); }
}
/* ---------------- 가입 신청 → 관리자 승인 대기 ---------------- */
async function renderRequest() {
  let req = null; try { const r = await getDoc(CD('requests', S.uid)); req = r.exists() ? r.data() : null; } catch (e) {}
  const head = '<header class="hero"><div class="hrow"><b>' + esc(S.club.name) + '</b><span class="who">' + esc(S.email) + '</span></div>';
  if (req) {
    view(head + '<h1>승인 기다리는 중 ⏳</h1><p>관리자가 승인하면 이 화면이 바로 열려요.</p></header><main class="pad lift"><section class="card"><h2>' + esc(req.name) + ' 님으로 신청했어요</h2>' +
      '<p class="muted">승인되면 자동으로 들어가져요. 앱을 닫았다가 나중에 다시 열어도 돼요.</p><button class="link" id="redo">이름을 잘못 썼어요 (다시 신청)</button></section>' +
      '<div class="links"><button class="link" id="home">다른 팀 보기</button><button class="link" id="out">로그아웃</button></div></main>');
    $('#redo').onclick = () => askJoin(req.name);
  } else askJoin('');
  bindCommon();
  // 승인되면(내 users 문서가 생기면) 바로 입장
  S.subs.push(onSnapshot(CD('users', S.uid), (d) => { if (d.exists()) { S.subs.forEach((f) => f()); S.subs = []; start(); } }, () => {}));
}
function askJoin(name) {
  view('<header class="hero"><div class="hrow"><b>' + esc(S.club.name) + '</b><span class="who">' + esc(S.email) + '</span></div><h1>가입 신청</h1><p>관리자가 확인하고 승인하면 들어갈 수 있어요.</p></header>' +
    '<main class="pad lift"><section class="card"><h2>내 이름</h2><p class="muted">모임에서 쓰는 실명으로 써주세요.</p><div class="newc"><input id="jn" maxlength="20" placeholder="예: 홍길동" value="' + esc(name) + '"><button id="jok">신청하기</button></div>' + LEGAL + '</section>' +
    '<div class="links"><button class="link" id="home">다른 팀 보기</button><button class="link" id="out">로그아웃</button></div></main>');
  $('#jok').onclick = async () => {
    const n = $('#jn').value.trim(); if (!n) return toast('이름을 써주세요');
    try { await setDoc(CD('requests', S.uid), { name: n, email: S.email, at: Date.now() }); toast('신청했어요. 승인을 기다려 주세요'); S.subs.forEach((f) => f()); S.subs = []; renderRequest(); }
    catch (e) { toast('신청 실패: ' + e.message); }
  };
  bindCommon();
}

/* 팀 삭제 (만든 사람만) · 목록에서 빼기 (회원) */
async function saveMyClubs() { await setDoc(doc(db, 'me', S.uid), { clubs: S.myClubs, last: '', seen: S.seenAll || {} }).catch(() => {}); }
/* ---------------- NEW 표시 · 하단 숫자 배지 ----------------
   회원마다 '언제 무엇을 봤는지'를 me 문서에 기억 → 폰을 바꿔도 같은 기준 */
const NEWB = '<i class="nb">NEW</i>';
function seenOf() { const a = (S.seenAll = S.seenAll || {}); if (!a[S.cid]) a[S.cid] = { since: Date.now(), items: {} }; return a[S.cid]; }
let seenT = null;
function markSeen(id) {
  const sn = seenOf(); sn.items[id] = Date.now();
  clearTimeout(seenT); seenT = setTimeout(() => setDoc(doc(db, 'me', S.uid), { seen: { [S.cid]: sn } }, { merge: true }).catch(() => {}), 800);
}
const tsOf = (x) => (typeof x === 'number' ? x : Date.parse(x || 0) || 0);
function isNewPoll(p) { const sn = seenOf(); return !sn.items[p.id] && tsOf(p.created) > sn.since && !myPV(p); }
function isNewVid(v) { const sn = seenOf(); return !sn.items[v.id] && tsOf(v.at) > sn.since; }
/** 영상에 내가 마지막으로 본 뒤 달린 남의 댓글 수 (새 영상이면 영상 NEW로 충분해서 0) */
function newCmts(v) {
  const sn = seenOf(), base = sn.items[v.id]; if (!base) return 0;
  return (S.vcAll || []).filter((c) => c.vid === v.id && c.uid !== S.uid && c.at > base).length;
}
function teamKey() { const g = (S.pub.games || [])[0]; return g && (g.teams || []).length >= 2 ? 'T' + g.id + ':' + g.teams.join('/').length : ''; }
function isNewTeam() { const k = teamKey(), sn = seenOf(); return !!k && !sn.items[k] && sn.since < Date.now() - 1000; }
function badgeCounts() {
  const vs = S.videos || [];
  return { home: (S.polls || []).filter(isNewPoll).length,
           rec: vs.filter(isNewVid).length + vs.reduce((a, v) => a + newCmts(v), 0),
           week: isNewTeam() ? 1 : 0 };
}
/* ---------------- 하이라이트 영상 (유튜브 일부공개 + 앱 안에서 재생·댓글·시간 태그) ----------------
   전체 화면을 다시 그리는 render()와 분리된 별도 창(#vov)에서 재생 → 투표·기록이 갱신돼도 영상이 끊기지 않음 */
const ytThumb = (id) => 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
const fmtT = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
function vidsSorted() { return (S.videos || []).slice().sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1)); }
function vidCard(v) {
  return '<button class="vcard" data-vid="' + esc(v.id) + '"><span class="vth"><img src="' + ytThumb(v.yt) + '" alt="" loading="lazy"><i>▶</i></span><span class="vtx"><b>' + esc(v.title || '하이라이트') + (isNewVid(v) ? NEWB : '') + '</b><small>' + (v.date ? md(v.date) + ' 경기' : '') + '</small>' + (newCmts(v) ? '<em class="ncm">💬 새 댓글 ' + newCmts(v) + '</em>' : '') + '</span></button>';
}
function vidsHome() {
  const vs = vidsSorted(); if (!vs.length) return '';
  const anyNew = vs.some((v) => isNewVid(v) || newCmts(v));
  return '<section class="card"><div class="h2row"><h2>🎬 하이라이트' + (anyNew ? NEWB : '') + '</h2>' + (vs.length > 3 ? '<button class="more inl" data-go="rec">전체 ›</button>' : '') + '</div><div class="vlist">' + vs.slice(0, 3).map(vidCard).join('') + '</div></section>';
}
function vidsRec() {
  const vs = vidsSorted(); if (!vs.length) return '';
  return '<section class="card"><h2>🎬 하이라이트</h2><div class="vlist">' + vs.map(vidCard).join('') + '</div></section>';
}
let ytReady = null;
function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((res) => {
    if (window.YT && window.YT.Player) return res();
    const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); };
    const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(sc);
  });
  return ytReady;
}
/** 댓글 글자 안의 1:23, 12:05, 1:02:33 → 누르면 그 시간으로 이동하는 버튼 */
function tsText(t) {
  return esc(t).replace(/(^|[^\d:])((\d{1,2}):([0-5]\d)(?::([0-5]\d))?)(?![\d:])/g, (all, pre, txt, a, b, c) => {
    const sec = c !== undefined ? (+a) * 3600 + (+b) * 60 + (+c) : (+a) * 60 + (+b);
    return pre + '<button class="ts" data-ts="' + sec + '">' + txt + '</button>';
  });
}
const VV = { player: null, unsub: null, id: '', reply: null };
function closeVideo(fromPop) {
  const ov = $('#vov'); if (!ov) return;
  if (VV.unsub) VV.unsub(); VV.unsub = null;
  try { VV.player && VV.player.destroy(); } catch (e) {}
  if (VV.id) markSeen(VV.id);
  VV.player = null; VV.id = ''; ov.remove(); document.body.classList.remove('noscroll'); render();
  if (!fromPop && history.state && history.state.vov) history.back();
}
window.addEventListener('popstate', () => { if ($('#vov')) closeVideo(true); });
async function openVideo(id) {
  const v = (S.videos || []).find((x) => x.id === id); if (!v) return toast('영상을 찾지 못했어요');
  closeVideo(true); markSeen(id); achAdd('vw', id, 500);
  history.pushState({ vov: 1 }, '');
  VV.id = id;
  const ov = document.createElement('div'); ov.id = 'vov'; ov.className = 'vov';
  ov.innerHTML = '<div class="vtop"><button class="vx" id="vx" aria-label="닫기">‹</button><div><b>' + esc(v.title || '하이라이트') + '</b><small>' + (v.date ? md(v.date) + ' (' + day(v.date) + ') 경기' : '') + '</small></div></div>' +
    '<div class="vplay"><div id="ytp"></div></div>' +
    '<div class="vbody"><div class="vhint">댓글에 <b>1:23</b>처럼 시간을 쓰면, 누를 때 그 장면으로 이동해요</div><div id="vcl" class="vcl"><div class="muted">댓글 불러오는 중...</div></div></div>' +
    '<div class="vrep" id="vrep" hidden></div><div class="vin"><button id="vnow" class="vnow">⏱ 지금 시간</button><textarea id="vtxt" rows="1" maxlength="500" placeholder="댓글 쓰기 (예: 2:15 이 골 미쳤다)"></textarea><button id="vsend" class="vsend">등록</button></div>';
  document.body.appendChild(ov); document.body.classList.add('noscroll');
  $('#vx').onclick = () => closeVideo();
  const ta = $('#vtxt');
  VV.reply = null;
  const setReply = (c) => {                            // 답글 대상 (대댓글은 한 단계: 답글에 답글을 달아도 같은 댓글 아래로)
    VV.reply = c; const bar = $('#vrep');
    if (!c) { bar.hidden = true; ta.placeholder = '댓글 쓰기 (예: 2:15 이 골 미쳤다)'; return; }
    bar.hidden = false; bar.innerHTML = '↪ <b>' + esc(c.name) + '</b>님에게 답글 <button id="vrx" aria-label="답글 취소">✕</button>';
    $('#vrx').onclick = () => setReply(null); ta.placeholder = '답글 쓰기'; ta.focus();
  };
  ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; };
  $('#vnow').onclick = () => {
    const t = VV.player && VV.player.getCurrentTime ? fmtT(VV.player.getCurrentTime()) : '0:00';
    const p = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p) + t + ' ' + ta.value.slice(p); ta.focus(); ta.oninput();
  };
  $('#vsend').onclick = async () => {
    const text = ta.value.trim(); if (!text) return;
    $('#vsend').disabled = true;
    const doc0 = { vid: id, text, name: S.me.name, mid: S.me.mid, uid: S.uid, at: Date.now() };
    if (VV.reply) { doc0.pid = VV.reply.root; if (VV.reply.root !== VV.reply.id && text.indexOf('@' + VV.reply.name) < 0) doc0.text = '@' + VV.reply.name + ' ' + text; }
    try { await addDoc(collection(db, 'clubs', S.cid, 'vcomments'), doc0); ta.value = ''; ta.oninput(); setReply(null); }
    catch (e) { toast('댓글 저장 실패: ' + e.message); logErr('댓글 저장 실패: ' + e.message, e.stack); }
    $('#vsend').disabled = false;
  };
  $('#vcl').onclick = async (e) => {
    const ts = e.target.closest('[data-ts]');
    if (ts && VV.player && VV.player.seekTo) { VV.player.seekTo(+ts.dataset.ts, true); VV.player.playVideo(); ov.querySelector('.vplay').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const rp = e.target.closest('[data-rep]');
    if (rp) return setReply({ id: rp.dataset.rep, root: rp.dataset.root, name: rp.dataset.name });
    const del = e.target.closest('[data-cdel]');
    if (del && confirm('이 댓글을 지울까요?' + (cs0().some((c) => c.pid === del.dataset.cdel) ? '\n(달린 답글은 남아요)' : ''))) await deleteDoc(doc(db, 'clubs', S.cid, 'vcomments', del.dataset.cdel)).catch((er) => toast('삭제 실패: ' + er.message));
  };
  const cs0 = () => VV.cs || [];
  VV.unsub = onSnapshot(query(collection(db, 'clubs', S.cid, 'vcomments'), where('vid', '==', id)), (q) => {
    const cs = q.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => a.at - b.at), box = $('#vcl'); if (!box) return;
    VV.cs = cs;
    const ids = new Set(cs.map((c) => c.id)), roots = cs.filter((c) => !c.pid), kids = {};
    cs.filter((c) => c.pid).forEach((c) => (kids[c.pid] = kids[c.pid] || []).push(c));
    Object.keys(kids).forEach((p) => { if (!ids.has(p)) roots.push({ id: p, gone: 1, at: kids[p][0].at }); });   // 원댓글이 지워져도 답글은 남김
    roots.sort((a, b) => a.at - b.at);
    const one = (c, root) => c.gone ? '<div class="vcm gone">삭제된 댓글이에요</div>' :
      '<div class="vcm' + (root !== c.id ? ' sub' : '') + '"><div class="vch"><b>' + lvPill(lvOfMid(c.mid)) + esc(c.name) + '</b><small>' + new Date(c.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</small>' +
      (c.uid === S.uid || S.owner ? '<button class="vdel" data-cdel="' + esc(c.id) + '" aria-label="삭제">✕</button>' : '') + '</div><div class="vct">' + tsText(c.text) + '</div>' +
      '<button class="vrb" data-rep="' + esc(c.id) + '" data-root="' + esc(root) + '" data-name="' + esc(c.name) + '">답글</button></div>';
    box.innerHTML = roots.length ? roots.map((r) => '<div class="vth2">' + one(r, r.id) + ((kids[r.id] || []).length ? '<div class="vkids">' + kids[r.id].map((k) => one(k, r.id)).join('') + '</div>' : '') + '</div>').join('') : '<div class="muted">첫 댓글을 남겨보세요 ⚽</div>';
  }, () => {});
  await loadYT();
  if (VV.id !== id) return;
  VV.player = new YT.Player('ytp', { videoId: v.yt, width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0, modestbranding: 1 } });
}

/* ---------------- 푸시 알림 ----------------
   지금은 '받기 설정'까지만 동작. 실제 발송은 앱 출시 때 서버(functions/index.js)를 켜면 시작됨.
   VAPID_KEY(파이어베이스 콘솔 → 클라우드 메시징 → 웹 푸시 인증서)를 넣으면 기기 토큰도 자동으로 저장됨 */
const VAPID_KEY = '';
const PUSH_OK = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
async function pushToken() {
  if (!VAPID_KEY || !PUSH_OK || Notification.permission !== 'granted') return '';
  try {
    const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');
    return await getToken(getMessaging(fb), { vapidKey: VAPID_KEY, serviceWorkerRegistration: await navigator.serviceWorker.ready });
  } catch (e) { logErr('푸시 토큰 실패: ' + e.message, e.stack); return ''; }
}
async function savePush(on) {
  const token = on ? await pushToken() : ''; if (on) achFlag('push');
  await setDoc(doc(db, 'clubs', S.cid, 'push', S.uid), { on: !!on, token, mid: S.me.mid, at: Date.now() }).catch((e) => logErr('알림 설정 저장 실패: ' + e.message));
}
function openNotify() {
  const iosNoInstall = IS_IOS && !STANDALONE;
  const st = !PUSH_OK ? (iosNoInstall ? 'ios' : 'no') : Notification.permission;
  sheet('<h2>🔔 알림</h2>' +
    '<p class="muted">새 투표·공지, 새 하이라이트, 내 댓글에 달린 답글을 폰 알림으로 받아요.</p>' +
    '<div class="ntfbox">' + (st === 'granted' ? '✅ 이 폰은 알림을 받도록 설정돼 있어요.' : st === 'denied' ? '⛔ 알림이 차단돼 있어요. 폰 설정 → 브라우저(크롬·사파리) → 알림에서 이 사이트를 허용해 주세요.' :
      st === 'ios' ? '📲 아이폰은 <b>홈 화면에 추가</b>한 아이콘으로 열어야 알림을 받을 수 있어요. 사파리 공유 버튼(⬆) → 홈 화면에 추가 후 그 아이콘으로 다시 열어주세요.' :
      st === 'no' ? '이 브라우저는 알림을 지원하지 않아요. 크롬이나 사파리(홈 화면에 추가)로 열어주세요.' : '아래 버튼을 누르고 \'허용\'을 골라주세요.') + '</div>' +
    '<div class="muted" style="font-size:12px">알림 발송은 정식 오픈 때부터 시작돼요. 지금 켜두면 그때부터 자동으로 받아요.</div>' +
    '<div class="srow"><button id="nx">닫기</button>' + (st === 'default' ? '<button class="pri" id="non">알림 받기</button>' : st === 'granted' ? '<button id="noff">이 폰 알림 끄기</button>' : '') + '</div>', (el) => {
    el.querySelector('#nx').onclick = () => (el.hidden = true);
    const on = el.querySelector('#non'); if (on) on.onclick = async () => { const r = await Notification.requestPermission(); await savePush(r === 'granted'); el.hidden = true; toast(r === 'granted' ? '알림을 켰어요 🔔' : '알림을 허용하지 않았어요'); };
    const off = el.querySelector('#noff'); if (off) off.onclick = async () => { await savePush(false); el.hidden = true; toast('이 폰 알림을 껐어요'); };
  });
}

/* ---------------- 선수 정보 (등번호·포지션, 선택) ---------------- */
const POS = ['GK', 'DF', 'MF', 'FW'];
function profOf(name) { const m = (S.pub.members || []).find((x) => x.name === name); return (m && (S.profs || {})[m.id]) || null; }
function profCard() {
  const p = (S.profs || {})[S.me.mid] || {};
  return '<section class="card"><div class="h2row"><h2>내 선수 정보 <small class="muted">선택</small></h2><button class="more inl" id="pedit">' + (p.num || (p.pos || []).length ? '수정 ›' : '입력 ›') + '</button></div>' +
    '<div class="pinfo">' + (p.num ? '<b class="pnum">' + p.num + '</b>' : '<span class="muted">등번호 없음</span>') + ((p.pos || []).length ? p.pos.map((x) => '<em class="ppos">' + x + '</em>').join('') : '') + '</div>' +
    '<div class="muted" style="font-size:12px">등번호는 팀 편성 그림에 표시돼요</div></section>';
}
function openProfile() {
  const p = (S.profs || {})[S.me.mid] || {}; let pos = (p.pos || []).slice();
  sheet('<h2>내 선수 정보</h2><div class="muted">모두 선택이에요. 등번호는 팀 편성 그림의 동그라미 안에 떠요.</div>' +
    '<label class="f">등번호 (1~99)<input id="pn" type="number" inputmode="numeric" min="1" max="99" value="' + (p.num || '') + '"></label>' +
    '<div class="wl">주 포지션 (최대 2개)</div><div class="ppick">' + POS.map((x) => '<button data-pp="' + x + '" class="' + (pos.indexOf(x) >= 0 ? 'on' : '') + '">' + x + '<small>' + { GK: '골키퍼', DF: '수비', MF: '미드필더', FW: '공격' }[x] + '</small></button>').join('') + '</div>' +
    '<div class="srow"><button id="px2">닫기</button><button class="pri" id="psv">저장</button></div>', (el) => {
    el.querySelectorAll('[data-pp]').forEach((b) => (b.onclick = () => {
      const x = b.dataset.pp; if (pos.indexOf(x) >= 0) pos = pos.filter((y) => y !== x); else { pos.push(x); if (pos.length > 2) pos.shift(); }
      el.querySelectorAll('[data-pp]').forEach((y) => y.classList.toggle('on', pos.indexOf(y.dataset.pp) >= 0));
    }));
    el.querySelector('#px2').onclick = () => (el.hidden = true);
    el.querySelector('#psv').onclick = async () => {
      const n = +el.querySelector('#pn').value || 0;
      if (n && (n < 1 || n > 99)) return toast('등번호는 1~99로 넣어주세요');
      const dup = n && Object.entries(S.profs || {}).find(([mid, x]) => mid !== S.me.mid && x.num === n);
      if (dup) { const who = (S.pub.members || []).find((m) => m.id === dup[0]); if (!confirm((who ? who.name + ' 님이' : '다른 회원이') + ' 이미 ' + n + '번이에요. 그래도 쓸까요?')) return; }
      try { await setDoc(doc(db, 'clubs', S.cid, 'profiles', S.me.mid), Object.assign({ num: n, pos, uid: S.uid, at: Date.now() }, p.ach ? { ach: p.ach, plat: p.plat || 0 } : {}, p.xp ? { xp: p.xp, lv: p.lv || 1 } : {})); el.hidden = true; toast('저장했어요'); }
      catch (e) { toast('저장 실패: ' + e.message); logErr('프로필 저장 실패: ' + e.message, e.stack); }
    };
  });
}

/* ---------------- 탈퇴 · 계정 삭제 ---------------- */
async function wipeMine(cid) {                       // 한 팀 안의 내 흔적 지우기 (이름이 들어간 장부 기록은 관리자 소유라 남음)
  const C = (c) => collection(db, 'clubs', cid, c), del = (q) => getDocs(q).then((r) => Promise.all(r.docs.map((d) => deleteDoc(d.ref).catch(() => {})))).catch(() => {});
  const marks = await getDocs(query(C('anonmark'), where('uid', '==', S.uid))).catch(() => null);
  if (marks) for (const m of marks.docs) { await deleteDoc(doc(db, 'clubs', cid, 'anonvotes', m.data().pid + '__' + m.data().key)).catch(() => {}); }
  await Promise.all([del(query(C('votes'), where('uid', '==', S.uid))), del(query(C('pollvotes'), where('uid', '==', S.uid))),
    del(query(C('goals'), where('by', '==', S.uid))), del(query(C('suggest'), where('uid', '==', S.uid))), del(query(C('vcomments'), where('uid', '==', S.uid))), del(query(C('rps'), where('uid', '==', S.uid)))]);
  if (marks) await Promise.all(marks.docs.map((m) => deleteDoc(m.ref).catch(() => {})));
  const u = await getDoc(doc(db, 'clubs', cid, 'users', S.uid)).catch(() => null);
  if (u && u.exists()) await deleteDoc(doc(db, 'clubs', cid, 'claims', u.data().mid)).catch(() => {});
  await deleteDoc(doc(db, 'clubs', cid, 'push', S.uid)).catch(() => {});
  if (u && u.exists()) await deleteDoc(doc(db, 'clubs', cid, 'profiles', u.data().mid)).catch(() => {});
  await deleteDoc(doc(db, 'clubs', cid, 'users', S.uid)).catch(() => {});
  await deleteDoc(doc(db, 'clubs', cid, 'requests', S.uid)).catch(() => {});
}
function openLeave() {
  sheet('<h2>탈퇴</h2><p class="muted">투표·골 기록·건의 등 내가 남긴 기록이 지워져요. 회비 장부의 입금 기록은 팀 회계라서 남아요.</p>' +
    '<button class="bigbtn" id="lv1">이 팀에서만 나가기</button>' +
    '<button class="sugbtn" id="lv2" style="margin-top:8px">A-KICK 계정 완전히 삭제 (모든 팀)</button>' +
    '<div class="srow"><button id="lvx">취소</button></div>', (el) => {
    el.querySelector('#lvx').onclick = () => (el.hidden = true);
    el.querySelector('#lv1').onclick = async () => {
      if (S.owner) return toast('관리자는 팀을 나갈 수 없어요. 팀을 삭제하려면 "다른 팀 보기"에서 삭제하세요');
      if (!confirm(clubName() + '에서 나갈까요? 다시 들어오려면 가입 신청을 새로 해야 해요.')) return;
      el.hidden = true; view('<div class="center">정리하는 중...</div>');
      await wipeMine(S.cid); delete (S.myClubs || {})[S.cid]; await saveMyClubs();
      try { sessionStorage.setItem('akick_msg', '팀에서 나갔어요'); } catch (e) {} location.replace('./');
    };
    el.querySelector('#lv2').onclick = async () => {
      const own = (await getDocs(query(collection(db, 'clubs'), where('owner', '==', S.uid))).catch(() => ({ docs: [] }))).docs;
      if (own.length) return toast('관리자인 팀(' + own.map((d) => d.data().name).join(', ') + ')을 먼저 삭제해야 계정을 지울 수 있어요', 6000);
      const t = prompt('계정을 완전히 삭제해요. 모든 팀에서 나가고 되돌릴 수 없어요.\n정말 삭제하려면 "삭제"라고 입력하세요');
      if ((t || '').trim() !== '삭제') return;
      el.hidden = true; view('<div class="center">삭제하는 중... (몇 초 걸려요)</div>');
      const me = await getDoc(doc(db, 'me', S.uid)).catch(() => null);
      const cids = Object.keys((me && me.exists() && me.data().clubs) || {}); if (S.cid && cids.indexOf(S.cid) < 0) cids.push(S.cid);
      for (const c of cids) await wipeMine(c);
      await deleteDoc(doc(db, 'me', S.uid)).catch(() => {}); await deleteDoc(doc(db, 'ach', S.uid)).catch(() => {});
      const rf = await getDocs(query(collection(db, 'refs'), where('uid', '==', S.uid))).catch(() => null); if (rf) for (const d of rf.docs) await deleteDoc(d.ref).catch(() => {});
      try { await deleteUser(auth.currentUser); }
      catch (e) {                                     // 오래전에 로그인했으면 한 번 더 로그인해야 지워짐
        try { await signInWithPopup(auth, new GoogleAuthProvider()); await deleteUser(auth.currentUser); }
        catch (e2) { toast('기록은 지웠지만 로그인 정보 삭제는 실패했어요. 다시 로그인 후 한 번 더 해주세요', 7000); return; }
      }
      try { sessionStorage.setItem('akick_msg', '계정을 삭제했어요. 그동안 고마웠어요'); } catch (e) {} await signOut(auth).catch(() => {}); location.replace('./');
    };
  });
}
async function leaveList(cid, name) {
  if (!confirm('"' + name + '"을 내 목록에서 뺄까요?\n팀 링크로 다시 들어오면 다시 보여요.')) return;
  delete S.myClubs[cid]; await saveMyClubs(); renderHome();
}
async function deleteClub(cid, name) {
  const t = prompt('⚠️ "' + name + '" 팀을 완전히 삭제해요.\n회원·거래·투표·경기기록이 모두 사라지고 되돌릴 수 없어요.\n\n정말 삭제하려면 팀 이름을 그대로 입력하세요.');
  if (t === null) return;
  if (t.trim() !== name) return toast('팀 이름이 달라서 삭제하지 않았어요');
  view('<div class="center">삭제하는 중... (몇 초 걸려요)</div>');
  try {
    for (const c of ['members', 'games', 'tx', 'config', 'private', 'pub', 'votes', 'goals', 'polls', 'pollvotes', 'anonvotes', 'anonmark', 'videos', 'vcomments', 'push', 'profiles', 'rps', 'wx', 'suggest', 'requests', 'claims', 'users']) {
      const q = await getDocs(collection(db, 'clubs', cid, c));
      for (let i = 0; i < q.docs.length; i += 400) { const b = writeBatch(db); q.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
    }
    await deleteDoc(doc(db, 'clubs', cid));
    delete S.myClubs[cid]; await saveMyClubs(); toast('"' + name + '" 팀을 삭제했어요');
  } catch (e) { toast('삭제 실패: ' + e.message); }
  renderHome();
}
async function showErrs() {
  const q = await getDocs(query(collection(db, 'errlog'), orderBy('at', 'desc'), limit(50))).catch((e) => { toast('못 불러왔어요: ' + e.message); return null; });
  if (!q) return;
  const rows = q.docs.map((d) => d.data()), txt = rows.map((x) => new Date(x.at).toLocaleString('ko-KR') + ' [' + x.ver + '/' + x.page + '/' + x.cid + '] ' + x.msg + '\n' + (x.stack || '').split('\n').slice(0, 3).join('\n') + '\n' + x.ua).join('\n\n');
  sheet('<h2>오류 기록 ' + rows.length + '건</h2><pre class="errs">' + esc(txt || '오류 없음 👍') + '</pre><div class="srow"><button id="ex">닫기</button><button class="pri" id="ec">전체 복사</button></div>', (el) => {
    el.querySelector('#ex').onclick = () => (el.hidden = true); el.querySelector('#ec').onclick = () => copy(txt, '복사했어요. Claude에게 붙여넣어 주세요');
  });
}
async function renderHome() {
  let owned = [];
  try { owned = (await getDocs(query(collection(db, 'clubs'), where('owner', '==', S.uid)))).docs.map((d) => [d.id, d.data().name]); } catch (e) {}
  const all = {}; Object.entries(S.myClubs || {}).forEach(([k, v]) => (all[k] = v)); owned.forEach(([k, v]) => (all[k] = v));
  const ids = Object.keys(all);
  view('<header class="hero"><div class="hrow"><b>A-KICK</b><button class="who lk" id="out">로그아웃</button></div><h1>내 팀</h1><p>' + esc(S.email) + '</p></header><main class="pad lift">' +
    (ids.length ? '<section class="card"><div class="clist">' + ids.map((k) => { const own = owned.some((o) => o[0] === k);
      return '<div class="crow"><a href="./?c=' + esc(k) + '">' + esc(all[k]) + (own ? '<em>관리자</em>' : '') + '</a><button class="cdel" data-cdel="' + esc(k) + '" data-own="' + (own ? 1 : 0) + '">' + (own ? '삭제' : '빼기') + '</button></div>'; }).join('') + '</div></section>'
      : '<section class="card soft"><h2>아직 들어간 팀이 없어요</h2><p class="muted">회원이라면 관리자에게 받은 <b>팀 링크</b>로 들어오세요.</p></section>') +
    '<section class="card"><h2>내가 관리자예요</h2><p class="muted">새 팀을 만들면 회비·참석·팀 편성을 관리할 수 있어요. 만들면 4단계 설정(운동·요일·회비·회원)이 바로 시작돼요.</p>' +
    '<div class="newc"><input id="cn" placeholder="팀 이름 (예: 대구FC)" maxlength="20"><button id="mk">팀 만들기</button></div>' +
    '<label class="rcl">추천 코드 <small>(선택 · 받은 링크로 들어왔으면 자동으로 채워져요)</small><input id="rc" maxlength="12" placeholder="예: K7P2QX" value="' + esc(refSaved()) + '"></label></section>' + DEMO_BTN + LEGAL + '</main>');
  bindDemoBtn();
  $('#out').onclick = () => signOut(auth);
  if (S.email === OPERATOR) { $('main').insertAdjacentHTML('beforeend', '<button class="link" id="ops">운영자: 오류 기록 보기</button><button class="link" id="opf">운영자: 개발자 건의 보기</button>'); $('#ops').onclick = showErrs; $('#opf').onclick = showFeedback; }
  document.querySelectorAll('[data-cdel]').forEach((b) => (b.onclick = () => (b.dataset.own === '1' ? deleteClub(b.dataset.cdel, all[b.dataset.cdel]) : leaveList(b.dataset.cdel, all[b.dataset.cdel]))));
  $('#mk').onclick = async () => {
    const name = $('#cn').value.trim(); if (!name) return toast('팀 이름을 넣어주세요');
    const cid = Math.random().toString(36).slice(2, 6) + Date.now().toString(36).slice(-4);
    const data = { name, owner: S.uid, created: new Date().toISOString() }, rc = $('#rc').value.trim().toUpperCase();
    if (rc) {
      const r = await getDoc(doc(db, 'refs', rc)).catch(() => null);
      if (!r || !r.exists()) return toast('없는 추천 코드예요. 비우거나 다시 확인해 주세요');
      if (r.data().uid === S.uid) return toast('내 추천 코드는 내 팀에 쓸 수 없어요');
      data.refBy = rc;
    }
    try {
      await setDoc(doc(db, 'clubs', cid), data); try { localStorage.removeItem('akick_ref'); } catch (e) {}
      S.myClubs[cid] = name; await setDoc(doc(db, 'me', S.uid), { clubs: S.myClubs, last: cid }, { merge: true });
      location.href = 'admin.html?c=' + cid;
    } catch (e) { toast('만들기 실패: ' + e.message); }
  };
}

function game() { return S.pub && S.pub.games && S.pub.games[0]; }
function watchVotes() {
  if (S.me && !S.pollSub) {
    S.polls = []; S.pvotes = []; S.avotes = []; S.ah = {};
    S.pollSub = [onSnapshot(collection(db, 'clubs', S.cid, 'polls'), (q) => { S.polls = q.docs.map((d) => Object.assign({ id: d.id }, d.data())); Promise.all(S.polls.filter((x) => x.anon).map((x) => anonKey(x.id))).then(() => { S.pollsLoaded = true; render(); }); }, () => {}),
      onSnapshot(collection(db, 'clubs', S.cid, 'pollvotes'), (q) => { S.pvotes = q.docs.map((d) => Object.assign({ id: d.id }, d.data())); S.pvLoaded = true; render(); }, () => {}),
      onSnapshot(collection(db, 'clubs', S.cid, 'anonvotes'), (q) => { S.avotes = q.docs.map((d) => Object.assign({ id: d.id }, d.data())); render(); }, () => {})];
  }
  if (S.me && !S.goalSub) S.goalSub = onSnapshot(collection(db, 'clubs', S.cid, 'goals'), (q) => { S.goals = q.docs.map((d) => Object.assign({ id: d.id }, d.data())); render(); }, () => {});
  if (S.me && !S.profSub) S.profSub = onSnapshot(collection(db, 'clubs', S.cid, 'profiles'), (q) => { S.profs = {}; q.docs.forEach((d) => (S.profs[d.id] = d.data())); render(); }, () => {});
  if (S.me && !S.vcSub) S.vcSub = onSnapshot(collection(db, 'clubs', S.cid, 'vcomments'), (q) => { S.vcAll = q.docs.map((d) => d.data()); if (!$('#vov')) render(); }, () => {});
  if (S.me && !S.vidSub) S.vidSub = onSnapshot(collection(db, 'clubs', S.cid, 'videos'), (q) => {
    S.videos = q.docs.map((d) => Object.assign({ id: d.id }, d.data())); render();
    const want = new URLSearchParams(location.search).get('v');                 // 카톡으로 받은 영상 링크(?v=)면 바로 열기
    if (want && !S.vOpened && S.videos.some((x) => x.id === want)) { S.vOpened = true; openVideo(want); }
  }, () => {});
  const g = game(); if (!g || !S.me || S.voteGid === g.id) return;
  if (S.voteSub) S.voteSub();
  S.voteGid = g.id;
  S.voteSub = onSnapshot(query(collection(db, 'clubs', S.cid, 'votes'), where('gid', '==', g.id)), (snap) => {
    S.votes = {}; snap.docs.forEach((d) => { const x = d.data(); S.votes[x.name] = x; }); render();
  }, () => {});
}
/** 관리자가 마지막으로 반영한 명단 + 그 뒤에 들어온 투표 */
function attendOf(g) {
  const base = new Set(g.attend || []), since = Date.parse(S.pub.updatedAt || 0) || 0;
  Object.values(S.votes).forEach((v) => { if ((v.at || 0) > since || (S.me && v.name === S.me.name && v.uid === S.uid)) { if (v.v === '참석') base.add(v.name); else base.delete(v.name); } });
  return [...base];
}
/* ---- 투표 마감 카운트다운 ---- */
function dlTs(g) { return g.deadline ? Date.parse(g.deadline) : Date.parse(g.date + 'T' + (g.time || '23:59')); }
function left(ms) { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), p = (n) => String(n).padStart(2, '0');
  return (d ? d + '일 ' : '') + p(Math.floor(s % 86400 / 3600)) + ':' + p(Math.floor(s % 3600 / 60)) + ':' + p(s % 60); }
function cdHTML(g) { return cdAt(dlTs(g)); }
/** 마감 카운트다운 (참석 투표·투표·공지 공용) */
function cdAt(t) {
  if (Date.now() >= t) return '<div class="cd done"><span>투표</span><b>마감됐어요</b></div>';
  const d = new Date(t), dd = ymd(d);
  return '<div class="cd" data-cd="' + t + '"><span>투표 마감까지<small>' + md(dd) + '(' + day(dd) + ') ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' 마감</small></span><b>' + left(t - Date.now()) + '</b></div>';
}
setInterval(() => document.querySelectorAll('[data-cd]').forEach((el) => {
  const ms = +el.dataset.cd - Date.now();
  if (ms <= 0) { el.removeAttribute('data-cd'); render(); return; }
  el.querySelector('b').textContent = left(ms);
}), 1000);
function locked(g) {
  const now = Date.now(), dl = g.deadline ? Date.parse(g.deadline) : Date.parse(g.date + 'T' + (g.time || '23:59'));
  return now > dl;
}
const clubName = () => (S.pub && S.pub.club) || (S.club && S.club.name) || '';
const adminBtn = () => (S.owner ? '<a class="adm" href="admin.html?c=' + esc(S.cid) + '">관리자</a>' : '');
const HOME = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>';
const heroTop = () => '<div class="hrow"><button class="cname" data-gohome>' + HOME + '<b>' + esc(clubName()) + '</b></button><span class="who">' + (S.me ? lvPill(lvOfMid(S.me.mid)) + esc(S.me.name) + ' 님' : '') + adminBtn() + '</span></div>';

/* ---------------- 3. 화면 ---------------- */
function render() {
  if (!S.pub) return void view('<header class="hero">' + heroTop() + '<h1>아직 준비 중이에요</h1><p>' + (S.owner ? '관리자 페이지에서 회원을 등록하면 여기에 떠요.' : '관리자가 준비하면 여기에 떠요.') + '</p></header><main class="pad lift">' +
    (S.owner ? '<a class="bigbtn" href="admin.html?c=' + esc(S.cid) + '">관리자 페이지 열기</a>' : '') + '<button class="link" id="home">다른 팀 보기</button> <button class="link" id="out">로그아웃</button></main>'), bindCommon();
  const members = S.pub.members || [];
  if (S.me && !S.owner && !members.some((m) => m.id === S.me.mid)) return void view('<header class="hero">' + heroTop() + '<h1>승인됐어요! 🎉</h1><p>명단을 불러오는 중이에요. 잠시 후 자동으로 열려요.</p></header><main class="pad lift"></main>');
  if (!S.me || !members.some((m) => m.id === S.me.mid)) return renderPick(members);
  const body = S.tab === 'home' ? homeHTML() : S.tab === 'week' ? weekHTML() : S.tab === 'dues' ? duesHTML() : S.tab === 'bank' ? bankHTML() : recHTML();
  const bc = badgeCounts();
  const tab = (k, l, ic) => '<button class="tab' + (S.tab === k ? ' on' : '') + '" data-t="' + k + '">' + ic + '<span>' + l + '</span>' + (bc[k] ? '<i class="tb">' + (bc[k] > 9 ? '9+' : bc[k]) + '</i>' : '') + '</button>';
  view(body + '<nav class="tabs" aria-label="메뉴">' +
    tab('home', '홈', '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>') +
    tab('week', '이번 주', '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7l3 2-1 4h-4l-1-4z"/></svg>') +
    tab('dues', '회비', '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>') +
    tab('bank', '통장', '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/></svg>') +
    tab('rec', '경기기록', '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>') + '</nav>');
  if (S.demo) { $('#app').insertAdjacentHTML('afterbegin', '<div class="demob"><span>👀 <b>체험 팀</b> · 눌러봐도 저장되지 않아요</span><button id="demox">나가기</button></div>'); $('#demox').onclick = exitDemo; }
  document.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.t; if (S.tab === 'week' && teamKey()) markSeen(teamKey()); render(); window.scrollTo(0, 0); }));
  document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.go; render(); window.scrollTo(0, 0); }));
  document.querySelectorAll('[data-vote]').forEach((b) => (b.onclick = () => vote(b.dataset.vote)));
  const acc = $('#acc'); if (acc) acc.onclick = () => copy(accNo(), '계좌번호를 복사했어요');
  const ch = $('#change'); if (ch) ch.onclick = async () => { S.me = null; render(); };
  document.querySelectorAll('[data-gadd]').forEach((b) => (b.onclick = () => openGoal(b.dataset.gadd)));
  document.querySelectorAll('[data-gdel]').forEach((b) => (b.onclick = async () => { if (confirm('이 골 기록을 지울까요?')) await deleteDoc(CD('goals', b.dataset.gdel)).catch((e) => toast('삭제 실패: ' + e.message)); }));
  document.querySelectorAll('[data-sort]').forEach((h) => (h.onclick = () => { const [tb, k] = h.dataset.sort.split(':'), st = S.sort[tb] || {}; S.sort[tb] = st.k === k ? { k, d: ((st.d || 0) + 1) % 3 } : { k, d: 1 }; render(); }));
  document.querySelectorAll('[data-poll]').forEach((b) => (b.onclick = () => openPoll(b.dataset.poll)));
  const pe = $('#pedit'); if (pe) pe.onclick = openProfile;
  document.querySelectorAll('[data-vid]').forEach((b) => (b.onclick = () => openVideo(b.dataset.vid)));
  const sg = $('#sug'); if (sg) sg.onclick = openSuggest;
  const aa = $('#achall'); if (aa) aa.onclick = openAch;
  const lva = $('#lvall'); if (lva) lva.onclick = openLevel;
  const lvg = $('#lvguide'); if (lvg) lvg.onclick = openLvGuide;
  const rg = $('#rpsgo'); if (rg) rg.onclick = openRps;
  rpsWatch(); wxWatch(game());
  if (S.tab === 'bank') achFlag('bank');
  achSoon();
  autoPopup();
  const sy = $('#sym'); if (sy) sy.onchange = (e) => { S.sym = e.target.value; render(); };
  const pw = $('#pw'); if (pw) pw.onclick = () => { S.wk = (S.wk || 0) - 1; render(); };
  const nw = $('#nw'); if (nw) nw.onclick = () => { S.wk = (S.wk || 0) + 1; render(); };
  bindCommon();
}
function bindCommon() {
  if (S.demo) { ['#home', '#out', '#leave'].forEach((k) => { const b = $(k); if (b) b.onclick = exitDemo; }); const n = $('#ntf'); if (n) n.onclick = () => toast(DEMO_MSG); }
  const h = $('#home'); if (h && !S.demo) h.onclick = () => { S.subs.forEach((f) => f()); S.subs = []; S.cid = ''; history.replaceState(null, '', './'); renderHome(); };
  const o = $('#out'); if (o && !S.demo) o.onclick = () => signOut(auth);
  const lv = $('#leave'); if (lv && !S.demo) lv.onclick = openLeave;
  const nf = $('#ntf'); if (nf && !S.demo) nf.onclick = openNotify;
  const dv = $('#dev'); if (dv) dv.onclick = openDev;
  const dn = $('#dona'); if (dn) dn.onclick = openDonate;
  const it = $('#inst'); if (it) it.onclick = async () => { installEv.prompt(); const ch = await installEv.userChoice.catch(() => null); if (ch && ch.outcome === 'accepted') achFlag('inst'); installEv = null; render(); };
  const ni = $('#noinst'); if (ni) ni.onclick = () => { try { localStorage.setItem('akick_noinstall', '1'); } catch (e) {} render(); };
  document.querySelectorAll('[data-gohome]').forEach((b) => (b.onclick = () => { S.tab = 'home'; S.wk = 0; render(); window.scrollTo(0, 0); }));
}
function accNo() { const a = (S.pub.dues && S.pub.dues.account) || ''; const n = (a.match(/[\d-]{6,}/) || [''])[0]; return n || a; }
function renderPick(members) {
  view('<header class="hero">' + heroTop() + '<h1>관리자님 이름을 골라주세요</h1><p>관리자도 회원으로 투표·경기기록에 참여하려면 한 번 골라요.</p></header>' +
    '<main class="pad lift"><section class="card"><div class="pick">' + members.map((m) => '<button data-pick="' + esc(m.id) + '">' + esc(m.name) + '</button>').join('') + '</div></section>' +
    '<p class="muted center-t">다른 회원은 링크로 가입 신청 → 관리자 승인으로 들어와요.</p><button class="link" id="home">다른 팀 보기</button> <button class="link" id="out">로그아웃</button></main>');
  document.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = async () => {
    const m = members.find((x) => x.id === b.dataset.pick);
    if (!confirm(m.name + ' 님이 맞나요?')) return;
    const me = { mid: m.id, name: m.name, at: Date.now() };
    // 관리자 본인만 여기서 직접 연결 (다른 회원은 가입 신청 → 승인)
    const wb = writeBatch(db);
    wb.set(CD('claims', m.id), { uid: S.uid, email: S.email, name: m.name, at: Date.now() });
    wb.set(CD('users', S.uid), me);
    try { await wb.commit(); } catch (e) { return toast('저장 실패: ' + e.message); }
    S.me = me; S.voteGid = ''; watchVotes(); render();
  }));
  bindCommon();
}
async function vote(v) {
  const g = game(); if (!g || locked(g)) return toast('투표가 마감됐어요. 관리자에게 말씀해 주세요.');
  const data = { gid: g.id, mid: S.me.mid, name: S.me.name, v, uid: S.uid, at: Date.now() };
  S.votes[S.me.name] = data; achAdd('vg', g.id, 500); if (Date.now() <= dlTs(g) - 864e5) achAdd('early', g.id, 500); render();
  try { await setDoc(CD('votes', g.id + '__' + S.me.mid), data); toast(v === '참석' ? '참석으로 표시했어요 ⚽' : '불참으로 표시했어요'); }
  catch (e) { toast('저장 실패: 다시 눌러주세요'); }
}

const minN = () => (S.pub.perSide || 5) * 2;
function sideTxt(total) { const p = S.pub.perSide || 5, mx = S.pub.maxSide || p + 1; if (total < p * 2) return (p * 2 - total) + '명 더 필요'; const k = Math.min(Math.floor(total / 2), mx); return k + '대' + k + ' 가능'; }
const FORM = { 3: [[8, 50], [30, 30], [30, 70]], 4: [[8, 50], [22, 50], [38, 28], [38, 72]], 5: [[8, 50], [20, 50], [31, 22], [31, 78], [43, 50]],
  6: [[8, 50], [19, 28], [19, 72], [30, 50], [43, 25], [43, 75]], 7: [[8, 50], [19, 28], [19, 72], [30, 22], [30, 78], [43, 36], [43, 64]],
  8: [[6, 50], [17, 22], [17, 50], [17, 78], [30, 25], [30, 50], [30, 75], [43, 50]],
  9: [[6, 50], [17, 22], [17, 50], [17, 78], [30, 25], [30, 50], [30, 75], [43, 35], [43, 65]],
  10: [[6, 50], [16, 15], [16, 38], [16, 62], [16, 85], [29, 25], [29, 50], [29, 75], [43, 35], [43, 65]],
  11: [[6, 50], [16, 15], [16, 38], [16, 62], [16, 85], [30, 15], [30, 38], [30, 62], [30, 85], [43, 35], [43, 65]] };
/** 포메이션 자리는 그대로, 사람만 랜덤 (관리자 화면과 같은 순서) */
function side(team, bottom, cls, seed) {
  const ord = window.Core.order(team, seed), f = FORM[Math.min(11, Math.max(3, ord.length))];
  return ord.map((n, i) => {
    const p = f[i] || [46, 15 + i * 10], top = bottom ? 100 - p[0] : p[0];
    return '<div class="ptok" style="left:' + p[1] + '%;top:' + top + '%"><span class="dot ' + cls + (n === S.me.name ? ' me' : '') + '">' + ((profOf(n) || {}).num || '') + '</span><span class="pn">' + lvPill(lvOfName(n)) + esc(n) + (i === 0 ? ' <i>GK</i>' : '') + '</span></div>';
  }).join('');
}
function weekDays() {
  const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + (S.wk || 0) * 7);
  return [...Array(7)].map((_, i) => { const d = new Date(x); d.setDate(x.getDate() + i); return ymd(d); });
}
function txChip(t) {
  return '<div class="txc' + (t.off ? ' off' : '') + '"><div class="txt"><b>' + esc(t.who) + '</b><span class="' + (t.io ? 'p' : 'n') + '">' + (t.io ? '+' : '−') + won(t.amt) + '</span></div><small>' + esc(t.off ? '장부 제외' : t.what + (t.pend ? ' · 통장 확인 전' : '')) + '</small></div>';
}
function weekTxHTML() {
  const days = weekDays(), all = S.pub.txs || [], tday = ymd(new Date());
  let n = 0, inc = 0, out = 0;
  const rows = days.map((d, i) => {
    const ts = all.filter((t) => t.dt.substr(0, 10) === d); n += ts.length;
    ts.forEach((t) => { if (!t.off) { if (t.io) inc += t.amt; else out += t.amt; } });
    if (!ts.length) return '';
    return '<div class="drow"><div class="dl"><span>' + '월화수목금토일'[i] + '</span><b' + (d === tday ? ' class="td"' : '') + '>' + md(d) + '</b></div><div class="dtx">' + ts.map(txChip).join('') + '</div></div>';
  }).join('');
  return '<section class="card"><div class="h2row"><h2>통장 입출금</h2><div class="wnav"><button id="pw" aria-label="지난주">‹</button><span>' + md(days[0]) + '–' + md(days[6]) + '</span><button id="nw" aria-label="다음주">›</button></div></div>' +
    (n ? '<div class="wsum"><span>들어온 돈 <b class="p">+' + won(inc) + '</b></span><span>나간 돈 <b class="n">−' + won(out) + '</b></span></div>' + rows : '<p class="muted">이 주에는 입출금이 없어요</p>') + '</section>';
}
function bankHTML() {
  const all = (S.pub.txs || []).slice().reverse(), byM = {};
  all.forEach((t) => (byM[t.dt.substr(0, 7)] = byM[t.dt.substr(0, 7)] || []).push(t));
  const bal = all.length ? all[0].bal : 0;
  return '<header class="hero">' + heroTop() + '<h1>통장 잔액 ' + won(bal) + '원</h1><p>모임통장 입출금 전체 · 관리자가 올린 거래내역 기준</p></header><main class="pad lift">' +
    Object.keys(byM).map((ym) => '<section class="card"><h2>' + ym.substr(0, 4) + '년 ' + mon(ym) + '</h2><div class="blist">' + byM[ym].map((t) =>
      '<div class="brow' + (t.off ? ' off' : '') + '"><span class="bd">' + md(t.dt.substr(0, 10)) + '</span><span class="bw"><b>' + esc(t.who) + '</b><small>' + esc(t.off ? '장부 제외' : t.what + (t.pend ? ' · 통장 확인 전' : '')) + '</small></span><span class="ba"><b class="' + (t.io ? 'p' : 'n') + '">' + (t.io ? '+' : '−') + won(t.amt) + '</b><small>' + won(t.bal) + '</small></span></div>').join('') + '</div></section>').join('') +
    (all.length ? '' : '<section class="card soft"><p class="muted">아직 올라온 거래가 없어요</p></section>') + '</main>';
}
function weekHTML() {
  const g = game();
  if (!g) return '<header class="hero">' + heroTop() + '<h1>다음 경기 준비 중</h1><p>경기가 정해지면 여기에 떠요.</p></header><main class="pad lift">' + weekTxHTML() + '<button class="link" id="home">다른 팀 보기</button></main>';
  const att = attendOf(g), total = att.length + (g.guests || []).length, mine = S.votes[S.me.name], amIn = att.indexOf(S.me.name) >= 0;
  const lk = locked(g), dlTxt = g.deadline ? md(g.deadline.substr(0, 10)) + ' (' + day(g.deadline.substr(0, 10)) + ') ' + g.deadline.substr(11, 5) : '경기 시작 전';
  const status = sideTxt(total);
  const teams = (g.teams || []).map((t) => t.split('|'));
  const myTeam = teams.findIndex((t) => t.indexOf(S.me.name) >= 0);
  return '<header class="hero">' + heroTop() + '' +
    '<h1>' + md(g.date) + ' (' + day(g.date) + ') ' + esc(g.time) + '</h1><p>' + esc(S.pub.place || '') + ' · 투표 마감 ' + dlTxt + (lk ? ' (마감됨)' : '') + '</p></header>' +
    '<main class="pad lift">' +
    '<section class="card"><h2>이번 주 참석할까요?</h2>' + wxLine(g) + cdHTML(g) + '<div class="vote">' +
    '<button data-vote="참석" class="' + (amIn && mine && mine.v === '참석' ? 'on' : '') + '"' + (lk ? ' disabled' : '') + '>참석</button>' +
    '<button data-vote="불참" class="' + (!amIn && mine && mine.v === '불참' ? 'on no' : '') + '"' + (lk ? ' disabled' : '') + '>불참</button></div>' +
    '<div class="cnt"><span>지금 <b>' + total + '명</b> · 회원 ' + att.length + ' + 게스트 ' + (g.guests || []).length + '</span><em class="' + (total >= minN() ? 'ok' : 'low') + '">' + status + '</em></div>' +
    '<div class="names">' + att.map((n) => '<span class="' + (n === S.me.name ? 'me' : '') + '">' + lvPill(lvOfName(n)) + esc(n) + '</span>').join('') + ((g.guests || []).length ? '<span class="g">게스트 ' + g.guests.length + '명</span>' : '') + '</div></section>' +
    (teams.length >= 2 ? '<section class="card"><div class="h2row"><h2>팀 편성</h2>' + (myTeam >= 0 ? '<span class="myteam t' + myTeam + '">나는 ' + 'ABC'[myTeam] + '팀</span>' : '') + '</div>' +
      '<div class="tl"><b class="tb">B팀 ' + teams[1].length + '명</b></div><div class="vpitch"><span class="vm"></span><span class="vc"></span><span class="vbT"></span><span class="vbB"></span>' +
      side(teams[1], false, 'b', g.id + ':1') + side(teams[0], true, 'a', g.id + ':0') + '</div><div class="tl"><b class="ta">A팀 ' + teams[0].length + '명</b></div>' +
      (teams[2] ? '<div class="muted">C팀 (대기): ' + esc(teams[2].join(', ')) + '</div>' : '') + '</section>'
      : '<section class="card soft"><h2>팀 편성</h2><p class="muted">관리자가 팀을 짜면 여기에 경기장 그림으로 보여요.</p></section>') + lastRecHTML() + weekTxHTML() +
    '<p class="muted center-t">이름을 잘못 골랐다면 관리자에게 연결 해제를 부탁하세요.</p><div class="links"><button class="link" id="home">다른 팀 보기</button><button class="link" id="out">로그아웃</button></div></main>';
}
function myStat() { return window.Core.statTable(played(), S.goals || [], '', [S.me.name]).find((x) => x.name === S.me.name); }
function homeHTML() {
  const g = game(), d = S.pub.dues, txs = S.pub.txs || [], bal = txs.length ? txs[txs.length - 1].bal : 0;
  const r = (S.pub.records || {})[S.me.name] || { total: 0, came: 0 }, rate = r.total ? Math.round(r.came / r.total * 100) : 0;
  const paid = d.paid.indexOf(S.me.name) >= 0, due = paid || d.unpaid.indexOf(S.me.name) >= 0;
  let gcard = '<section class="card soft"><span class="lbl">다음 경기</span><h2 style="margin-top:6px">아직 정해지지 않았어요</h2></section>';
  if (g) {
    const att = attendOf(g), total = att.length + (g.guests || []).length, mine = S.votes[S.me.name], amIn = att.indexOf(S.me.name) >= 0, lk = locked(g);
    const st = amIn ? ['in', mine && mine.v === '참석' ? '참석' : '참석 (관리자 체크)'] : mine && mine.v === '불참' ? ['out', '불참'] : ['none', '아직 응답 안 함'];
    gcard = '<section class="card nextg"><div class="h2row"><span class="lbl">다음 경기</span><span class="mystat ' + st[0] + '">나: ' + st[1] + '</span></div>' +
      '<div class="ng-date">' + md(g.date) + ' <small>(' + day(g.date) + ')</small> ' + esc(g.time) + '</div>' +
      '<div class="ng-sub">' + esc(S.pub.place || '') + (S.pub.place ? ' · ' : '') + '지금 <b>' + total + '명</b> · ' + sideTxt(total) + '</div>' + wxLine(g) +
      cdHTML(g) +
      (lk ? '' : '<div class="vote sm"><button data-vote="참석" class="' + (amIn && mine && mine.v === '참석' ? 'on' : '') + '">참석</button><button data-vote="불참" class="' + (st[0] === 'out' ? 'on no' : '') + '">불참</button></div>') +
      '<button class="more" data-go="week">참석 명단 · 팀 편성 보기 ›</button></section>';
  }
  const tile = (go, lbl, val, sub, cls) => '<button class="tile ' + (cls || '') + '" data-go="' + go + '"><span>' + lbl + '</span><b>' + val + '</b><small>' + sub + '</small></button>';
  const recent = txs.slice(-3).reverse();
  return '<header class="hero home">' + heroTop() + '<h1>안녕하세요, ' + esc(S.me.name) + ' 님 👋</h1><p>' + esc(clubName()) + '에 오신 걸 환영해요</p></header>' +
    '<main class="pad lift">' + gcard + lvCard() + pollsCard() + vidsHome() + achCard() + installCard() +
    '<div class="tiles">' +
    tile('dues', mon(d.ym) + ' 회비', !due ? '대상 아님' : paid ? '납부 완료' : '미납', won(d.fee) + '원 · 납부 ' + d.paid.length + '/' + (d.paid.length + d.unpaid.length) + '명', !due ? '' : paid ? 'ok' : 'bad') +
    tile('bank', '통장 잔액', won(bal) + '원', '입출금 전부 공개') +
    tile('rec', '내 기록', (myStat().g) + '골 ' + (myStat().a) + '도움', '참석 ' + r.came + '회 · ' + rate + '%') +
    tile('week', '팀 편성', g && (g.teams || []).length >= 2 ? '공개됨' : '준비 중', g ? md(g.date) + ' 경기' : '-') + '</div>' +
    (recent.length ? '<section class="card"><div class="h2row"><h2>최근 입출금</h2><button class="more inl" data-go="bank">전체 ›</button></div><div class="blist">' + recent.map((t) =>
      '<div class="brow' + (t.off ? ' off' : '') + '"><span class="bd">' + md(t.dt.substr(0, 10)) + '</span><span class="bw"><b>' + esc(t.who) + '</b><small>' + esc(t.off ? '장부 제외' : t.what + (t.pend ? ' · 통장 확인 전' : '')) + '</small></span><span class="ba"><b class="' + (t.io ? 'p' : 'n') + '">' + (t.io ? '+' : '−') + won(t.amt) + '</b></span></div>').join('') + '</div></section>' : '') +
    '<button class="sugbtn" id="sug">💬 우리 팀 총무에게 건의하기</button>' +
    (S.owner ? '<a class="bigbtn" href="admin.html?c=' + esc(S.cid) + '">관리자 페이지</a>' : '') +
    '<div class="links"><button class="link" id="home">다른 팀 보기</button><button class="link" id="out">로그아웃</button><button class="link" id="leave">탈퇴</button><button class="link" id="ntf">🔔 알림</button></div><div class="links"><button class="link" id="dev">💌 앱 개발자에게 건의</button><button class="link" id="dona">☕ A-KICK 후원</button></div><div class="links"><a class="link" href="privacy.html">개인정보처리방침</a><a class="link" href="terms.html">이용약관</a></div></main>';
}
function duesHTML() {
  const d = S.pub.dues, paid = d.paid.indexOf(S.me.name) >= 0, due = paid || d.unpaid.indexOf(S.me.name) >= 0;
  const L = S.pub.ledger || [];
  return '<header class="hero">' + heroTop() + '<h1>' + mon(d.ym) + ' 회비 ' + won(d.fee) + '원</h1><p>' + (+d.ym.substr(5, 2) - 1 || 12) + '/' + d.dueDay + '까지 · 납부 ' + d.paid.length + '/' + (d.paid.length + d.unpaid.length) + '명</p></header>' +
    '<main class="pad lift"><section class="card acct"><span>모임통장</span><div class="acrow"><b>' + esc(d.account || '관리자가 아직 안 넣었어요') + '</b>' + (d.account ? '<button id="acc">복사</button>' : '') + '</div></section>' +
    '<section class="card">' +
    (!due ? '<div class="st gray">' + mon(d.ym) + '은 회비 대상이 아니에요</div>' : paid ? '<div class="st ok">' + mon(d.ym) + ' 회비 납부 완료 ✓</div>' :
      '<div class="st bad"><b>' + mon(d.ym) + ' 회비 아직 안 냈어요</b><span>' + won(d.fee) + '원</span></div>') +
    '</section><section class="card"><h2>납부 현황</h2><div class="names">' + d.paid.map((n) => '<span class="ok">' + esc(n) + '</span>').join('') + d.unpaid.map((n) => '<span class="no">' + esc(n) + '</span>').join('') + '</div>' +
    '<div class="muted" style="margin-top:8px">초록 = 납부 · 회색 = 아직</div></section>' +
    (L.length ? '<section class="card"><h2>모임통장 정산</h2><table>' + '<tr><th></th>' + L.map((x) => '<th>' + mon(x.ym) + '</th>').join('') + '</tr>' +
      '<tr><td>회비</td>' + L.map((x) => '<td>' + won(x.fee) + '</td>').join('') + '</tr><tr><td>게스트비</td>' + L.map((x) => '<td>' + won(x.guest) + '</td>').join('') + '</tr>' +
      '<tr><td>구장비</td>' + L.map((x) => '<td>' + (x.field ? '−' : '') + won(x.field) + '</td>').join('') + '</tr><tr><td>기타</td>' + L.map((x) => '<td>' + (x.etcIn - x.etcOut < 0 ? '−' : '') + won(x.etcIn - x.etcOut) + '</td>').join('') + '</tr>' +
      '<tr class="tot"><td>남은 돈</td>' + L.map((x) => '<td class="' + (x.net >= 0 ? 'p' : 'n') + '">' + (x.net >= 0 ? '+' : '−') + won(x.net) + '</td>').join('') + '</tr>' +
      '<tr><td>월말 잔액</td>' + L.map((x) => '<td>' + won(x.end) + '</td>').join('') + '</tr></table><div class="muted" style="margin-top:8px">회비는 그 달분, 게스트비·구장비는 경기한 달 기준이에요.</div></section>' : '') + '</main>';
}
/* ---------------- 스탯: 골·도움 ---------------- */
// 관리자가 앱을 안 열어도, 경기 당일부터 회원이 바로 기록할 수 있게
const played = () => {
  const P = S.pub.played || [], ids = P.map((g) => g.id), t = window.Core.ymd(new Date()), from = S.pub.statFrom || '';
  const extra = (S.pub.games || []).filter((g) => !g.postponed && g.date <= t && g.date >= from && ids.indexOf(g.id) < 0)
    .map((g) => ({ id: g.id, date: g.date, players: attendOf(g).concat(g.guests || []), teams: g.teams || [] }));
  return P.concat(extra).sort((a, b) => (a.date < b.date ? -1 : 1));
};

/* ---------------- 투표 · 공지 · 건의 ---------------- */
const pollOpen = (p) => !p.closed && (!p.deadline || Date.now() < Date.parse(p.deadline));
// 익명 투표: 투표마다 무작위 열쇠를 만들어 '나만 볼 수 있는 곳'(anonmark)에 보관 → 투표 문서엔 이름·계정 없음
async function anonKey(pid) {
  if (S.ah[pid]) return S.ah[pid];
  const m = await getDoc(CD('anonmark', pid + '__' + S.uid)).catch(() => null);
  if (m && m.exists()) S.ah[pid] = m.data().key;
  return S.ah[pid] || '';
}
const myPV = (p) => p.anon ? (S.avotes || []).find((v) => S.ah[p.id] && v.id === p.id + '__' + S.ah[p.id]) : (S.pvotes || []).find((v) => v.pid === p.id && v.mid === S.me.mid);
function pollOpts(p) {
  const vs = (p.anon ? S.avotes || [] : S.pvotes || []).filter((v) => v.pid === p.id), adds = [...new Set(vs.map((v) => v.add).filter(Boolean))];
  return (p.options || []).concat(adds.filter((a) => !(p.options || []).some((o) => o.text === a)).map((a) => ({ id: 'u:' + a, text: a, user: 1 })))
    .map((o) => Object.assign({}, o, { who: vs.filter((v) => (v.picks || []).indexOf(o.id) >= 0).map((v) => (p.anon ? '' : v.name)) }));
}
function pollsCard() {
  const ps = (S.polls || []).slice().sort((a, b) => (pollOpen(b) - pollOpen(a)) || (a.created < b.created ? 1 : -1)).slice(0, 5);
  if (!ps.length) return '';
  return '<section class="card"><h2>투표 · 공지</h2><div class="plist">' + ps.map((p) => {
    const mine = myPV(p), open = pollOpen(p), notice = !(p.options || []).length && !p.allowAdd;
    return '<button class="pitem' + (open && !mine ? ' glow' : '') + '" data-poll="' + esc(p.id) + '"><span><b>' + esc(p.title) + (isNewPoll(p) ? NEWB : '') + '</b><small>' + (open ? (p.deadline ? '<span class="pcd" data-cd="' + Date.parse(p.deadline) + '">⏳ <b>' + left(Date.parse(p.deadline) - Date.now()) + '</b> 남음</span>' : '진행 중') : '마감됨') + '</small></span>' +
      '<em class="' + (mine ? 'done' : open ? 'todo' : '') + '">' + (mine ? (notice ? '확인함' : '참여함') : open ? (notice ? '새 공지' : '참여하기') : '결과 보기') + '</em></button>';
  }).join('') + '</div></section>';
}
function openPoll(pid) {
  markSeen(pid);
  const p = (S.polls || []).find((x) => x.id === pid); if (!p) return;
  const mine = myPV(p), open = pollOpen(p), notice = !(p.options || []).length && !p.allowAdd;
  let picks = new Set(mine ? mine.picks || [] : []);
  const draw = () => {
    const opts = pollOpts(p), mx = Math.max(1, ...opts.map((o) => o.who.length)), show = !!mine || !open;
    sheet('<div class="ptag">' + (notice ? '📢 공지' : '🗳 투표') + (p.anon ? ' · 🔒 익명' : '') + (open ? '' : ' · 마감됨') + '</div><h2>' + esc(p.title) + '</h2>' + (p.desc ? '<div class="pdesc">' + esc(p.desc) + '</div>' : '') +
      (p.deadline ? (open ? cdAt(Date.parse(p.deadline)) : '<div class="muted">' + md(p.deadline.substr(0, 10)) + '(' + day(p.deadline.substr(0, 10)) + ') ' + p.deadline.substr(11, 5) + ' 마감</div>') : '') +
      (notice ? '' : '<div class="muted">' + (p.multi ? '여러 개 고를 수 있어요' : '하나만 골라주세요') + (p.anon ? ' · 누가 뭘 골랐는지 아무에게도 안 보여요' : '') + '</div><div class="popts">' + opts.map((o) =>
        '<button class="popt' + (picks.has(o.id) ? ' on' : '') + '" data-o="' + esc(o.id) + '"' + (open ? '' : ' disabled') + '><span>' + esc(o.text) + '</span>' + (show ? '<b>' + o.who.length + '</b><i style="width:' + (o.who.length / mx * 100) + '%"></i>' : '') + '</button>' +
        (show && o.who.length && !p.anon ? '<small class="pwho">' + o.who.map((n) => lvPill(lvOfName(n)) + esc(n)).join(', ') + '</small>' : '')).join('') + '</div>' +
        (open && p.allowAdd ? '<div class="padd"><input id="pnew" maxlength="20" placeholder="다른 의견 직접 쓰기"><button id="padd">추가</button></div>' : '')) +
      '<div class="srow">' + '<button id="px">' + (open && !mine ? '나중에' : '닫기') + '</button>' + (open ? '<button id="pok" class="pri">' + (notice ? '확인했어요' : mine ? '다시 저장' : '투표하기') + '</button>' : '') + '</div>', (el) => {
      el.querySelector('#px').onclick = () => { el.hidden = true; try { sessionStorage.setItem('pp_' + p.id, '1'); } catch (e) {} };
      el.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { const id = b.dataset.o; if (picks.has(id)) picks.delete(id); else { if (!p.multi) picks.clear(); picks.add(id); } draw(); }));
      const ad = el.querySelector('#padd'); if (ad) ad.onclick = () => { const t = el.querySelector('#pnew').value.trim(); if (!t) return; p._add = t; if (!p.multi) picks.clear(); picks.add('u:' + t); if (!(p.options || []).some((o) => o.text === t)) (p._extra = p._extra || []).push(t); save(); };
      const ok = el.querySelector('#pok'); if (ok) ok.onclick = save;
    });
  };
  const save = async () => {
    if (!notice && !picks.size) return toast('하나 이상 골라주세요');
    const v = { pid: p.id, mid: S.me.mid, name: S.me.name, picks: [...picks].slice(0, 10), add: p._add || (mine && mine.add) || '', uid: S.uid, at: Date.now() };
    try {
      if (p.anon) {
        let k = await anonKey(p.id); const b = writeBatch(db);
        if (!k) { k = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join(''); b.set(CD('anonmark', p.id + '__' + S.uid), { pid: p.id, uid: S.uid, key: k }); }
        b.set(CD('anonvotes', p.id + '__' + k), { pid: p.id, picks: v.picks, add: v.add, at: v.at }); await b.commit(); S.ah[p.id] = k;
      }
      else await setDoc(CD('pollvotes', p.id + '__' + S.me.mid), v); toast(notice ? '확인했어요' : '투표했어요 🗳'); $('#sheet').hidden = true; }
    catch (e) { toast('저장 실패: ' + e.message); logErr('저장 실패: ' + e.message, e.stack); }
  };
  draw();
}
/** 앱을 열었을 때 아직 안 한 투표가 있으면 바로 띄움 (한 번만) */
function autoPopup() {
  if (S.popped || !S.pollsLoaded || !S.pvLoaded || S.tab !== 'home') return;
  S.popped = true;
  const p = (S.polls || []).filter((x) => pollOpen(x) && !myPV(x)).find((x) => { try { return !sessionStorage.getItem('pp_' + x.id); } catch (e) { return true; } });
  if (p) setTimeout(() => openPoll(p.id), 300);
}
function openSuggest() {
  sheet('<h2>💬 우리 팀 총무에게 건의하기</h2><div class="muted">우리 팀 관리자(총무)만 볼 수 있어요. 앱 자체에 대한 의견은 홈 맨 아래 [앱 개발자에게 건의]로 보내주세요.</div>' +
    '<textarea id="st" rows="5" maxlength="1000" placeholder="예: 경기 시간을 30분 당기면 어떨까요?"></textarea>' +
    '<label class="chk2"><input type="checkbox" id="sa"> 이름 빼고 보내기 (익명)</label>' +
    '<div class="srow"><button id="sx">취소</button><button id="sok" class="pri">보내기</button></div>', (el) => {
    el.querySelector('#sx').onclick = () => (el.hidden = true);
    el.querySelector('#sok').onclick = async () => {
      const t = el.querySelector('#st').value.trim(); if (!t) return toast('내용을 써주세요');
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try { await setDoc(CD('suggest', id), { text: t, name: S.me.name, anon: el.querySelector('#sa').checked, uid: S.uid, at: Date.now() }); el.hidden = true; toast('보냈어요. 고마워요 🙏'); if (A) { A.sug = (A.sug || 0) + 1; achSave(); } }
      catch (e) { toast('보내기 실패: ' + e.message); }
    };
  });
}
function lastRecHTML() {
  const t = ymd(new Date()), g = played().filter((x) => x.date <= t).slice(-1)[0];
  if (!g || (Date.now() - Date.parse(g.date)) / 864e5 > 7) return '';
  return '<section class="card"><div class="h2row"><h2>경기 기록</h2><button class="more inl" data-go="rec">전체 경기기록 ›</button></div>' + gameRec(g) + '</section>';
}
function gameRec(g) {
  const gs = (S.goals || []).filter((x) => x.gid === g.id), T = (g.teams || []).map((x) => x.split('|')).filter((x) => x[0]);
  const sc = window.Core.score({ id: g.id, teams: T }, S.goals || []);
  return '<div class="grec"><div class="grh"><b>' + md(g.date) + ' (' + day(g.date) + ')</b>' + (T.length >= 2 ? '<span class="score"><em class="a">A</em> ' + sc[0] + ' : ' + sc[1] + ' <em class="b">B</em></span>' : '<span class="muted">' + g.players.length + '명</span>') + '</div>' +
    (gs.length ? gs.map((x) => '<div class="gli"><span>⚽ <b>' + lvPill(lvOfName(x.scorer)) + esc(x.scorer) + '</b>' + (x.assist ? ' <small>도움 ' + lvPill(lvOfName(x.assist)) + esc(x.assist) + '</small>' : '') + '</span>' + (x.by === S.uid || S.owner ? '<button class="x" data-gdel="' + esc(x.id) + '" aria-label="삭제">✕</button>' : '') + '</div>').join('') : '<div class="muted" style="padding:6px 0">아직 기록이 없어요</div>') +
    '<button class="addg" data-gadd="' + esc(g.id) + '">+ 골 기록 넣기</button></div>';
}
function recHTML() {
  const yms = [...new Set(played().map((g) => g.date.substr(0, 7)))].sort().reverse();
  const base = (S.pub.members || []).map((x) => x.name);
  const rows = window.Core.statTable(played(), S.goals || [], S.sym || '', base).filter((r) => r.ap || base.indexOf(r.name) >= 0);
  const all = window.Core.statTable(played(), S.goals || [], '', [S.me.name]), me = all.find((r) => r.name === S.me.name) || { gp: 0, g: 0, a: 0, ap: 0 };
  const r = (S.pub.records || {})[S.me.name] || { total: 0, came: 0, last: [] }, rate = r.total ? Math.round((r.came / r.total) * 100) : 0;
  const th = (k, l) => sortTh('st', k, l);
  return '<header class="hero">' + heroTop() + '<h1>경기기록</h1><p>골·도움 기록과 하이라이트 영상. 골·도움은 회원 누구나 넣고 고칠 수 있어요</p></header>' +
    '<main class="pad lift"><section class="card"><h2>내 기록 <small class="muted">전체 기간</small></h2><div class="stats four"><div><b>' + me.gp + '</b><span>경기</span></div><div><b>' + me.g + '</b><span>골</span></div><div><b>' + me.a + '</b><span>도움</span></div><div><b>' + rate + '%</b><span>참석률</span></div></div>' +
    '<div class="dots">' + r.last.map((x) => '<span class="' + (x ? 'on' : '') + '"></span>').join('') + '</div></section>' + profCard() +
    '<section class="card"><div class="h2row"><h2>골·도움 순위</h2><select id="sym"><option value="">전체 기간</option>' + yms.map((y) => '<option value="' + y + '"' + (y === S.sym ? ' selected' : '') + '>' + y.substr(0, 4) + '년 ' + mon(y) + '</option>').join('') + '</select></div>' +
    '<div class="muted" style="margin-top:4px">제목을 누르면 기본 → 내림차순 → 오름차순</div>' +
    '<table class="stab"><thead><tr>' + th('name', '이름') + th('gp', '경기') + th('g', '골') + th('a', '도움') + th('ap', '공격P') + '</tr></thead><tbody>' +
    sortRows(rows, 'st').map((x) => '<tr class="' + (x.name === S.me.name ? 'me' : '') + '"><td>' + lvPill(lvOfName(x.name)) + esc(x.name) + '</td><td>' + x.gp + '</td><td>' + x.g + '</td><td>' + x.a + '</td><td><b>' + x.ap + '</b></td></tr>').join('') + '</tbody></table></section>' +
    vidsRec() + '<section class="card"><h2>경기별 기록</h2>' + (played().length ? played().slice(-12).reverse().map(gameRec).join('') : '<p class="muted">' + (S.pub.statFrom ? md(S.pub.statFrom) + ' 경기 당일부터 여기에 [+ 골 기록 넣기] 버튼이 생겨요.' : '아직 치른 경기가 없어요') + '</p>') + '</section></main>';
}
/* 정렬: 제목 누를 때마다 기본 → 내림차순 → 오름차순 */
S.sort = {};
function sortRows(rows, tb) {
  const st = S.sort[tb]; if (!st || !st.d) return rows;
  return rows.slice().sort((a, b) => { const x = a[st.k], y = b[st.k]; const c = typeof x === 'string' ? x.localeCompare(y, 'ko') : x - y; return st.d === 1 ? -c : c; });
}
function sortTh(tb, k, l) {
  const st = S.sort[tb] || {}, on = st.k === k && st.d;
  return '<th class="sortable' + (on ? ' on' : '') + '" data-sort="' + tb + ':' + k + '">' + l + '<i>' + (on ? (st.d === 1 ? '▼' : '▲') : '↕') + '</i></th>';
}
function sheet(html, mount) {
  let el = $('#sheet'); if (!el) { el = document.createElement('div'); el.id = 'sheet'; document.body.appendChild(el); }
  el.className = 'sheet'; el.innerHTML = '<div class="sbox">' + html + '</div>'; el.hidden = false;
  el.onclick = (e) => { if (e.target === el) el.hidden = true; }; mount && mount(el);
}
function openGoal(gid) {
  const g = played().find((x) => x.id === gid); if (!g) return;
  const T = (g.teams || []).map((x) => x.split('|')).filter((x) => x[0]);
  const groups = T.length >= 2 ? T.map((t, i) => ['ABC'[i] + '팀', t]) : [['참석자', g.players]];
  const opts = groups.map(([l, ns]) => '<optgroup label="' + l + '">' + ns.map((n) => '<option>' + esc(n) + '</option>').join('') + '</optgroup>').join('');
  sheet('<h2>' + md(g.date) + ' 골 기록</h2><label class="sf">골 넣은 사람<select id="gs"><option value="">고르세요</option>' + opts + '</select></label>' +
    '<label class="sf">도움 (없으면 그대로)<select id="ga"><option value="">없음</option>' + opts + '</select></label>' +
    '<div class="srow"><button id="gx">취소</button><button id="gok" class="pri">저장</button></div>', (el) => {
    el.querySelector('#gx').onclick = () => (el.hidden = true);
    el.querySelector('#gok').onclick = async () => {
      const sc = el.querySelector('#gs').value, as = el.querySelector('#ga').value;
      if (!sc) return toast('골 넣은 사람을 골라주세요');
      if (sc === as) return toast('골과 도움이 같은 사람이에요');
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try { await setDoc(CD('goals', id), { gid, scorer: sc, assist: as, by: S.uid, byName: S.me.name, at: Date.now() }); el.hidden = true; toast('⚽ ' + sc + ' 골 기록!'); }
      catch (e) { toast('저장 실패: ' + e.message); logErr('저장 실패: ' + e.message, e.stack); }
    };
  });
}

/* ---------------- 업적 (배지) ----------------
   플레이스테이션 트로피(브론즈·실버·골드·플래티넘) + 나이키 연속 기록 + 당근 활동 배지를 섞음.
   한 번 받은 업적은 사라지지 않음. 기록은 내 계정(ach/{uid})에만 저장 → 팀이 여러 개여도 하나로 모임 */
const TIER = { B: ['브론즈', '흔함'], S: ['실버', '드묾'], G: ['골드', '희귀'], P: ['플래티넘', '전설'] };
const ACAT = ['접속', '참석 투표', '경기', '경기기록', '회비', '투표·건의', '하이라이트', '앱 활용', '특별'];
// [id, 분류, 등급, 아이콘, 이름, 조건, 값 이름, 목표, 숨김]
const ACH = [
  ['d1', '접속', 'B', '👟', '첫 킥오프', 'A-KICK 처음 열기', 'days', 1], ['s3', '접속', 'B', '🔥', '작심삼일 돌파', '3일 연속 접속', 'best', 3],
  ['s7', '접속', 'B', '📆', '일주일 개근', '7일 연속 접속', 'best', 7], ['s14', '접속', 'S', '🗓️', '2주 개근', '14일 연속 접속', 'best', 14],
  ['s30', '접속', 'G', '🌙', '한 달 개근', '30일 연속 접속', 'best', 30], ['s100', '접속', 'G', '💯', '100일 개근', '100일 연속 접속', 'best', 100],
  ['s365', '접속', 'P', '👑', '1년 개근', '365일 연속 접속', 'best', 365], ['d10', '접속', 'B', '🏠', '단골', '접속한 날 10일', 'days', 10],
  ['d50', '접속', 'S', '🏡', '터줏대감', '접속한 날 50일', 'days', 50], ['d150', '접속', 'G', '🏰', 'A-KICK 주민', '접속한 날 150일', 'days', 150],
  ['d300', '접속', 'G', '🗿', '살아있는 전설', '접속한 날 300일', 'days', 300],
  ['v1', '참석 투표', 'B', '✋', '첫 응답', '참석·불참 처음 누르기', 'vg', 1], ['v10', '참석 투표', 'B', '🙋', '응답 10경기', '10경기 참석 투표', 'vg', 10],
  ['v30', '참석 투표', 'S', '📣', '응답 30경기', '30경기 참석 투표', 'vg', 30], ['v100', '참석 투표', 'G', '🎖️', '응답 100경기', '100경기 참석 투표', 'vg', 100],
  ['early5', '참석 투표', 'S', '⏰', '미리미리', '마감 하루 전까지 투표 5번', 'early', 5], ['gday', '참석 투표', 'B', '🌅', '경기날 출근', '경기 당일 앱 열기', 'gd', 1],
  ['a1', '경기', 'B', '⚽', '데뷔전', '첫 경기 참석', 'came', 1], ['a10', '경기', 'S', '🥾', '10경기', '10경기 참석', 'came', 10],
  ['a30', '경기', 'S', '🏃', '30경기', '30경기 참석', 'came', 30], ['a50', '경기', 'G', '🦵', '50경기', '50경기 참석', 'came', 50],
  ['a100', '경기', 'G', '🏟️', '100경기', '100경기 참석', 'came', 100], ['row5', '경기', 'S', '🔗', '연속 출전', '5경기 연속 참석', 'row', 5],
  ['row15', '경기', 'G', '⛓️', '철인', '15경기 연속 참석', 'row', 15],
  ['g1', '경기기록', 'B', '🥅', '첫 골', '첫 골 넣기', 'g', 1], ['as1', '경기기록', 'B', '🤝', '첫 도움', '첫 도움 하기', 'a', 1],
  ['hat', '경기기록', 'S', '🎩', '해트트릭', '한 경기 3골', 'hat', 1, 1], ['ap10', '경기기록', 'S', '🎯', '공격포인트 10', '골+도움 10개', 'ap', 10],
  ['ap30', '경기기록', 'G', '💥', '공격포인트 30', '골+도움 30개', 'ap', 30], ['rec10', '경기기록', 'S', '✍️', '기록 담당', '골 기록 직접 넣기 10건', 'rec', 10],
  ['rec50', '경기기록', 'G', '📚', '기록 반장', '골 기록 직접 넣기 50건', 'rec', 50],
  ['p1', '회비', 'B', '💵', '첫 회비', '회비 납부 확인', 'pm', 1], ['p3', '회비', 'S', '💳', '3개월 연속 납부', '3개월 연속 회비 납부', 'pmRow', 3],
  ['p12', '회비', 'G', '🏦', '1년 완납', '12개월 연속 회비 납부', 'pmRow', 12], ['pe3', '회비', 'S', '⚡', '칼납', '마감일 전에 납부 3번', 'pe', 3],
  ['pv1', '투표·건의', 'B', '🗳️', '첫 투표', '투표·공지 처음 참여', 'pv', 1], ['pv20', '투표·건의', 'S', '📊', '여론 주도', '투표·공지 20개 참여', 'pv', 20],
  ['sug', '투표·건의', 'B', '💬', '한마디', '관리자에게 건의 보내기', 'sug', 1],
  ['vw1', '하이라이트', 'B', '🎬', '첫 시청', '하이라이트 처음 보기', 'vw', 1], ['vw20', '하이라이트', 'S', '🍿', '명장면 수집가', '하이라이트 20편 보기', 'vw', 20],
  ['c1', '하이라이트', 'B', '💭', '첫 댓글', '하이라이트에 댓글 쓰기', 'cm', 1], ['ct', '하이라이트', 'B', '⏱️', '타임라인', '시간(1:23)을 넣은 댓글 쓰기', 'ct', 1],
  ['c30', '하이라이트', 'S', '🗣️', '해설위원', '댓글 30개', 'cm', 30],
  ['inst', '앱 활용', 'B', '📲', '홈 화면 추가', '앱을 홈 화면에 설치', 'inst', 1], ['push', '앱 활용', 'B', '🔔', '알림 켜기', '알림 받기 켜기', 'push', 1],
  ['num', '앱 활용', 'B', '🔟', '등번호 등록', '내 선수 정보에 등번호 넣기', 'num', 1], ['bank', '앱 활용', 'B', '🔍', '꼼꼼한 회원', '통장 탭에서 장부 보기', 'bank', 1],
  ['ny', '특별', 'S', '🎍', '새해 첫 킥', '1월 1일에 접속', 'ny', 1, 1], ['yr1', '특별', 'G', '🎂', '1주년', '팀 가입 1년', 'yr', 365],
  ['plat', '특별', 'P', '💎', 'A-KICK 플래티넘', '다른 업적 49개 모두 달성', 'got', 49]
];
let A = null, achSaveT = null, achT = null;
const achRef = () => doc(db, 'ach', S.uid);
function achSave() { clearTimeout(achSaveT); achSaveT = setTimeout(() => setDoc(achRef(), A).catch((e) => logErr('업적 저장 실패: ' + e.message)), 800); }
function achAdd(k, v, cap) { if (!A) return; const a = (A[k] = A[k] || []); if (a.indexOf(v) < 0) { a.push(v); if (a.length > (cap || 400)) a.shift(); achSave(); } }
function achFlag(k) { if (!A) return; A.f = A.f || {}; if (!A.f[k]) { A.f[k] = 1; achSave(); } }
async function achLoad() {
  if (A) return achTick();
  try { const d = await getDoc(achRef()); A = d.exists() ? d.data() : {}; } catch (e) { A = {}; }
  A.got = A.got || {}; A.f = A.f || {}; achTick();
}
/** 하루 한 번: 접속일·연속 접속 */
function achTick() {
  if (!A) return;
  const now = new Date(), t = ymd(now), y = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (STANDALONE) achFlag('inst');
  if (A.last === t) return;
  A.streak = A.last === y ? (A.streak || 0) + 1 : 1; A.best = Math.max(A.best || 0, A.streak); A.days = (A.days || 0) + 1; A.last = t;
  if (t.substr(5) === '01-01') A.f.ny = 1;
  achSave();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && A) { achTick(); achSoon(); } });
function maxRun(list) { let b = 0, c = 0; list.forEach((x) => { c = x ? c + 1 : 0; b = Math.max(b, c); }); return b; }
function achCtx() {
  const P = played(), nm = S.me.name, gs = S.goals || [], st = myStat() || { g: 0, a: 0, ap: 0 };
  const byG = {}; gs.filter((x) => x.scorer === nm).forEach((x) => (byG[x.gid] = (byG[x.gid] || 0) + 1));
  const pm = (A.pm || []).slice().sort(); let pmRow = 0, pc = 0; pm.forEach((m, i) => { pc = i && window.Core.addYM(pm[i - 1], 1) === m ? pc + 1 : 1; pmRow = Math.max(pmRow, pc); });
  const mine = (S.vcAll || []).filter((c) => c.uid === S.uid), r = (S.pub.records || {})[nm] || { came: 0 };
  return { days: A.days || 0, best: A.best || 0, vg: (A.vg || []).length, early: (A.early || []).length, gd: (A.gd || []).length,
    came: Math.max(r.came || 0, P.filter((g) => (g.players || []).indexOf(nm) >= 0).length), row: maxRun(P.map((g) => (g.players || []).indexOf(nm) >= 0)),
    g: st.g, a: st.a, ap: st.g + st.a, hat: Object.values(byG).some((n) => n >= 3) ? 1 : 0, rec: gs.filter((x) => x.by === S.uid).length,
    pm: pm.length, pmRow, pe: (A.pe || []).length,
    pv: (S.pvotes || []).filter((v) => v.mid === S.me.mid).length + Object.values(S.ah || {}).filter(Boolean).length, sug: A.sug || 0,
    vw: (A.vw || []).length, cm: mine.length, ct: mine.some((c) => /(^|[^\d:])\d{1,2}:[0-5]\d/.test(c.text || '')) ? 1 : 0,
    inst: A.f.inst || 0, push: A.f.push || 0, num: ((S.profs || {})[S.me.mid] || {}).num ? 1 : 0, bank: A.f.bank || 0,
    ny: A.f.ny || 0, yr: S.me.at ? Math.floor((Date.now() - S.me.at) / 864e5) : 0, got: ACH.filter((x) => x[0] !== 'plat' && A.got[x[0]]).length };
}
function achSoon() { clearTimeout(achT); achT = setTimeout(() => { achCheck(); lvSync(); }, 1200); }
function achCheck() {
  if (!A || !S.pub || !S.me || !S.cid || !(S.pub.members || []).some((m) => m.id === S.me.mid)) return;
  const d = S.pub.dues, t = ymd(new Date());
  if (d && d.paid.indexOf(S.me.name) >= 0) { achAdd('pm', d.ym, 60); const due = window.Core.addYM(d.ym, -1) + '-' + String(d.dueDay || 30).padStart(2, '0'); if (t <= due) achAdd('pe', d.ym, 60); }
  if ((S.pub.games || []).concat(S.pub.played || []).some((g) => g.date === t)) achAdd('gd', t, 400);
  const fresh = [];
  for (let k = 0; k < 2; k++) {                                         // 두 번 돌려야 플래티넘까지 한 번에 잡힘
    const x = achCtx();
    ACH.forEach((a) => { if (!A.got[a[0]] && x[a[6]] >= a[7]) { A.got[a[0]] = Date.now(); fresh.push(a); } });
  }
  if (!fresh.length) return achSyncProf();
  achSave(); achSyncProf(); achCelebrate(fresh);
  if (S.tab === 'home') render();
}
/** 팀원에게 보일 업적 수 (선수 정보 문서에 같이 저장) */
function achSyncProf() { profPut(); }
/** 팀원에게 보일 내 값(업적 수·레벨·EXP)을 한 번에 저장 — 따로 쓰면 서로 덮어써서 */
function profPut() {
  if (!S.profs || !A || S.rpsNet === undefined || !S.pollsLoaded || !S.pvLoaded || !S.goals || !S.vcAll) return;
  const p = S.profs[S.me.mid] || {}, n = Object.keys(A.got).length, plat = A.got.plat ? 1 : 0, xp = myXp(), lv = window.Core.lvOf(xp).lv;
  if (p.ach === n && (p.plat || 0) === plat && p.xp === xp && p.lv === lv) return;
  const v = { num: p.num || 0, pos: p.pos || [], uid: S.uid, at: Date.now(), ach: n, plat, xp, lv };
  S.profs[S.me.mid] = Object.assign({}, p, v);
  setDoc(doc(db, 'clubs', S.cid, 'profiles', S.me.mid), v).catch(() => {});
}
/* ---- 업적 뱃지 그림 (방패 엠블럼) : 테마와 상관없이 남색 코어 + 금속 테두리 ---- */
const AIC = {
  d1: '<path d="M3 15.5h13.8a3.7 3.7 0 0 0 3.7-3.7V11l-5.6-1.2L12.5 6H8.2L7 9.4 3 10.6z"/><path d="M3 19h18M10 9.5l1.5 1.5M8.6 11.6l1.4 1.4"/>',
  s3: '<path d="M12 2.5c.8 3.6 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.4 2.7-5.4.3 1.7 1 2.6 2.1 3.1 0-3.4.7-5.9.7-8.7z"/><path d="M12 20.5a2.4 2.4 0 0 1-2.4-2.4c0-1.6 1.3-2.4 2.4-4 1.1 1.6 2.4 2.4 2.4 4a2.4 2.4 0 0 1-2.4 2.4z"/>',
  s7: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 2.8v4M16 2.8v4M9 14.2l2.2 2.2 4-4"/>',
  s14: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 2.8v4M16 2.8v4M6.5 15l1.6 1.6 2.7-2.9M13.2 15l1.6 1.6 2.7-2.9"/>',
  s30: '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z"/><path d="M16.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  s100: '<path d="M8.5 21a4.5 4.5 0 0 1-4.5-4.5c0-3.3 2.7-4.6 3-8 1.8 1.4 2.8 3.2 2.8 5"/><path d="M14 21a5 5 0 0 1-5-5c0-4.5 4-6.3 4.6-13 3.4 2.6 6.4 6.5 6.4 11.6A6.4 6.4 0 0 1 14 21z"/>',
  s365: '<path d="M3 8.5l4.6 3.8L12 5l4.4 7.3L21 8.5l-1.8 9.5H4.8z"/><path d="M5 21h14"/><circle cx="12" cy="13.6" r="1.3"/>',
  d10: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
  d50: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M12 17.5s-3-1.8-3-3.6a1.5 1.5 0 0 1 3-.4 1.5 1.5 0 0 1 3 .4c0 1.8-3 3.6-3 3.6z"/>',
  d150: '<path d="M4 20V8h2.5v2H9V8h2v2h2V8h2v2h2.5V8H20v12z"/><path d="M10 20v-4a2 2 0 0 1 4 0v4M4 13h16"/>',
  d300: '<path d="M2.5 20l6.5-11 3.5 5.5L15 11l6.5 9z"/><path d="M7 11.6l2 1.6 1.6-1.4"/><path d="M15 4v3.5M15 4l3 1-3 1"/>',
  v1: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11V4a1.5 1.5 0 0 1 3 0v7V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7 6.3 6.3 0 0 1-5.2-2.7L3.6 14.6a1.6 1.6 0 0 1 2.6-1.8L8 15"/>',
  v10: '<circle cx="12" cy="12" r="9"/><path d="M7.8 12.2l2.8 2.8 5.6-5.8"/>',
  v30: '<path d="M3 10v4h3l7 4.5v-13L6 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/><path d="M6 14l1.2 5h2.3l-1-4.2"/>',
  v100: '<circle cx="12" cy="14.5" r="6.5"/><path d="M8.5 9L5.5 2.8h4L12 8M15.5 9l3-6.2h-4L12 8"/><path d="M12 11.6l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
  early5: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.6 1.8M4 5.5L7 3M20 5.5L17 3"/>',
  gday: '<path d="M3 18h18M5.5 18a6.5 6.5 0 0 1 13 0"/><path d="M12 4.5V8M4.8 8.6l2.4 2.4M19.2 8.6l-2.4 2.4M7 21h10"/>',
  a1: '<circle cx="12" cy="12" r="9"/><path d="M12 7.6l3.4 2.5-1.3 4H9.9l-1.3-4z"/><path d="M12 7.6V3.2M15.4 10.1l4.1-1.4M14.1 14.1l2.6 3.6M9.9 14.1l-2.6 3.6M8.6 10.1L4.5 8.7"/>',
  a10: '<path d="M6 3h6v7.5l5.5 2.3A3.5 3.5 0 0 1 20 16v2H4.5L6 3z"/><path d="M4.5 18v2.5H20V18M12 13.5l-1.5 1.8M15 14.5l-1.3 1.8"/>',
  a30: '<circle cx="15" cy="4.5" r="1.8"/><path d="M8 21l3.2-5.5L14 17v4M6.5 11.5L9 8.4h4.2l2.6 3.4 3 .8M13 8.6l-2 5.2 3.2 2.1"/>',
  a50: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M12 8v7.5M8.3 11.8h7.4"/>',
  a100: '<ellipse cx="12" cy="9" rx="9" ry="3.5"/><path d="M3 9v6c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V9"/><path d="M8 12.3v6M16 12.3v6M12 12.5v6"/>',
  row5: '<path d="M9.8 14.2a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1.2 1.2"/><path d="M14.2 9.8a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1.2-1.2"/>',
  row15: '<rect x="2.5" y="8.5" width="7" height="7" rx="3.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="3.5"/><rect x="14.5" y="8.5" width="7" height="7" rx="3.5"/>',
  g1: '<path d="M2.5 19V6h19v13"/><path d="M2.5 9.5h19M6 6v13M10 6v13M14 6v13M18 6v13" stroke-opacity=".5"/><circle cx="12" cy="16" r="3" fill="currentColor"/>',
  as1: '<path d="M2.5 11l3.5-3.5 3 1 3-2 4.5 4.5M21.5 11L18 7.5l-2.5.7"/><path d="M5 11l5.5 5.5a1.4 1.4 0 0 0 2-2M9 13.5l3 3a1.4 1.4 0 0 0 2-2l-1.5-1.5M12 13l2 2a1.4 1.4 0 0 0 2-2l-3.5-3.5"/>',
  hat: '<path d="M7 16V5.5h10V16"/><path d="M3 17.5c0 1.3 4 2.5 9 2.5s9-1.2 9-2.5c0-1-1.6-1.6-4-2H7c-2.4.4-4 1-4 2z"/><path d="M7 12.5h10"/>',
  ap10: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  ap30: '<path d="M12 2.5l1.9 5 5.3-1.8-2.8 4.7 4.6 3-5.4.6.5 5.4L12 15.9l-4.1 3.5.5-5.4-5.4-.6 4.6-3L4.8 5.7l5.3 1.8z"/>',
  rec10: '<path d="M15.5 4.5l4 4L9 19H5v-4z"/><path d="M13 7l4 4M4 21.5h16"/>',
  rec50: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3M8.5 7.5h7M8.5 11h5"/>',
  p1: '<circle cx="12" cy="12" r="9"/><path d="M8 8.5l1.6 7 2.4-5 2.4 5 1.6-7M7 12h10"/>',
  p3: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
  p12: '<path d="M3 9.5L12 4l9 5.5M4.5 9.5h15"/><path d="M6 11.5v6M10 11.5v6M14 11.5v6M18 11.5v6M3.5 20h17"/>',
  pe3: '<path d="M13.5 2.5L4.5 13.5H11l-1 8 9-11h-6.5z"/>',
  pv1: '<path d="M4 11.5h16V20H4z"/><path d="M8 11.5V4h8v7.5M10 7.5l1.4 1.4 2.6-2.6M4 11.5L2.5 14M20 11.5l1.5 2.5"/>',
  pv20: '<path d="M4 20V11M9.3 20V6M14.6 20v-7M20 20V3.5M2.5 20h19"/>',
  sug: '<path d="M4 5.5h16v10H9.5L5 19.5v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  vw1: '<circle cx="12" cy="12" r="9"/><path d="M10 8.3l5.5 3.7-5.5 3.7z" fill="currentColor"/>',
  vw20: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/>',
  c1: '<path d="M12 4c5 0 9 3.1 9 7s-4 7-9 7c-1 0-2-.1-2.9-.4L5 20l1-3.5C4.2 15.2 3 13.2 3 11c0-3.9 4-7 9-7z"/>',
  ct: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4h3M9.5 2.5h5M12 2.5V6M18.5 6.5l1.5-1.5"/>',
  c30: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4M8.5 21.5h7"/>',
  inst: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3M10.5 18.5h3"/>',
  push: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0M12 3v2"/>',
  num: '<path d="M8.5 3L4 5.5 2.5 10l3 1V21h13V11l3-1L20 5.5 15.5 3a3.5 3.5 0 0 1-7 0z"/><path d="M10.5 11.5h2.5l-1.5 6"/>',
  bank: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5M8 10.5h5M10.5 8v5"/>',
  ny: '<path d="M12 3l1.2 3.4L17 7l-2.8 2.3.9 3.7L12 11.2 8.9 13l.9-3.7L7 7l3.8-.6z"/><path d="M12 15v6.5M8 18.5l4-3.5 4 3.5M5 21.5h14"/>',
  yr1: '<path d="M4 21V13a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 13v8"/><path d="M4 16c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0M2.5 21h19M12 11.5V8"/><path d="M12 3.5c1 1 1.3 1.8 0 3-1.3-1.2-1-2 0-3z"/>',
  plat: '<path d="M6.5 3.5h11l4 5.5-9.5 12L2.5 9z"/><path d="M2.5 9h19M9 3.5L7.5 9l4.5 12 4.5-12L15 3.5"/>',
  '?': '<path d="M9 9a3 3 0 1 1 4.3 2.7c-.8.4-1.3 1.1-1.3 2v.8"/><circle cx="12" cy="18" r=".6" fill="currentColor"/>'
};
const AMET = { B: ['#FFE2C6', '#C98450', '#6E3B1C', '#FFD3AE'], S: ['#FFFFFF', '#B9C3D1', '#5E6B7E', '#EEF3FA'], G: ['#FFF4BF', '#E5B21E', '#8A5E00', '#FFE58A'], P: [0, 0, '#6B5FB0', '#E7F0FF'] };
const SH = 'M60 6L104 20V58C104 88 84 106 60 116C36 106 16 88 16 58V20Z', SH2 = 'M60 14L96 25.5V58C96 83 79 98.5 60 107C41 98.5 24 83 24 58V25.5Z';
(function achDefs() {
  const st = (t) => t === 'P' ? '<stop offset="0" stop-color="#F4F8FF"/><stop offset=".25" stop-color="#C9D8FF"/><stop offset=".5" stop-color="#F3DDFF"/><stop offset=".72" stop-color="#C8F3EC"/><stop offset="1" stop-color="#8E86D6"/>'
    : (([a, b, c]) => '<stop offset="0" stop-color="' + a + '"/><stop offset=".45" stop-color="' + b + '"/><stop offset=".55" stop-color="' + c + '"/><stop offset=".8" stop-color="' + b + '"/><stop offset="1" stop-color="' + a + '"/>')(AMET[t]);
  const d = document.createElement('div'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML = '<svg aria-hidden="true"><defs>' + 'BSGP'.split('').map((t) => '<linearGradient id="akm' + t + '" x1="0" y1="0" x2="1" y2="1">' + st(t) + '</linearGradient><linearGradient id="akr' + t + '" x1="1" y1="0" x2="0" y2="1">' + st(t) + '</linearGradient>' +
    '<linearGradient id="aki' + t + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="' + AMET[t][3] + '"/></linearGradient>').join('') +
    '<radialGradient id="akc" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#2A3352"/><stop offset="1" stop-color="#0E1222"/></radialGradient>' +
    '<linearGradient id="akg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="aksh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<clipPath id="akclip"><path d="' + SH + '"/></clipPath></defs></svg>';
  document.body.appendChild(d);
})();
const TWORD = { B: 'BRONZE', S: 'SILVER', G: 'GOLD', P: 'PLATINUM' };
function medal(a, on, big) {
  const t = a[2], ic = on || !a[8] ? a[0] : '?', sm = !big;
  const star = (x, y, r) => '<path d="M' + x + ' ' + (y - r) + 'L' + (x + r * .28) + ' ' + (y - r * .28) + 'L' + (x + r) + ' ' + y + 'L' + (x + r * .28) + ' ' + (y + r * .28) + 'L' + x + ' ' + (y + r) + 'L' + (x - r * .28) + ' ' + (y + r * .28) + 'L' + (x - r) + ' ' + y + 'L' + (x - r * .28) + ' ' + (y - r * .28) + 'Z" fill="#fff"/>';
  return '<span class="md ' + t + (on ? '' : ' off') + (big ? ' big' : '') + '"><svg viewBox="0 0 120 124" aria-hidden="true">' +
    '<path d="' + SH + '" fill="url(#akm' + t + ')"/><path d="' + SH2 + '" fill="url(#akc)"/><path d="' + SH2 + '" fill="none" stroke="url(#akr' + t + ')" stroke-width="1.2" stroke-opacity=".7"/>' +
    '<path d="M24 25.5L60 14L96 25.5V40C80 34 40 34 24 40Z" fill="url(#akg)" opacity=".35"/>' +
    '<rect x="30" y="84" width="60" height="13" rx="3" fill="url(#akm' + t + ')"/>' + (sm ? '' : '<text x="60" y="93.6" text-anchor="middle" font-family="Pretendard,Arial" font-weight="900" font-size="7.5" letter-spacing="1.6" fill="#141A2E">' + TWORD[t] + '</text>') +
    '<g transform="translate(' + (sm ? 38.4 : 41.4) + ',' + (sm ? 31 : 36.4) + ') scale(' + (sm ? 1.8 : 1.55) + ')" fill="none" stroke="url(#aki' + t + ')" color="' + AMET[t][3] + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + AIC[ic] + '</g>' +
    (t === 'P' && on ? star(22, 26, 7) + star(100, 32, 5) + '<g clip-path="url(#akclip)"><rect x="-60" y="0" width="50" height="124" fill="url(#aksh)" transform="skewX(-18)"><animate attributeName="x" values="-60;160;160" dur="3s" repeatCount="indefinite"/></rect></g>' : '') +
    '</svg></span>';
}
function achCelebrate(list) {
  if (S.demo) return;
  if (list.length > 3) return sheet('<div class="apop-h">🏆 업적 ' + list.length + '개 달성!</div><div class="agrid">' + list.map((a) => '<div class="ait">' + medal(a, 1) + '<b>' + esc(a[4]) + '</b><small>' + TIER[a[2]][0] + '</small></div>').join('') + '</div><div class="srow"><button class="pri" id="ax">좋아요</button></div>', (el) => (el.querySelector('#ax').onclick = () => (el.hidden = true)));
  let i = 0;
  const one = () => {
    const a = list[i++]; if (!a) return;
    const el = document.createElement('div'); el.className = 'apop'; el.innerHTML = '<div class="apbox">' + medal(a, 1, 1) + '<small>업적 달성</small><b>' + esc(a[4]) + '</b><em class="t' + a[2] + '">' + TIER[a[2]].join(' · ') + '</em><span>' + esc(a[5]) + '</span></div>';
    document.body.appendChild(el); const bye = () => { if (!el.parentNode) return; el.remove(); one(); };
    el.onclick = bye; setTimeout(bye, 3200);
  };
  one();
}
function achNext(x) {
  return ACH.filter((a) => !A.got[a[0]] && !a[8] && a[0] !== 'plat').map((a) => [a, Math.min(x[a[6]], a[7]) / a[7]]).sort((p, q) => q[1] - p[1])[0];
}
function achCard() {
  if (!A) return '';
  const x = achCtx(), got = ACH.filter((a) => A.got[a[0]]), nx = achNext(x), cnt = (t) => got.filter((a) => a[2] === t).length;
  const last = got.slice().sort((p, q) => A.got[q[0]] - A.got[p[0]]).slice(0, 5);
  return '<section class="card achc"><div class="h2row"><h2>🏆 업적 <small class="muted">' + got.length + '/' + ACH.length + '</small></h2><button class="more inl" id="achall">전체 ›</button></div>' +
    '<div class="arow">' + (last.length ? last.map((a) => medal(a, 1)).join('') : '<span class="muted">아직 없어요. 매일 들어오기만 해도 하나씩 열려요</span>') + '</div>' +
    (nx ? '<div class="anext"><span>다음 목표 ' + nx[0][3] + ' <b>' + esc(nx[0][4]) + '</b></span><em>' + Math.min(x[nx[0][6]], nx[0][7]) + '/' + nx[0][7] + '</em><i><u style="width:' + Math.round(nx[1] * 100) + '%"></u></i></div>' : '') +
    '<div class="atiers"><span class="tB">브론즈 ' + cnt('B') + '</span><span class="tS">실버 ' + cnt('S') + '</span><span class="tG">골드 ' + cnt('G') + '</span><span class="tP">플래티넘 ' + cnt('P') + '</span>' + ((A.streak || 0) > 1 ? '<span class="tF">🔥 ' + A.streak + '일 연속</span>' : '') + '</div></section>';
}
function openAch() {
  const x = achCtx(), got = ACH.filter((a) => A.got[a[0]]).length;
  const rank = Object.entries(S.profs || {}).filter(([, p]) => p.ach).map(([mid, p]) => [((S.pub.members || []).find((m) => m.id === mid) || {}).name, p.ach, p.plat]).filter((r) => r[0]).sort((p, q) => q[1] - p[1]).slice(0, 5);
  sheet('<h2>🏆 업적 ' + got + '/' + ACH.length + '</h2>' +
    '<div class="aleg"><span class="tB">브론즈 · 흔함</span><span class="tS">실버 · 드묾</span><span class="tG">골드 · 희귀</span><span class="tP">플래티넘 · 전설</span></div>' +
    '<div class="muted" style="font-size:12px">등급이 높을수록 오래 꾸준히 써야 열려요. 플래티넘은 1년 이상 걸려요.</div>' +
    (rank.length ? '<div class="arank"><b>팀 업적 순위</b>' + rank.map((r, i) => '<span>' + (i + 1) + '. ' + lvPill(lvOfName(r[0])) + esc(r[0]) + (r[2] ? ' 💎' : '') + ' <em>' + r[1] + '개</em></span>').join('') + '</div>' : '') +
    ACAT.map((c) => '<div class="acat">' + c + '</div><div class="alist">' + ACH.filter((a) => a[1] === c).map((a) => {
      const on = !!A.got[a[0]], hid = a[8] && !on, cur = Math.min(x[a[6]] || 0, a[7]);
      return '<div class="ali' + (on ? ' on' : '') + '">' + medal(a, on) + '<div><b>' + (hid ? '숨겨진 업적' : esc(a[4])) + '<em class="t' + a[2] + '">' + TIER[a[2]][0] + '</em></b><small>' + (hid ? '달성하면 공개돼요' : esc(a[5])) + '</small>' +
        (on ? '<small class="adt">' + ymd(new Date(A.got[a[0]])).replace(/-/g, '.') + ' 달성</small>' : hid || a[7] === 1 ? '' : '<i><u style="width:' + Math.round(cur / a[7] * 100) + '%"></u></i><small>' + cur + '/' + a[7] + '</small>') + '</div></div>';
    }).join('') + '</div>').join('') +
    '<div class="srow"><button class="pri" id="ax">닫기</button></div>', (el) => (el.querySelector('#ax').onclick = () => (el.hidden = true)));
}

/* ---------------- 레벨 (EXP) ----------------
   EXP는 따로 쌓아두지 않고 실제 기록(접속·투표·참석·골·댓글·회비·업적)에서 계산 → 조작이 어렵고 지난 기록도 반영됨.
   가위바위보 손익과 관리자 지급만 더함 */
const XP_ACH = { B: 20, S: 50, G: 150, P: 500 };
const LVMET = { B: ['#FFE7D1', '#D08A55', '#7A4220'], S: ['#FFFFFF', '#BCC6D3', '#5E6B7E'], G: ['#FFF6C9', '#E8B423', '#8A5E00'], E: ['#D5FFF3', '#2BC7A4', '#0B6B57'] };
const LVSTOP = (k) => k === 'P' ? '<stop offset="0" stop-color="#F7FAFF"/><stop offset=".3" stop-color="#C9D8FF"/><stop offset=".55" stop-color="#F1DCFF"/><stop offset=".8" stop-color="#C6F1EA"/><stop offset="1" stop-color="#8F88D8"/>'
  : k === 'X' ? '<stop offset="0" stop-color="#FFF1B5"/><stop offset=".3" stop-color="#FFB36B"/><stop offset=".55" stop-color="#F07BFF"/><stop offset=".8" stop-color="#76B8FF"/><stop offset="1" stop-color="#7CF5D2"/>'
  : '<stop offset="0" stop-color="' + LVMET[k][0] + '"/><stop offset=".5" stop-color="' + LVMET[k][1] + '"/><stop offset="1" stop-color="' + LVMET[k][2] + '"/>';
const LVBG = (k) => k === 'P' ? 'linear-gradient(135deg,#F7FAFF,#C9D8FF 30%,#F1DCFF 55%,#C6F1EA 80%,#8F88D8)' : k === 'X' ? 'linear-gradient(120deg,#FFF1B5,#FFB36B,#F07BFF,#76B8FF,#7CF5D2)'
  : 'linear-gradient(135deg,' + LVMET[k][0] + ',' + LVMET[k][1] + ' 50%,' + LVMET[k][2] + ')';
/** 작은 자리용 알약 (테두리 색으로 구간 구분) */
function lvPill(lv) { if (!lv) return ''; const b = window.Core.lvBand(lv); return '<kk-lv class="lvp" style="background:' + LVBG(b.key) + '"><kk-i>' + (lv >= 50 ? 'GOAT' : 'LV.' + lv) + '</kk-i></kk-lv>'; }   // 전용 태그: 주변 span·i 스타일이 묻지 않게
let lvUid = 0;
/** 큰 자리용 엠블럼: 깎인 보석 + 구간이 오를수록 길어지는 월계수 (GOAT는 원 + 별) */
function lvEmblem(lv, size) {
  const b = window.Core.lvBand(lv), k = b.key, u = 'lv' + (++lvUid), PH = { B: 0, S: 70, G: 100, E: 128, P: 152, X: 178 }[k];
  const cx = 60, cy = 62, R = 40, rad = (d) => d * Math.PI / 180, f = (n) => n.toFixed(1);
  const light = k === 'P' || k === 'X' ? '#E8EEFF' : LVMET[k][0];
  let g = '';
  if (k === 'X') g += '<circle cx="60" cy="60" r="58" fill="url(#gl' + u + ')"/>';
  if (PH) for (const sd of [-1, 1]) {
    let pts = []; for (let p = 18; p <= PH; p += 3) pts.push(f(cx + sd * R * Math.sin(rad(p))) + ' ' + f(cy + R * Math.cos(rad(p))));
    g += '<path d="M' + pts.join(' L') + '" fill="none" stroke="url(#m' + u + ')" stroke-width="1.6" stroke-linecap="round"/>';
    const n = Math.max(2, Math.round((PH - 20) / 24) + 1);
    for (let j = 0; j < n; j++) {
      const p = rad(22 + j * (PH - 28) / Math.max(n - 1, 1)), x = cx + sd * R * Math.sin(p), y = cy + R * Math.cos(p);
      const tang = Math.atan2(-Math.sin(p), sd * Math.cos(p)) * 180 / Math.PI + 90, L = 15 - j * 1.1, W = 6.2 - j * .35;
      for (const side of [1, -1]) {
        const ox = x + side * 4.2 * Math.sin(p) * sd, oy = y + side * 4.2 * Math.cos(p);
        g += '<g transform="translate(' + f(ox) + ' ' + f(oy) + ') rotate(' + f(tang + side * sd * -32) + ')"><path d="M0 ' + f(-L / 2) + ' Q' + f(W / 2) + ' 0 0 ' + f(L / 2) + ' Q' + f(-W / 2) + ' 0 0 ' + f(-L / 2) + 'Z" fill="url(#m' + u + ')"/><path d="M0 ' + f(-L / 2) + ' Q' + f(W / 2) + ' 0 0 ' + f(L / 2) + 'Z" fill="#fff" fill-opacity=".38"/></g>';
      }
    }
  }
  if (k === 'X') g += '<path d="M60 3.5l3.1 6.4 7 .9-5.1 4.8 1.3 6.9L60 19.2l-6.3 3.3 1.3-6.9-5.1-4.8 7-.9z" fill="url(#m' + u + ')" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>';
  const fac = (a, b2, c, d, col, op) => '<path d="M' + a + 'L' + b2 + 'L' + c + 'L' + d + 'Z" fill="' + col + '" fill-opacity="' + op + '"/>';
  g += '<path d="M60 30L88 58L60 86L32 58Z" fill="url(#m' + u + ')" stroke="#0B0F1E" stroke-opacity=".25" stroke-width=".8" stroke-linejoin="round"/>' +
    fac('60 30', '88 58', '80 58', '60 38', '#fff', .35) + fac('88 58', '60 86', '60 78', '80 58', '#000', .18) + fac('60 86', '32 58', '40 58', '60 78', '#000', .28) + fac('32 58', '60 30', '60 38', '40 58', '#fff', .55) +
    '<path d="M60 38L80 58L60 78L40 58Z" fill="url(#c' + u + ')"/><path d="M60 38L80 58L60 78L40 58Z" fill="none" stroke="#fff" stroke-opacity=".14"/>' +
    '<text x="60" y="' + (lv < 10 ? 63.6 : 63.2) + '" text-anchor="middle" font-family="Bungee,sans-serif" font-size="' + (lv < 10 ? 17 : 15.5) + '" fill="url(#n' + u + ')">' + lv + '</text>';
  return '<svg class="lvem" viewBox="0 0 120 120" width="' + size + '" height="' + size + '" aria-label="레벨 ' + lv + '"><defs><linearGradient id="m' + u + '" x1="0" y1="0" x2="1" y2="1">' + LVSTOP(k) + '</linearGradient>' +
    '<radialGradient id="c' + u + '" cx=".5" cy=".28" r=".85"><stop offset="0" stop-color="#2C3657"/><stop offset="1" stop-color="#0B0F1E"/></radialGradient>' +
    '<linearGradient id="n' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="' + light + '"/></linearGradient>' +
    '<radialGradient id="gl' + u + '" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#F07BFF" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
    '<g style="filter:drop-shadow(0 3px 4px rgba(11,16,32,.28))">' + g + '</g></svg>';
}
/** 내 EXP 내역 (활동별) */
function xpParts() {
  const x = achCtx(), byDay = {};
  (S.vcAll || []).filter((c) => c.uid === S.uid).forEach((c) => { const d = ymd(new Date(c.at || 0)); byDay[d] = (byDay[d] || 0) + 1; });
  const cm = Object.values(byDay).reduce((a, n) => a + Math.min(10, n), 0);
  const ach = ACH.filter((a) => A.got[a[0]]).reduce((s, a) => s + XP_ACH[a[2]], 0);
  const adj = ((S.pub.xpAdj || {})[S.me.mid]) || 0;
  return [['접속한 날', x.days, 5], ['참석 투표', x.vg, 10], ['경기 참석', x.came, 30], ['골', x.g, 10], ['도움', x.a, 7], ['하이라이트 댓글', cm, 3], ['투표·공지 참여', x.pv, 5], ['회비 기한 내 납부', x.pe, 20]]
    .map(([l, n, p]) => [l, n + '회', n * p]).concat([['업적 보너스', ACH.filter((a) => A.got[a[0]]).length + '개', ach], ['가위바위보', '', S.rpsNet || 0], ['관리자 지급', '', adj]]);
}
function myXp() { return Math.max(0, xpParts().reduce((s, p) => s + p[2], 0)); }
function lvOfMid(mid) { const p = (S.profs || {})[mid]; return p && p.lv ? p.lv : 0; }
function lvOfName(n) { const m = (S.pub.members || []).find((x) => x.name === n); return m ? lvOfMid(m.id) : 0; }
function lvCard() {
  if (!A) return '';
  const L = window.Core.lvOf(myXp()), b = window.Core.lvBand(L.lv), rk = lvRank(), my = rk.findIndex((r) => r.mid === S.me.mid);
  return '<section class="card lvc"><div class="lvhead">' + lvEmblem(L.lv, 76) + '<div class="lvnm"><b>' + esc(S.me.name) + ' <button class="lvb" id="lvguide">' + b.name + ' ⓘ</button></b>' +
    '<small>' + (L.lv >= 50 ? '최고 레벨 GOAT 🐐' : 'LV.' + (L.lv + 1) + '까지 ' + (L.need - L.cur) + ' EXP') + (my >= 0 && rk.length > 1 ? ' · 팀 ' + (my + 1) + '위' : '') + '</small></div><button class="more inl" id="lvall">내역 ›</button></div>' +
    '<div class="lvbar"><u style="width:' + (L.lv >= 50 ? 100 : Math.round(L.cur / L.need * 100)) + '%"></u></div><div class="lvxp"><span>LV.' + L.lv + '</span><span><b>' + L.xp.toLocaleString() + '</b> EXP</span><span>' + (L.lv >= 50 ? 'GOAT' : 'LV.' + (L.lv + 1)) + '</span></div>' +
    '<button class="rpsbtn" id="rpsgo"><span>✊✌️🖐️</span><b>오늘의 가위바위보</b><em>' + Math.max(0, 5 - ((S.rpsToday || {}).n || 0)) + '판 남음</em></button></section>';
}
/** 레벨 구간 안내 (참고용) */
function lvGuideHTML() {
  return '<div class="lvg">' + [[1, '1~9'], [10, '10~19'], [20, '20~29'], [30, '30~39'], [40, '40~49'], [50, '50']].map(([l, r]) => '<div>' + lvEmblem(l, 54) + '<b>' + window.Core.lvBand(l).name + '</b><small>LV ' + r + '</small>' + lvPill(l) + '</div>').join('') + '</div>';
}
function openLvGuide() {
  sheet('<h2>레벨 구간</h2><div class="muted">꾸준히 1년 쓰면 GOAT(50). 구간이 오를 때마다 월계수가 자라고 색이 바뀌어요.</div>' + lvGuideHTML() + '<div class="srow"><button class="pri" id="lgx">닫기</button></div>', (el) => (el.querySelector('#lgx').onclick = () => (el.hidden = true)));
}
function lvRank() {
  return Object.entries(S.profs || {}).filter(([, p]) => p.xp).map(([mid, p]) => ({ mid, name: ((S.pub.members || []).find((m) => m.id === mid) || {}).name, xp: p.xp, lv: p.lv || 1 })).filter((r) => r.name).sort((a, b) => b.xp - a.xp);
}
function openLevel() {
  const parts = xpParts(), L = window.Core.lvOf(myXp()), rk = lvRank().slice(0, 10);
  sheet('<div class="lvtop">' + lvEmblem(L.lv, 96) + '<div><h2>LV.' + L.lv + ' ' + window.Core.lvBand(L.lv).name + '</h2><div class="muted">총 ' + L.xp.toLocaleString() + ' EXP · 꾸준히 1년이면 GOAT(50)</div></div></div>' +
    '<div class="acat">내 EXP 내역</div><table class="xpt">' + parts.filter((p) => p[2]).map((p) => '<tr><td>' + p[0] + '</td><td class="muted">' + p[1] + '</td><td class="' + (p[2] < 0 ? 'n' : 'p') + '">' + (p[2] > 0 ? '+' : '') + p[2].toLocaleString() + '</td></tr>').join('') + '</table>' +
    (rk.length ? '<div class="acat">팀 레벨 순위</div><div class="lvrk">' + rk.map((r, i) => '<div class="' + (r.mid === S.me.mid ? 'me' : '') + '"><span>' + (i + 1) + '</span>' + lvPill(r.lv) + '<b>' + esc(r.name) + '</b><em>' + r.xp.toLocaleString() + '</em></div>').join('') + '</div>' : '') +
    '<div class="acat">레벨 구간</div>' + lvGuideHTML() + '<div class="acat">EXP 얻는 법</div><div class="muted" style="font-size:12.5px;line-height:1.7">하루 접속 +5 · 참석 투표 +10 · 경기 참석 +30 · 골 +10 · 도움 +7 · 하이라이트 댓글 +3 (하루 10개까지) · 투표·공지 참여 +5 · 회비 기한 내 납부 +20 · 업적 브론즈 +20 · 실버 +50 · 골드 +150 · 플래티넘 +500</div>' +
    '<div class="srow"><button class="pri" id="lx">닫기</button></div>', (el) => (el.querySelector('#lx').onclick = () => (el.hidden = true)));
}
/** 레벨 변화 확인 → 팀원에게 보일 값 저장 · 올랐으면 축하 */
function lvSync() {
  if (!A || !S.profs || S.rpsNet === undefined || !S.pollsLoaded || !S.pvLoaded || !S.goals || !S.vcAll) return;   // 기록을 다 불러온 뒤에만 (중간값으로 레벨업 축하가 두 번 뜨지 않게)
  const L = window.Core.lvOf(myXp());
  if (A.lv && L.lv > A.lv) lvCelebrate(A.lv, L.lv);
  if (A.lv !== L.lv) { A.lv = L.lv; achSave(); }
  profPut();
}
function lvCelebrate(from, to) {
  if (S.demo) return;
  const old = document.querySelector('.lvwrap'); if (old) { from = +old.dataset.from; old.remove(); }   // 연달아 오르면 한 장으로
  const b = window.Core.lvBand(to), newBand = window.Core.lvBand(from).name !== b.name, goat = to >= 50;
  const el = document.createElement('div'); el.className = 'apop lvwrap'; el.dataset.from = from;
  el.innerHTML = '<div class="apbox lvpop' + (goat ? ' goat' : '') + '"><i class="ray"></i>' + lvEmblem(to, 140) + '<div class="lu">' + (goat ? 'GOAT' : 'LEVEL UP') + '</div><b>LV.' + to + ' ' + b.name + '</b>' +
    '<span>' + (goat ? '팀에서 가장 꾸준한 사람에게만' : newBand ? b.name + ' 구간 진입! 엠블럼이 바뀌었어요' : 'LV.' + from + ' → LV.' + to) + '</span></div>';
  document.body.appendChild(el); const bye = () => el.remove(); el.onclick = bye; setTimeout(bye, 4000);
}

/* ---------------- 가위바위보 (EXP 걸기 · 하루 5판 · 한 판 최대 100) ---------------- */
const RPS = [['r', '✊', '바위'], ['s', '✌️', '가위'], ['p', '🖐️', '보']];
const todayKey = () => ymd(new Date()).replace(/-/g, '');
function rpsWatch() {
  if (S.rpsSub || !S.me) return;
  S.rpsSub = onSnapshot(query(collection(db, 'clubs', S.cid, 'rps'), where('uid', '==', S.uid)), (q) => {
    const all = q.docs.map((d) => d.data()); S.rpsNet = all.reduce((s, x) => s + (x.net || 0), 0); S.rpsToday = all.find((x) => x.date === todayKey()) || null; lvSync(); if (S.tab === 'home' && !$('#rpsov')) render();
  }, () => { S.rpsNet = 0; });
}
async function openRps() {
  const day = todayKey();
  const top = (await getDocs(query(collection(db, 'clubs', S.cid, 'rps'), where('date', '==', day))).catch(() => ({ docs: [] }))).docs.map((d) => d.data());
  const me = S.rpsToday || { n: 0, w: 0, l: 0, net: 0 }, left = 5 - (me.n || 0), have = myXp();
  const row = (x, i, neg) => '<div><span>' + (i + 1) + '위</span><b>' + lvPill(lvOfMid(x.mid)) + esc(x.name) + '</b><em class="' + (neg ? 'n' : 'p') + '">' + (x.net > 0 ? '+' : '') + x.net + '</em></div>';
  const win = top.filter((x) => x.net > 0).sort((a, b) => b.net - a.net).slice(0, 10), lose = top.filter((x) => x.net < 0).sort((a, b) => a.net - b.net).slice(0, 10);
  sheet('<h2>✊✌️🖐️ 가위바위보</h2><div class="rstat"><div><span>보유 EXP</span><b>' + have.toLocaleString() + '</b></div><div><span>남은 판</span><b>' + left + '/5</b></div>' +
    '<div><span>오늘 승률</span><b>' + (me.w + me.l ? Math.round(me.w / (me.w + me.l) * 100) + '%' : '-') + '</b></div><div><span>오늘 결과</span><b class="' + (me.net < 0 ? 'n' : 'p') + '">' + (me.net > 0 ? '+' : '') + (me.net || 0) + '</b></div></div>' +
    '<div class="rvs"><div><small>' + esc(S.me.name) + '</small><i id="rme">❔</i></div><b class="vs">VS</b><div><small>킥봇</small><i id="rbot">❔</i></div></div><div class="rres" id="rres">' + (left > 0 ? '걸 EXP를 넣고 하나를 고르세요' : '오늘은 다 했어요. 내일 또 만나요!') + '</div>' +
    '<label class="rbet">걸 EXP <input id="rbet" type="number" inputmode="numeric" min="1" max="100" value="' + Math.min(50, Math.max(1, have)) + '"><small>최대 100 · 비기면 횟수 그대로</small></label>' +
    '<div class="rbtns">' + RPS.map(([k, e, l]) => '<button data-rps="' + k + '"' + (left > 0 && have > 0 ? '' : ' disabled') + '><i>' + e + '</i>' + l + '</button>').join('') + '</div>' +
    '<div class="rtop"><div><h3>🔥 오늘의 승부사</h3>' + (win.map((x, i) => row(x, i)).join('') || '<p class="muted">아직 없어요</p>') + '</div><div><h3>💧 오늘의 액땜</h3>' + (lose.map((x, i) => row(x, i, 1)).join('') || '<p class="muted">아직 없어요</p>') + '</div></div>' +
    '<div class="srow"><button id="rx">닫기</button></div>', (el) => {
    el.querySelector('.sbox').id = 'rpsov';
    el.querySelector('#rx').onclick = () => { el.hidden = true; render(); };
    el.querySelectorAll('[data-rps]').forEach((b) => (b.onclick = () => rpsPlay(b.dataset.rps, el)));
  });
}
let rpsBusy = false;
async function rpsPlay(mine, el) {
  if (rpsBusy) return;
  const me = Object.assign({ n: 0, w: 0, l: 0, net: 0 }, S.rpsToday || {}), have = myXp();
  let bet = Math.floor(+el.querySelector('#rbet').value || 0);
  if (me.n >= 5) return toast('오늘 5판을 다 했어요');
  if (bet < 1) return toast('걸 EXP를 넣어주세요');
  bet = Math.min(bet, 100, have);
  rpsBusy = true; el.querySelectorAll('[data-rps]').forEach((b) => (b.disabled = true));
  const bot = RPS[crypto.getRandomValues(new Uint8Array(1))[0] % 3][0], E = (k) => RPS.find((x) => x[0] === k)[1];
  const bi = el.querySelector('#rbot'), last = me.n === 4, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  el.querySelector('#rme').textContent = E(mine);
  // 보통은 빠르게, 마지막 판은 빠칭코처럼 빠르게 돌다가 점점 느려지며 결과가 나옴
  const steps = last ? [...Array(22)].map(() => 55).concat([80, 110, 150, 200, 260, 340, 440, 560, 720, 900]) : [...Array(10)].map(() => 90);
  if (last) { el.querySelector('#rres').innerHTML = '<b class="last">🔥 오늘의 마지막 판!</b>'; bi.classList.add('spin'); }
  let k = 0, cur = 0;
  for (const ms of steps) { cur = k++ % 3; bi.textContent = RPS[cur][1]; await wait(ms); }
  if (last && RPS[cur][0] === bot) { await wait(500); }       // 한 칸 더 넘어갈 듯 말 듯
  bi.textContent = E(bot); bi.classList.remove('spin'); bi.classList.add('hit'); setTimeout(() => bi.classList.remove('hit'), 900);
  const res = mine === bot ? 0 : (mine === 'r' && bot === 's') || (mine === 's' && bot === 'p') || (mine === 'p' && bot === 'r') ? 1 : -1;
  el.querySelector('#rres').innerHTML = res > 0 ? '<b class="p">이겼어요! +' + bet + ' EXP</b>' : res < 0 ? '<b class="n">졌어요 −' + bet + ' EXP</b>' : '<b>비겼어요 · 횟수·EXP 그대로</b>';
  if (res) {
    const nx = { uid: S.uid, mid: S.me.mid, name: S.me.name, date: todayKey(), n: me.n + 1, w: me.w + (res > 0 ? 1 : 0), l: me.l + (res < 0 ? 1 : 0), net: me.net + res * bet, at: Date.now() };
    try { await setDoc(doc(db, 'clubs', S.cid, 'rps', S.uid + '_' + nx.date), nx); S.rpsToday = nx; }
    catch (e) { toast('저장 실패: ' + e.message); logErr('가위바위보 저장 실패: ' + e.message, e.stack); }
  }
  rpsBusy = false; setTimeout(() => { if (!el.hidden) openRps(); }, 1300);
}

/* ---------------- 다음 경기 날씨 (경기가 정해지면 자동 · 6시간마다 새로) ----------------
   서버가 없어서, 6시간이 지난 뒤 앱을 처음 연 사람이 새로 받아와 모두와 나눔 */
const WX_TTL = 6 * 3600e3;
function wxWatch(g) {
  if (!g || S.wxGid === g.id) return;
  if (S.wxSub) S.wxSub(); S.wxGid = g.id; S.wx = null;
  S.wxSub = onSnapshot(doc(db, 'clubs', S.cid, 'wx', g.id), (d) => { S.wx = d.exists() ? d.data() : null; wxRefresh(g); if (S.tab === 'home' || S.tab === 'week') render(); }, () => {});
}
let wxBusy = false;
async function wxRefresh(g) {
  const loc = S.pub.wxLoc || { lat: 35.8714, lon: 128.6014 }, days = (Date.parse(g.date) - Date.now()) / 864e5;
  if (wxBusy || days > 15 || days < -1 || (S.wx && S.wx.date === g.date && S.wx.time === (g.time || '') && Date.now() - S.wx.at < WX_TTL)) return;
  wxBusy = true;
  try { const w = await window.Core.fetchWx(loc.lat, loc.lon, g.date, g.time); await setDoc(doc(db, 'clubs', S.cid, 'wx', g.id), Object.assign(w, { gid: g.id, date: g.date, time: g.time || '', at: Date.now() })); }
  catch (e) { /* 날씨 서버가 잠깐 안 되면 다음에 다시 */ }
  wxBusy = false;
}
function wxLine(g) { try { return wxLine0(g); } catch (e) { logErr('날씨 표시 실패: ' + e.message, e.stack); return ''; } }
function wxLine0(g) {
  const w = S.wx; if (!g) return '';
  if (!w || w.date !== g.date) return (Date.parse(g.date) - Date.now()) / 864e5 > 15 ? '<div class="wx wx-soft">🌤️ 날씨는 경기 15일 전부터 나와요</div>' : '';
  const [ic, lb] = window.Core.wxLabel(w.code), mx = w.mx != null ? w.mx : w.pr, pv = window.Core.playable(mx, w.st || w.code >= 95);
  return '<div class="wx wx-' + pv.lv + '"><span class="wi">' + ic + '</span><div class="wmain"><div class="w1"><b>' + w.t + '°</b><span>' + lb + '</span></div><div class="w2"><span>강수확률 <b>' + w.pop + '%</b></span><span>강수량 <b>' + (mx > 0 ? mx + 'mm/시간' : '비 없음') + '</b></span></div></div>' +
    '<em><b>' + pv.text.split(/ · | \(/)[0] + '</b><i>' + (pv.text.split(/ · | \(/)[1] || '').replace(')', '') + '</i>' + '</em><small>경기 ' + (g.time || '').substr(0, 5) + '부터 2시간 · ' + new Date(w.at).getHours() + '시 업데이트</small></div>';
}

/* ---------------- 앱 개발자에게 건의 · 후원 ---------------- */
function openDev() {
  sheet('<h2>💌 앱 개발자에게 건의</h2><div class="muted">A-KICK 앱을 만든 사람에게 바로 가요. 불편한 점, 있었으면 하는 기능, 오류 무엇이든 좋아요. (우리 팀 운영 얘기는 총무에게)</div>' +
    '<textarea id="dt" rows="5" maxlength="1000" placeholder="예: 경기 기록을 사진으로도 남기고 싶어요"></textarea>' +
    '<div class="srow"><button id="dx">취소</button><button id="dok" class="pri">보내기</button></div>', (el) => {
    el.querySelector('#dx').onclick = () => (el.hidden = true);
    el.querySelector('#dok').onclick = async () => {
      const t = el.querySelector('#dt').value.trim(); if (!t) return toast('내용을 써주세요');
      try {
        await addDoc(collection(db, 'feedback'), { text: t, uid: S.uid, email: S.email || '', cid: S.cid || '', club: (S.club && S.club.name) || '', name: (S.me && S.me.name) || '', at: Date.now(), ver: window.Core.VERSION });
        el.hidden = true; toast('개발자에게 보냈어요. 고마워요 🙏');
      } catch (e) { toast('보내기 실패: ' + e.message); logErr('개발자 건의 실패: ' + e.message, e.stack); }
    };
  });
}
const DONA = '카카오뱅크 3333-15-3268863 (예금주 장은총)';
function openDonate() {
  sheet('<h2>☕ A-KICK 후원</h2><div class="dona"><p>🙏 A-KICK이 팀 운영과 축구하는 일상에 도움이 되셨다면, 원하시는 만큼 후원으로 응원해 주셔도 됩니다.</p>' +
    '<p>🌱 후원은 앱을 계속 다듬고 새 기능을 더하는 데 쓰입니다. 부담 갖지 않으셔도 됩니다. 😊</p><p class="muted">후원 계좌를 남겨둡니다. 마음이 닿을 때, 원하시는 만큼 후원해 주시면 감사히 받겠습니다.</p>' +
    '<div class="acrow"><b>' + DONA + '</b><button id="dcp">복사</button></div></div><div class="srow"><button class="pri" id="dnx">닫기</button></div>', (el) => {
    el.querySelector('#dcp').onclick = () => copy('3333153268863', '계좌번호를 복사했어요 (카카오뱅크 · 장은총)');
    el.querySelector('#dnx').onclick = () => (el.hidden = true);
  });
}
async function showFeedback() {
  const q = await getDocs(query(collection(db, 'feedback'), orderBy('at', 'desc'), limit(100))).catch((e) => { toast('못 불러왔어요: ' + e.message); return null; });
  if (!q) return;
  const rows = q.docs.map((d) => d.data()), txt = rows.map((x) => new Date(x.at).toLocaleString('ko-KR') + ' [' + (x.club || '-') + ' · ' + (x.name || x.email) + ' · ' + x.ver + ']\n' + x.text).join('\n\n');
  sheet('<h2>개발자 건의 ' + rows.length + '건</h2><pre class="errs">' + esc(txt || '아직 없어요') + '</pre><div class="srow"><button id="fx">닫기</button><button class="pri" id="fc">전체 복사</button></div>', (el) => {
    el.querySelector('#fx').onclick = () => (el.hidden = true); el.querySelector('#fc').onclick = () => copy(txt, '복사했어요. Claude에게 붙여넣어 주세요');
  });
}

function kickedView() {
  S.subs.forEach((f) => f()); S.subs = []; S.me = null;
  view('<header class="hero"><div class="hrow"><b>' + esc(clubName()) + '</b></div><h1>팀에서 나가졌어요</h1><p>관리자가 이 계정의 팀 연결을 해제했어요.</p></header><main class="pad lift">' +
    '<section class="card"><p class="muted">잘못된 일이라면 관리자에게 말씀해 주세요. 다시 가입 신청을 할 수도 있어요.</p><button class="bigbtn" id="rejoin">다시 가입 신청하기</button></section>' +
    '<div class="links"><button class="link" id="home">다른 팀 보기</button><button class="link" id="out">로그아웃</button></div></main>');
  $('#rejoin').onclick = () => renderRequest();
  bindCommon();
}
