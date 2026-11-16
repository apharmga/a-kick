/* A-KICK 게스트 매칭 (게스트 화면)
 * 인원이 모자란 모임이 올린 "게스트 구해요" 글을 동네·요일·분위기로 찾아 신청한다.
 * 수락 → 3시간 안에 입금(수락을 처음 본 때부터, 경기 3시간 전이면 마감) → 전날 확인 → 경기 뒤 출석/노쇼 기록.
 * 서버 없이(무료 요금제) 동작: 기한 지남·대기자 올리기는 화면을 열 때 계산한다. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, getDoc as _getDoc, getDocs as _getDocs, setDoc as _setDoc, addDoc as _addDoc, deleteDoc as _deleteDoc, query, where, orderBy, limit, getCountFromServer } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { IOS_APP, nativeSignIn, signInButtons, scheduleAlarms } from './native.js';
import { demoMatch } from './demo.js';

const DEMO = new URLSearchParams(location.search).get('demo') === '1';
const fb = initializeApp({
  apiKey: 'AIzaSyBZps4AWzRrf07yzSuIgydRO_Dn2qGrx9E',
  authDomain: 'a-futsal.firebaseapp.com',
  projectId: 'a-futsal',
  storageBucket: 'a-futsal.firebasestorage.app',
  messagingSenderId: '873470138264',
  appId: '1:873470138264:web:121893883d55576c577ded'
});
const auth = getAuth(fb), db = getFirestore(fb);

/* 체험 모드(?demo=1): 메모리 속 샘플로 읽고 씀 */
const MEM = DEMO ? demoMatch() : null;
const pathOf = (r) => r.path;
const snap = (p) => ({ id: p.split('/').pop(), exists: () => !!MEM[p], data: () => (MEM[p] ? JSON.parse(JSON.stringify(MEM[p])) : undefined) });
const getDoc = (r) => (DEMO ? Promise.resolve(snap(pathOf(r))) : _getDoc(r));
const setDoc = (r, d, o) => { if (!DEMO) return _setDoc(r, d, o); MEM[r.path] = o && o.merge ? Object.assign({}, MEM[r.path] || {}, d) : d; return Promise.resolve(); };
const addDoc = (c, d) => (DEMO ? ((MEM[c.path + '/x' + Date.now()] = d), Promise.resolve()) : _addDoc(c, d));
/** 체험 모드용 간단 조회: col + [필드, 값] 같음 조건만 */
function memQ(col, eq) {
  return Object.keys(MEM).filter((k) => k.indexOf(col + '/') === 0 && k.slice(col.length + 1).indexOf('/') < 0)
    .filter((k) => !eq || eq.every(([f, v]) => MEM[k][f] === v)).map(snap);
}

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => String(Math.round(Math.abs(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const md = (d) => (+d.substr(5, 2)) + '/' + (+d.substr(8, 2));
const dayN = (d) => '일월화수목금토'[new Date(d + 'T00:00:00').getDay()];
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const H = 3600e3;
let tT = null;
function toast(m, ms) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tT); tT = setTimeout(() => (t.hidden = true), ms || 2800); }
const store = { get: (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

const FAC = { park: '🅿️ 주차', shoe: '👟 풋살화 대여', vest: '🦺 조끼 제공', ball: '⚽ 공 제공', shower: '🚿 샤워실', indoor: '🏠 실내' };
const facOf = (p) => (p.fac || []).filter((k) => FAC[k]);
export const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const S = { uid: '', name: '', posts: [], apps: {}, stats: null, region: store.get('akick_mregion', '대구'), when: 'all', mood: '', need: [], seg: 'g', blocked: [], loaded: false };

/* ---------- 기한 계산 (총무 화면과 같은 규칙) ---------- */
const C = window.Core;
const startOf = C.gmStart, payDue = C.gmPayDue, left = C.gmLeft;
/** 기한 지남 + 총무가 취소 처리한 것도 같이 본다 */
const expired = (a, p) => C.gmExpired(a, p) || !!a.exp;

/* ---------- 시작 ---------- */
onAuthStateChanged(auth, async (u) => {
  if (DEMO) { S.uid = 'demo-guest'; S.name = '체험 게스트'; } else if (u) { S.uid = u.uid; S.name = u.displayName || ''; } else S.uid = '';
  await load(); render();
});
async function load() {
  const t = ymd(new Date());
  try {
    const q = DEMO ? memQ('gposts') : (await _getDocs(query(collection(db, 'gposts'), where('date', '>=', t), orderBy('date'), limit(300)))).docs;
    S.posts = q.map((d) => Object.assign({ id: d.id }, d.data())).filter((p) => p.date >= t);
  } catch (e) { S.posts = []; toast('목록을 못 불러왔어요: ' + e.message, 5000); }
  S.apps = {}; S.stats = null; S.blocked = [];
  if (S.uid) {
    try {
      const q = DEMO ? memQ('gapps', [['uid', S.uid]]) : (await _getDocs(query(collection(db, 'gapps'), where('uid', '==', S.uid)))).docs;
      q.forEach((d) => { const a = d.data(); S.apps[a.pid] = a; });
      const b = await getDoc(doc(db, 'gblock', S.uid)); S.blocked = (b.exists() && b.data().cids) || [];
      S.stats = await statsOf(S.uid);
    } catch (e) { toast('내 신청을 못 불러왔어요: ' + e.message, 5000); }
    // 내 신청인데 목록에 없는 글(지난 경기·마감)도 보이게
    for (const pid of Object.keys(S.apps)) if (!S.posts.some((p) => p.id === pid)) {
      const s = await getDoc(doc(db, 'gposts', pid)).catch(() => null); if (s && s.exists()) S.posts.push(Object.assign({ id: pid, _old: true }, s.data()));
    }
    await markSeen();
  }
  S.loaded = true;
}
/** 참여·노쇼 횟수 (총무가 경기 뒤 "왔어요/안 왔어요"로 남긴 기록) */
export async function statsOf(uid) {
  if (DEMO) { const L = memQ('gstats/' + uid + '/log').map((d) => d.data()); return { a: L.filter((x) => x.v === 'a').length, x: L.filter((x) => x.v === 'x').length }; }
  const c = collection(db, 'gstats', uid, 'log');
  const [a, x] = await Promise.all([getCountFromServer(query(c, where('v', '==', 'a'))), getCountFromServer(query(c, where('v', '==', 'x')))]);
  return { a: a.data().count, x: x.data().count };
}
/** 수락된 걸 처음 본 순간 기록 → 이때부터 입금 3시간 */
async function markSeen() {
  for (const a of Object.values(S.apps)) {
    const p = S.posts.find((x) => x.id === a.pid);
    if (a.state === 'ok' && !a.seenAt && p && !expired(a, p)) {
      a.seenAt = Date.now();
      await setDoc(doc(db, 'gapps', a.pid + '__' + S.uid), { seenAt: a.seenAt }, { merge: true }).catch(() => {});
      toast('🎉 수락됐어요! 3시간 안에 참가비를 보내주세요', 5000);
    }
    if (a.state === 'ok' && p && IOS_APP && !a.conf) {   // 아이폰 앱: 전날 저녁 8시 확인 알림
      const at = new Date(p.date + 'T20:00:00'); at.setDate(at.getDate() - 1);
      scheduleAlarms('gm_' + a.pid, [{ at, title: '내일 ' + (p.time || '') + ' ' + (p.club || '') + ' 게스트', body: '오시는 거 맞죠? 앱에서 [갈게요]를 눌러주세요' }]).catch(() => {});
    }
  }
}

/* ---------- 화면 ---------- */
function view(h) { $('#app').innerHTML = h; }
function filtered() {
  const now = Date.now(), t = new Date(), wd = (d) => new Date(d + 'T00:00:00').getDay();
  const weekEnd = ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + ((7 - t.getDay()) % 7)));
  return S.posts.filter((p) => !p._old && p.status === 'open' && startOf(p) - 3 * H > now && S.blocked.indexOf(p.cid) < 0 && p.region1 === S.region)
    .filter((p) => S.when === 'all' || (S.when === 'week' && p.date <= weekEnd) || (S.when === 'sat' && wd(p.date) === 6) || (S.when === 'sun' && wd(p.date) === 0) || (S.when === 'night' && wd(p.date) > 0 && wd(p.date) < 6 && (p.time || '') >= '18:00'))
    .filter((p) => !S.mood || p.mood === S.mood)
    .filter((p) => S.need.every((k) => facOf(p).indexOf(k) >= 0))
    .sort((a, b) => startOf(a) - startOf(b));
}
function dLabel(p) {
  const days = Math.round((new Date(p.date + 'T00:00:00') - new Date(ymd(new Date()) + 'T00:00:00')) / 864e5);
  return days === 0 ? ['오늘', 'd'] : days === 1 ? ['내일', 'd'] : ['D-' + days, 'd b'];
}
function postCard(p) {
  const [dl, dc] = dLabel(p), ok = p.okN || 0, a = S.apps[p.id];
  return '<button class="gc" data-p="' + esc(p.id) + '"><div class="t"><div><div class="when">' + md(p.date) + '(' + dayN(p.date) + ') ' + esc(p.time || '') + '</div><div class="where">' + esc(p.place || '') + ' · ' + esc(p.region2 || p.region1) + '</div></div><span class="' + dc + '">' + dl + '</span></div>' +
    '<div class="meta"><span class="pill need">' + Math.max(0, p.need - ok) + '명 구해요</span><span class="pill fee">' + won(p.fee) + '원</span><span class="pill">' + esc(p.mood || '') + '</span>' + (p.pos && p.pos !== '무관' ? '<span class="pill">' + esc(p.pos) + '</span>' : '') + (a ? '<span class="pill me">내 신청: ' + stateText(a, p) + '</span>' : '') + '</div>' +
    (facOf(p).length ? '<div class="fac">' + facOf(p).map((k) => '<span>' + FAC[k] + '</span>').join('') + '</div>' : '') +
    '<div class="bar2"><i style="width:' + Math.min(100, Math.round((ok / Math.max(1, p.need)) * 100)) + '%"></i></div>' +
    '<div class="club"><span class="av">' + esc((p.club || '?')[0]) + '</span>' + esc(p.club || '') + ' · ' + (p.games ? '경기 ' + p.games + '회 진행' : '새 모임') + (p.guestsGot ? ' · 게스트 ' + p.guestsGot + '명 받음' : '') + '</div></button>';
}
function stateText(a, p) {
  if (a.exp || (a.state === 'ok' && expired(a, p))) return '입금 기한 지나 취소';
  if (a.state === 'ok') return a.paid ? '확정' : a.paidClaim ? '입금 확인 중' : '수락 · 입금 대기';
  return { req: '신청 중', wl: '대기', no: '이번엔 어려워요', cancel: '취소함' }[a.state] || a.state;
}
function myBox() {
  const now = Date.now();
  const mine = Object.values(S.apps).map((a) => ({ a, p: S.posts.find((x) => x.id === a.pid) })).filter((x) => x.p && startOf(x.p) + 6 * H > now && (x.a.state !== 'cancel' || x.a.exp) && x.a.state !== 'no')
    .sort((x, y) => startOf(x.p) - startOf(y.p));
  if (!mine.length) return '';
  return '<section class="mine"><div class="lbl">내 신청</div>' + mine.map(({ a, p }) => {
    let act = '';
    if (a.state === 'ok' && !expired(a, p)) {
      if (!a.paid && !a.paidClaim) act = '<div class="pay"><b>⏰ ' + left(payDue(a, p) - now) + ' 안에 ' + won(p.fee) + '원 입금</b><span>입금 계좌는 눌러서 확인 · 입금자명: ' + esc(a.payer || a.name) + '</span><button class="sbtn ok" data-paid="' + esc(p.id) + '">입금했어요</button></div>';
      else if (!a.paid) act = '<div class="pay soft">입금했다고 알렸어요 · 총무 확인을 기다리는 중</div>';
      const tmr = startOf(p) - now < 36 * H;
      if (tmr && !a.conf) act += '<div class="pay conf"><b>내일(또는 오늘) 오시는 거 맞죠?</b><div class="row"><button class="sbtn ok" data-conf="' + esc(p.id) + '">갈게요</button><button class="sbtn" data-cancel="' + esc(p.id) + '">못 가요</button></div></div>';
      else if (a.conf) act += '<div class="pay soft">✅ 참석 확인 완료</div>';
    }
    if (a.state === 'wl') act = '<div class="pay soft">대기 중이에요. 자리가 나면 자동으로 수락돼요</div>';
    return '<div class="mrow" data-p="' + esc(p.id) + '"><div class="mt"><b>' + md(p.date) + '(' + dayN(p.date) + ') ' + esc(p.time || '') + ' · ' + esc(p.club || '') + '</b><span class="st ' + (a.state === 'ok' && !expired(a, p) ? 'ok' : a.state === 'ok' || a.exp ? 'bad' : 'wait') + '">' + stateText(a, p) + '</span></div>' + act + '</div>';
  }).join('') + '</section>';
}
function render() {
  if (!S.loaded) return view('<div class="center">불러오는 중...</div>');
  const list = S.seg === 'g' ? filtered() : [];
  const chip = (k, v, l) => '<button class="chip' + (S[k] === v ? ' on' : '') + '" data-' + k + '="' + v + '">' + l + '</button>';
  view((DEMO ? '<div class="demob">👀 체험 화면 · 저장되지 않아요 <a href="match.html">나가기</a></div>' : '') +
    '<header class="hd"><a class="bk" href="./" aria-label="홈">‹</a><b>게스트 매칭</b><label class="rg">📍 <select id="rg">' + REGIONS.map((r) => '<option' + (r === S.region ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></label></header>' +
    '<div class="seg"><button class="' + (S.seg === 'g' ? 'on' : '') + '" data-seg="g">게스트 구해요</button><button class="' + (S.seg === 'f' ? 'on' : '') + '" data-seg="f">구장 양도</button><button class="' + (S.seg === 't' ? 'on' : '') + '" data-seg="t">팀 매칭</button></div>' +
    (S.seg !== 'g' ? '<div class="soon"><b>' + (S.seg === 'f' ? '구장 양도' : '팀 매칭') + '는 곧 열려요</b><p>게스트 매칭을 먼저 다듬고 이어서 열게요.</p></div>' :
      (S.uid ? myBox() : '<section class="login"><b>신청하려면 로그인하세요</b><p>구글 계정 하나면 돼요. 모임에 가입하지 않아도 신청할 수 있어요.</p><div id="lgbox"><button class="btn" id="in">구글로 시작하기</button></div></section>') +
      '<div class="flt">' + chip('when', 'all', '전체') + chip('when', 'week', '이번 주') + chip('when', 'sat', '토') + chip('when', 'sun', '일') + chip('when', 'night', '평일 저녁') + '</div>' +
      '<div class="flt">' + ['park', 'shoe', 'vest', 'shower'].map((k) => '<button class="chip' + (S.need.indexOf(k) >= 0 ? ' on' : '') + '" data-need="' + k + '">' + FAC[k] + '</button>').join('') + '</div>' +
      '<div class="flt">' + chip('mood', '', '분위기 전체') + chip('mood', '즐겜', '즐겜') + chip('mood', '적당히', '적당히') + chip('mood', '빡겜', '빡겜') + '</div>' +
      '<main class="bd">' + (list.length ? list.map(postCard).join('') : '<div class="empty"><b>' + esc(S.region) + '에 ' + (S.need.length || S.mood || S.when !== 'all' ? '조건에 맞는' : '지금 올라온') + ' 모집이 없어요</b><p>총무라면 A-KICK 관리자 화면 → 이번 주 경기 → <b>🤝 게스트 모집</b>으로 올릴 수 있어요.</p></div>') + '</main>') +
    (S.uid && S.stats ? '<p class="mystat">내 기록: 게스트 참여 ' + S.stats.a + '회 · 노쇼 ' + S.stats.x + '회 · <button class="lnk" id="wipe">매칭 기록 지우기</button></p>' : ''));
  bind();
  const w = $('#wipe'); if (w) w.onclick = wipeMine;
}
function bind() {
  const rg = $('#rg'); if (rg) rg.onchange = () => { S.region = rg.value; store.set('akick_mregion', S.region); render(); };
  document.querySelectorAll('[data-seg]').forEach((b) => (b.onclick = () => { S.seg = b.dataset.seg; render(); }));
  document.querySelectorAll('[data-when]').forEach((b) => (b.onclick = () => { S.when = b.dataset.when; render(); }));
  document.querySelectorAll('[data-need]').forEach((b) => (b.onclick = () => { const k = b.dataset.need, i = S.need.indexOf(k); if (i >= 0) S.need.splice(i, 1); else S.need.push(k); render(); }));
  document.querySelectorAll('[data-mood]').forEach((b) => (b.onclick = () => { S.mood = b.dataset.mood; render(); }));
  document.querySelectorAll('[data-p]').forEach((b) => (b.onclick = (e) => { if (e.target.closest('button[data-paid],button[data-conf],button[data-cancel]')) return; openPost(b.dataset.p); }));
  document.querySelectorAll('[data-paid]').forEach((b) => (b.onclick = () => paidClaim(b.dataset.paid)));
  document.querySelectorAll('[data-conf]').forEach((b) => (b.onclick = () => confirmGo(b.dataset.conf)));
  document.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = () => cancelApp(b.dataset.cancel)));
  const i = $('#in'); if (i) { i.onclick = login; if (IOS_APP) iosLogin(); }
}
async function login() {
  const ua = navigator.userAgent, url = location.href;
  if (/KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|BAND\//i.test(ua)) {   // 앱 안 브라우저: 바깥 브라우저로 바로 열기 시도
    if (/KAKAOTALK/i.test(ua)) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    else location.href = './';   // 첫 화면의 '이메일로 시작하기'로 앱 안에서 바로 로그인 → 홈의 게스트 매칭으로 돌아옴
    return;
  }
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { toast(e.code === 'auth/popup-closed-by-user' ? '로그인을 취소했어요' : '로그인 실패: ' + e.message); }
}
async function iosLogin() {
  const box = $('#lgbox'); box.innerHTML = await signInButtons();
  const go = (w) => async () => { try { await nativeSignIn(auth, w); } catch (e) { toast('로그인 실패: ' + (e.message || e)); } };
  const a = box.querySelector('#in-apple'), g = box.querySelector('#in-google'); if (a) a.onclick = go('apple'); if (g) g.onclick = go('google');
}

/* ---------- 글 보기 · 신청 ---------- */
function sheet(html, onMount) {
  const el = $('#sheet'); el.innerHTML = '<div class="sbox">' + html + '</div>'; el.hidden = false;
  el.onclick = (e) => { if (e.target === el) el.hidden = true; }; onMount && onMount(el);
}
async function openPost(pid) {
  const p = S.posts.find((x) => x.id === pid); if (!p) return;
  const a = S.apps[pid], ok = a && a.state === 'ok' && !expired(a, p);
  let priv = null;
  if (ok) { const s = await getDoc(doc(db, 'gposts', pid, 'priv', 'info')).catch(() => null); priv = s && s.exists() ? s.data() : null; }
  const full = (p.okN || 0) >= p.need, rookieBlock = p.firstOk === false && S.stats && S.stats.a === 0;
  const mineP = S.uid && p.owner === S.uid;
  const canApply = S.uid && !mineP && (!a || (a.state === 'cancel' && !a.exp)) && p.status === 'open' && !p._old;
  sheet('<div class="phero"><div class="when">' + md(p.date) + '(' + dayN(p.date) + ') ' + esc(p.time || '') + '</div><div class="where">' + esc(p.place || '') + ' · ' + esc(p.region1) + ' ' + esc(p.region2 || '') + '</div>' +
    '<div class="meta"><span class="pill">' + Math.max(0, p.need - (p.okN || 0)) + '명 구해요</span><span class="pill">' + won(p.fee) + '원</span><span class="pill">' + esc(p.mood) + '</span><span class="pill">포지션 ' + esc(p.pos || '무관') + '</span></div></div>' +
    '<div class="card"><div class="lbl">이 모임은요</div><div class="kv"><span>모임</span><b>' + esc(p.club) + '</b></div>' + (p.style ? '<div class="kv"><span>방식</span><b>' + esc(p.style) + '</b></div>' : '') +
    '<div class="trust"><div><b>' + (p.games || 0) + '</b><span>진행한 경기</span></div><div><b>' + (p.guestsGot || 0) + '</b><span>받은 게스트</span></div><div><b>' + (p.need) + '</b><span>이번에 구하는 인원</span></div></div>' +
    '<div class="kv"><span>구장 시설</span><b>' + (facOf(p).length ? facOf(p).map((k) => FAC[k]).join(' · ') : '정보 없음') + '</b></div>' +
    (p.note ? '<p class="note">' + esc(p.note) + '</p>' : '') + (p.refund ? '<p class="note"><b>환불 규칙</b> · ' + esc(p.refund) + '</p>' : '') + '</div>' +
    (ok ? '<div class="card okc"><div class="lbl">🎉 수락됐어요</div>' + (priv && priv.account ? '<div class="kv"><span>입금 계좌</span><b>' + esc(priv.account) + '</b></div><button class="sbtn" id="cpa">계좌 복사</button>' : '<p class="note">입금 계좌는 총무에게 물어봐 주세요.</p>') +
      (priv && priv.contact ? '<div class="kv"><span>총무 연락</span><b>' + (/^https?:\/\//.test(priv.contact) ? '<a href="' + esc(priv.contact) + '" target="_blank" rel="noopener">오픈채팅 열기</a>' : esc(priv.contact)) + '</b></div>' : '') +
      '<div class="kv"><span>입금자명</span><b>' + esc(a.payer || a.name) + '</b></div><p class="note">입금자명이 같아야 총무 장부에 자동으로 잡혀요.</p></div>' : '') +
    (canApply ? (rookieBlock ? '<div class="card warnc">이 모임은 게스트 첫 참여는 받지 않아요. 다른 모임에서 한 번 참여한 뒤 신청할 수 있어요.</div>' :
      '<div class="card"><div class="lbl">신청서</div><label class="f">이름 (총무에게 보여요)<input id="an" maxlength="12" value="' + esc((a && a.name) || S.name || '') + '"></label>' +
      '<label class="f">입금자명 (통장에 찍힐 이름)<input id="ap" maxlength="12" value="' + esc((a && a.payer) || S.name || '') + '"></label>' +
      '<label class="f">연락처 (선택 · 수락되면 총무만 봐요)<input id="ac" maxlength="20" inputmode="tel" value="' + esc((a && a.phone) || '') + '"></label>' +
      '<label class="f">총무에게 한마디 (선택)<input id="am" maxlength="60" placeholder="예: 30대, 주 1회 공 차요. 포지션 상관없어요"></label>' +
      (full ? '<p class="note warn">정원이 찼어요. 지금 신청하면 대기로 들어가고, 자리가 나면 수락돼요.</p>' : '') +
      '<p class="note">수락되면 <b>수락을 확인한 때부터 3시간 안에</b> 참가비를 보내야 확정돼요. 경기 3시간 전에는 자동 마감돼요.</p>' +
      '<button class="btn" id="go">' + (full ? '대기 신청하기' : '참가 신청하기') + '</button></div>')
      : mineP ? '<div class="card"><p class="note">내가 올린 모집글이에요. 신청 관리는 <a href="admin.html?c=' + encodeURIComponent(p.cid) + '">관리자 화면</a> → 이번 주 경기 → 🤝 게스트 모집에서 해요.</p></div>'
      : !S.uid ? '<div class="card"><p class="note">신청하려면 먼저 로그인해 주세요.</p></div>'
      : a && a.state !== 'cancel' && !ok ? '<div class="card"><div class="kv"><span>내 신청</span><b>' + stateText(a, p) + '</b></div>' + (a.state === 'req' || a.state === 'wl' ? '<button class="sbtn" data-cancel="' + esc(pid) + '">신청 취소</button>' : '') + '</div>' : '') +
    '<div class="rep"><button class="lnk" id="rp">🚩 이 글 신고하기</button> · <button class="lnk" id="bl">🚫 이 모임 안 보기</button></div>' +
    '<button class="btn sec" id="sx">닫기</button>', (el) => {
    el.querySelector('#sx').onclick = () => (el.hidden = true);
    const cp = el.querySelector('#cpa'); if (cp) cp.onclick = () => navigator.clipboard.writeText(priv.account).then(() => toast('계좌를 복사했어요'), () => prompt('복사해서 쓰세요', priv.account));
    const go = el.querySelector('#go'); if (go) go.onclick = () => apply(p, el, full);
    const ph = el.querySelector('#ac'); if (ph) { const f = () => (ph.value = telFmt(ph.value)); ph.oninput = f; f(); }
    const c = el.querySelector('[data-cancel]'); if (c) c.onclick = () => cancelApp(pid);
    el.querySelector('#rp').onclick = () => report(p);
    el.querySelector('#bl').onclick = () => block(p);
  });
}
/** 전화번호에 하이픈 자동: 01012345678 → 010-1234-5678 (숫자가 아니면 그대로) */
function telFmt(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!d || /[^\d\s-]/.test(v)) return v;
  if (d.startsWith('02')) return d.length <= 2 ? d : d.length <= 5 ? d.slice(0, 2) + '-' + d.slice(2) : d.length <= 9 ? d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5) : d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6, 10);
  return d.length <= 3 ? d : d.length <= 6 ? d.slice(0, 3) + '-' + d.slice(3) : d.length <= 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7, 11);
}
async function apply(p, el, full) {
  if (!S.uid) return toast('먼저 로그인해 주세요');
  const v = (id) => el.querySelector(id).value.trim();
  const name = v('#an'), payer = v('#ap') || name;
  if (!name) return toast('이름을 넣어주세요');
  const a = { pid: p.id, uid: S.uid, owner: p.owner, cid: p.cid, name, payer, phone: v('#ac'), msg: v('#am'), at: Date.now(), state: 'req', full: !!full };
  try {
    await setDoc(doc(db, 'gapps', p.id + '__' + S.uid), a);
    S.apps[p.id] = a; el.hidden = true; render();
    toast(full ? '대기 신청했어요. 자리가 나면 알려드려요' : '신청했어요! 총무가 수락하면 여기서 바로 보여요', 4000);
  } catch (e) { toast('신청 실패: ' + e.message, 5000); }
}
async function paidClaim(pid) {
  const a = S.apps[pid]; if (!a) return;
  if (!confirm('참가비를 보내셨나요?\n총무가 통장에서 확인하면 확정돼요.')) return;
  a.paidClaim = true;
  await setDoc(doc(db, 'gapps', pid + '__' + S.uid), { paidClaim: true }, { merge: true }).then(() => toast('알렸어요. 총무가 확인하면 확정돼요'), (e) => toast('실패: ' + e.message));
  render();
}
async function confirmGo(pid) {
  const a = S.apps[pid]; if (!a) return; a.conf = true;
  await setDoc(doc(db, 'gapps', pid + '__' + S.uid), { conf: true }, { merge: true }).then(() => toast('확인했어요. 경기에서 봬요! ⚽'), (e) => toast('실패: ' + e.message));
  render();
}
async function cancelApp(pid) {
  const a = S.apps[pid], p = S.posts.find((x) => x.id === pid); if (!a) return;
  if (!confirm('신청을 취소할까요?' + (a.state === 'ok' && a.paid && p && p.refund ? '\n환불 규칙: ' + p.refund : ''))) return;
  a.state = 'cancel';
  await setDoc(doc(db, 'gapps', pid + '__' + S.uid), { state: 'cancel' }, { merge: true }).then(() => toast('취소했어요. 총무에게도 보여요'), (e) => toast('실패: ' + e.message));
  $('#sheet').hidden = true; render();
}
async function report(p) {
  if (!S.uid) return toast('신고하려면 로그인해 주세요');
  const why = prompt('어떤 문제가 있나요? (예: 연락 두절, 부적절한 글, 사기 의심)');
  if (!why || !why.trim()) return;
  await addDoc(collection(db, 'greports'), { pid: p.id, cid: p.cid, uid: S.uid, why: why.trim().slice(0, 300), at: Date.now() })
    .then(() => toast('신고했어요. 운영자가 확인할게요'), (e) => toast('실패: ' + e.message));
}
/** 내 매칭 신청·참여 기록·안 보기 목록을 모두 지움 (계정 전체 삭제는 홈 → 팀 화면 → 계정 삭제) */
async function wipeMine() {
  if (!confirm('게스트 매칭 신청 내역과 참여·노쇼 기록을 모두 지울까요?\n되돌릴 수 없어요.')) return;
  if (DEMO) return toast('체험 화면이라 지울 게 없어요');
  try {
    for (const c of [query(collection(db, 'gapps'), where('uid', '==', S.uid)), collection(db, 'gstats', S.uid, 'log')]) {
      const q = await _getDocs(c); for (const d of q.docs) await _deleteDoc(d.ref);
    }
    await _deleteDoc(doc(db, 'gblock', S.uid)).catch(() => {});
    toast('지웠어요'); await load(); render();
  } catch (e) { toast('지우기 실패: ' + e.message, 5000); }
}
async function block(p) {
  if (!S.uid) return toast('로그인하면 쓸 수 있어요');
  if (!confirm('"' + p.club + '" 모임의 글을 더 이상 보지 않을까요?')) return;
  S.blocked = S.blocked.concat([p.cid]);
  await setDoc(doc(db, 'gblock', S.uid), { cids: S.blocked }).catch(() => {});
  $('#sheet').hidden = true; render(); toast('이 모임 글을 숨겼어요');
}
