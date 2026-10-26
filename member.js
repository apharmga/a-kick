import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, deleteUser } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, setDoc, deleteDoc, writeBatch, onSnapshot, query, where, getDocs, addDoc, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
onAuthStateChanged(auth, (u) => { if (!u) return renderLogin(); S.uid = u.uid; S.email = u.email || ''; start(); });
function renderLogin() {
  view('<div class="login"><div class="logo8"><div class="stk">A-KICK</div><div class="pills"><span class="p1">⚽ FUTSAL</span><span class="p2">🥅 FOOTBALL</span></div></div>' +
    '<p class="lt">우리 모임, 오늘도 킥오프!<br><span>참석 투표 · 팀 편성 · 회비 · 장부</span></p>' +
    (INAPP ? '<div class="warn"><b>카카오톡·밴드 안에서는 구글 로그인이 막혀 있어요.</b><br>아래 버튼을 누르면 ' + (/iPhone|iPad/i.test(UA) ? '사파리' : '크롬') + '로 바로 열려요.' +
      '<button id="ext" class="extbtn">' + (/iPhone|iPad/i.test(UA) ? '사파리' : '크롬') + '로 열기</button><button id="cpl" class="lnk">안 열리면 링크 복사</button></div>'
      : '<button class="gbtn" id="in"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>구글로 시작하기</button>' +
        '<small>처음이면 로그인 → 이름 쓰고 가입 신청 → 관리자 승인 후 입장</small>') + LEGAL + '</div>');
  const i = $('#in'); if (i) i.onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => toast(e.code === 'auth/popup-closed-by-user' ? '로그인을 취소했어요' : '로그인 실패: ' + e.message));
  const x = $('#ext'); if (x) x.onclick = openOutside;
  const c = $('#cpl'); if (c) c.onclick = () => copy(location.href, '링크를 복사했어요. 사파리·크롬 주소창에 붙여넣으세요');
}

/* ---------------- 2. 어느 팀인지 ---------------- */
async function start() {
  view('<div class="center">불러오는 중...</div>');
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
  closeVideo(true); markSeen(id);
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
      '<div class="vcm' + (root !== c.id ? ' sub' : '') + '"><div class="vch"><b>' + esc(c.name) + '</b><small>' + new Date(c.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</small>' +
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
  const token = on ? await pushToken() : '';
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

/* ---------------- 탈퇴 · 계정 삭제 ---------------- */
async function wipeMine(cid) {                       // 한 팀 안의 내 흔적 지우기 (이름이 들어간 장부 기록은 관리자 소유라 남음)
  const C = (c) => collection(db, 'clubs', cid, c), del = (q) => getDocs(q).then((r) => Promise.all(r.docs.map((d) => deleteDoc(d.ref).catch(() => {})))).catch(() => {});
  const marks = await getDocs(query(C('anonmark'), where('uid', '==', S.uid))).catch(() => null);
  if (marks) for (const m of marks.docs) { await deleteDoc(doc(db, 'clubs', cid, 'anonvotes', m.data().pid + '__' + m.data().key)).catch(() => {}); }
  await Promise.all([del(query(C('votes'), where('uid', '==', S.uid))), del(query(C('pollvotes'), where('uid', '==', S.uid))),
    del(query(C('goals'), where('by', '==', S.uid))), del(query(C('suggest'), where('uid', '==', S.uid))), del(query(C('vcomments'), where('uid', '==', S.uid)))]);
  if (marks) await Promise.all(marks.docs.map((m) => deleteDoc(m.ref).catch(() => {})));
  const u = await getDoc(doc(db, 'clubs', cid, 'users', S.uid)).catch(() => null);
  if (u && u.exists()) await deleteDoc(doc(db, 'clubs', cid, 'claims', u.data().mid)).catch(() => {});
  await deleteDoc(doc(db, 'clubs', cid, 'push', S.uid)).catch(() => {});
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
      await deleteDoc(doc(db, 'me', S.uid)).catch(() => {});
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
    for (const c of ['members', 'games', 'tx', 'config', 'private', 'pub', 'votes', 'goals', 'polls', 'pollvotes', 'anonvotes', 'anonmark', 'videos', 'vcomments', 'push', 'suggest', 'requests', 'claims', 'users']) {
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
    '<div class="newc"><input id="cn" placeholder="팀 이름 (예: 대구FC)" maxlength="20"><button id="mk">팀 만들기</button></div></section>' + LEGAL + '</main>');
  $('#out').onclick = () => signOut(auth);
  if (S.email === OPERATOR) { $('main').insertAdjacentHTML('beforeend', '<button class="link" id="ops">운영자: 오류 기록 보기</button>'); $('#ops').onclick = showErrs; }
  document.querySelectorAll('[data-cdel]').forEach((b) => (b.onclick = () => (b.dataset.own === '1' ? deleteClub(b.dataset.cdel, all[b.dataset.cdel]) : leaveList(b.dataset.cdel, all[b.dataset.cdel]))));
  $('#mk').onclick = async () => {
    const name = $('#cn').value.trim(); if (!name) return toast('팀 이름을 넣어주세요');
    const cid = Math.random().toString(36).slice(2, 6) + Date.now().toString(36).slice(-4);
    try {
      await setDoc(doc(db, 'clubs', cid), { name, owner: S.uid, created: new Date().toISOString() });
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
function cdHTML(g) {
  const t = dlTs(g);
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
const heroTop = () => '<div class="hrow"><button class="cname" data-gohome>' + HOME + '<b>' + esc(clubName()) + '</b></button><span class="who">' + (S.me ? esc(S.me.name) + ' 님' : '') + adminBtn() + '</span></div>';

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
  document.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.t; if (S.tab === 'week' && teamKey()) markSeen(teamKey()); render(); window.scrollTo(0, 0); }));
  document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.go; render(); window.scrollTo(0, 0); }));
  document.querySelectorAll('[data-vote]').forEach((b) => (b.onclick = () => vote(b.dataset.vote)));
  const acc = $('#acc'); if (acc) acc.onclick = () => copy(accNo(), '계좌번호를 복사했어요');
  const ch = $('#change'); if (ch) ch.onclick = async () => { S.me = null; render(); };
  document.querySelectorAll('[data-gadd]').forEach((b) => (b.onclick = () => openGoal(b.dataset.gadd)));
  document.querySelectorAll('[data-gdel]').forEach((b) => (b.onclick = async () => { if (confirm('이 골 기록을 지울까요?')) await deleteDoc(CD('goals', b.dataset.gdel)).catch((e) => toast('삭제 실패: ' + e.message)); }));
  document.querySelectorAll('[data-sort]').forEach((h) => (h.onclick = () => { const [tb, k] = h.dataset.sort.split(':'), st = S.sort[tb] || {}; S.sort[tb] = st.k === k ? { k, d: ((st.d || 0) + 1) % 3 } : { k, d: 1 }; render(); }));
  document.querySelectorAll('[data-poll]').forEach((b) => (b.onclick = () => openPoll(b.dataset.poll)));
  document.querySelectorAll('[data-vid]').forEach((b) => (b.onclick = () => openVideo(b.dataset.vid)));
  const sg = $('#sug'); if (sg) sg.onclick = openSuggest;
  autoPopup();
  const sy = $('#sym'); if (sy) sy.onchange = (e) => { S.sym = e.target.value; render(); };
  const pw = $('#pw'); if (pw) pw.onclick = () => { S.wk = (S.wk || 0) - 1; render(); };
  const nw = $('#nw'); if (nw) nw.onclick = () => { S.wk = (S.wk || 0) + 1; render(); };
  bindCommon();
}
function bindCommon() {
  const h = $('#home'); if (h) h.onclick = () => { S.subs.forEach((f) => f()); S.subs = []; S.cid = ''; history.replaceState(null, '', './'); renderHome(); };
  const o = $('#out'); if (o) o.onclick = () => signOut(auth);
  const lv = $('#leave'); if (lv) lv.onclick = openLeave;
  const nf = $('#ntf'); if (nf) nf.onclick = openNotify;
  const it = $('#inst'); if (it) it.onclick = async () => { installEv.prompt(); await installEv.userChoice.catch(() => {}); installEv = null; render(); };
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
  S.votes[S.me.name] = data; render();
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
    return '<div class="ptok" style="left:' + p[1] + '%;top:' + top + '%"><span class="dot ' + cls + (n === S.me.name ? ' me' : '') + '"></span><span class="pn">' + esc(n) + (i === 0 ? ' <i>GK</i>' : '') + '</span></div>';
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
    '<section class="card"><h2>이번 주 참석할까요?</h2>' + cdHTML(g) + '<div class="vote">' +
    '<button data-vote="참석" class="' + (amIn ? 'on' : '') + '"' + (lk ? ' disabled' : '') + '>참석</button>' +
    '<button data-vote="불참" class="' + (!amIn && mine && mine.v === '불참' ? 'on no' : '') + '"' + (lk ? ' disabled' : '') + '>불참</button></div>' +
    '<div class="cnt"><span>지금 <b>' + total + '명</b> · 회원 ' + att.length + ' + 게스트 ' + (g.guests || []).length + '</span><em class="' + (total >= minN() ? 'ok' : 'low') + '">' + status + '</em></div>' +
    '<div class="names">' + att.map((n) => '<span class="' + (n === S.me.name ? 'me' : '') + '">' + esc(n) + '</span>').join('') + ((g.guests || []).length ? '<span class="g">게스트 ' + g.guests.length + '명</span>' : '') + '</div></section>' +
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
    const st = amIn ? ['in', '참석'] : mine && mine.v === '불참' ? ['out', '불참'] : ['none', '아직 응답 안 함'];
    gcard = '<section class="card nextg"><div class="h2row"><span class="lbl">다음 경기</span><span class="mystat ' + st[0] + '">나: ' + st[1] + '</span></div>' +
      '<div class="ng-date">' + md(g.date) + ' <small>(' + day(g.date) + ')</small> ' + esc(g.time) + '</div>' +
      '<div class="ng-sub">' + esc(S.pub.place || '') + (S.pub.place ? ' · ' : '') + '지금 <b>' + total + '명</b> · ' + sideTxt(total) + '</div>' +
      cdHTML(g) +
      (lk ? '' : '<div class="vote sm"><button data-vote="참석" class="' + (amIn ? 'on' : '') + '">참석</button><button data-vote="불참" class="' + (st[0] === 'out' ? 'on no' : '') + '">불참</button></div>') +
      '<button class="more" data-go="week">참석 명단 · 팀 편성 보기 ›</button></section>';
  }
  const tile = (go, lbl, val, sub, cls) => '<button class="tile ' + (cls || '') + '" data-go="' + go + '"><span>' + lbl + '</span><b>' + val + '</b><small>' + sub + '</small></button>';
  const recent = txs.slice(-3).reverse();
  return '<header class="hero home">' + heroTop() + '<h1>안녕하세요, ' + esc(S.me.name) + ' 님 👋</h1><p>' + esc(clubName()) + '에 오신 걸 환영해요</p></header>' +
    '<main class="pad lift">' + gcard + pollsCard() + vidsHome() + installCard() +
    '<div class="tiles">' +
    tile('dues', mon(d.ym) + ' 회비', !due ? '대상 아님' : paid ? '납부 완료' : '미납', won(d.fee) + '원 · 납부 ' + d.paid.length + '/' + (d.paid.length + d.unpaid.length) + '명', !due ? '' : paid ? 'ok' : 'bad') +
    tile('bank', '통장 잔액', won(bal) + '원', '입출금 전부 공개') +
    tile('rec', '내 기록', (myStat().g) + '골 ' + (myStat().a) + '도움', '참석 ' + r.came + '회 · ' + rate + '%') +
    tile('week', '팀 편성', g && (g.teams || []).length >= 2 ? '공개됨' : '준비 중', g ? md(g.date) + ' 경기' : '-') + '</div>' +
    (recent.length ? '<section class="card"><div class="h2row"><h2>최근 입출금</h2><button class="more inl" data-go="bank">전체 ›</button></div><div class="blist">' + recent.map((t) =>
      '<div class="brow' + (t.off ? ' off' : '') + '"><span class="bd">' + md(t.dt.substr(0, 10)) + '</span><span class="bw"><b>' + esc(t.who) + '</b><small>' + esc(t.off ? '장부 제외' : t.what + (t.pend ? ' · 통장 확인 전' : '')) + '</small></span><span class="ba"><b class="' + (t.io ? 'p' : 'n') + '">' + (t.io ? '+' : '−') + won(t.amt) + '</b></span></div>').join('') + '</div></section>' : '') +
    '<button class="sugbtn" id="sug">💬 관리자에게 건의하기</button>' +
    (S.owner ? '<a class="bigbtn" href="admin.html?c=' + esc(S.cid) + '">관리자 페이지</a>' : '') +
    '<div class="links"><button class="link" id="home">다른 팀 보기</button><button class="link" id="out">로그아웃</button><button class="link" id="leave">탈퇴</button><button class="link" id="ntf">🔔 알림</button></div><div class="links"><a class="link" href="privacy.html">개인정보처리방침</a><a class="link" href="terms.html">이용약관</a></div></main>';
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
    return '<button class="pitem' + (open && !mine ? ' glow' : '') + '" data-poll="' + esc(p.id) + '"><span><b>' + esc(p.title) + (isNewPoll(p) ? NEWB : '') + '</b><small>' + (open ? (p.deadline ? md(p.deadline.substr(0, 10)) + ' ' + p.deadline.substr(11, 5) + ' 마감' : '진행 중') : '마감됨') + '</small></span>' +
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
      (p.deadline ? '<div class="muted">' + md(p.deadline.substr(0, 10)) + '(' + day(p.deadline.substr(0, 10)) + ') ' + p.deadline.substr(11, 5) + ' 마감</div>' : '') +
      (notice ? '' : '<div class="muted">' + (p.multi ? '여러 개 고를 수 있어요' : '하나만 골라주세요') + (p.anon ? ' · 누가 뭘 골랐는지 아무에게도 안 보여요' : '') + '</div><div class="popts">' + opts.map((o) =>
        '<button class="popt' + (picks.has(o.id) ? ' on' : '') + '" data-o="' + esc(o.id) + '"' + (open ? '' : ' disabled') + '><span>' + esc(o.text) + '</span>' + (show ? '<b>' + o.who.length + '</b><i style="width:' + (o.who.length / mx * 100) + '%"></i>' : '') + '</button>' +
        (show && o.who.length && !p.anon ? '<small class="pwho">' + esc(o.who.join(', ')) + '</small>' : '')).join('') + '</div>' +
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
  sheet('<h2>💬 관리자에게 건의하기</h2><div class="muted">관리자만 볼 수 있어요. 회원 화면에는 안 나와요.</div>' +
    '<textarea id="st" rows="5" maxlength="1000" placeholder="예: 경기 시간을 30분 당기면 어떨까요?"></textarea>' +
    '<label class="chk2"><input type="checkbox" id="sa"> 이름 빼고 보내기 (익명)</label>' +
    '<div class="srow"><button id="sx">취소</button><button id="sok" class="pri">보내기</button></div>', (el) => {
    el.querySelector('#sx').onclick = () => (el.hidden = true);
    el.querySelector('#sok').onclick = async () => {
      const t = el.querySelector('#st').value.trim(); if (!t) return toast('내용을 써주세요');
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try { await setDoc(CD('suggest', id), { text: t, name: S.me.name, anon: el.querySelector('#sa').checked, uid: S.uid, at: Date.now() }); el.hidden = true; toast('보냈어요. 고마워요 🙏'); }
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
    (gs.length ? gs.map((x) => '<div class="gli"><span>⚽ <b>' + esc(x.scorer) + '</b>' + (x.assist ? ' <small>도움 ' + esc(x.assist) + '</small>' : '') + '</span>' + (x.by === S.uid || S.owner ? '<button class="x" data-gdel="' + esc(x.id) + '" aria-label="삭제">✕</button>' : '') + '</div>').join('') : '<div class="muted" style="padding:6px 0">아직 기록이 없어요</div>') +
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
    '<div class="dots">' + r.last.map((x) => '<span class="' + (x ? 'on' : '') + '"></span>').join('') + '</div></section>' +
    '<section class="card"><div class="h2row"><h2>골·도움 순위</h2><select id="sym"><option value="">전체 기간</option>' + yms.map((y) => '<option value="' + y + '"' + (y === S.sym ? ' selected' : '') + '>' + y.substr(0, 4) + '년 ' + mon(y) + '</option>').join('') + '</select></div>' +
    '<div class="muted" style="margin-top:4px">제목을 누르면 기본 → 내림차순 → 오름차순</div>' +
    '<table class="stab"><thead><tr>' + th('name', '이름') + th('gp', '경기') + th('g', '골') + th('a', '도움') + th('ap', '공격P') + '</tr></thead><tbody>' +
    sortRows(rows, 'st').map((x) => '<tr class="' + (x.name === S.me.name ? 'me' : '') + '"><td>' + esc(x.name) + '</td><td>' + x.gp + '</td><td>' + x.g + '</td><td>' + x.a + '</td><td><b>' + x.ap + '</b></td></tr>').join('') + '</tbody></table></section>' +
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
