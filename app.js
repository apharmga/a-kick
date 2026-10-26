import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, writeBatch, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
const CID = new URLSearchParams(location.search).get('c') || '';
const D = (...p) => doc(db, 'clubs', CID, ...p);
const CL = (n) => collection(db, 'clubs', CID, n);

const S = { cfg: null, members: [], games: [], txs: [], skills: {}, votes: {}, view: 'week', week: monday(C.ymd(new Date())) };
const MEMBER_URL = new URL('./?c=' + CID, location.href).href;
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
const fail = (e) => { toast('저장 실패: ' + e.message, 6000); throw e; };
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
onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = './' + (CID ? '?c=' + CID : ''); return; }
  if (!CID) { location.href = './'; return; }
  try {
    const club = await getDoc(doc(db, 'clubs', CID));
    if (!club.exists() || club.data().owner !== u.uid) return deny(u);
    S.club = club.data(); S.uid = u.uid; document.title = S.club.name + ' 관리자';
    let ok = false; try { ok = sessionStorage.getItem('afutsal_pin_' + CID) === '1'; } catch (e) {}
    if (ok) { S.unlocked = true; return loadAll(); }
    const cfg = await getDoc(D('config', 'main'));
    pinGate(cfg.exists() ? cfg.data().pinHash : '');
  } catch (e) { deny(u, e.message); }
});
function deny(u, msg) {
  $('#app').innerHTML = '<div class="center"><b>이 팀의 관리자가 아니에요</b><div class="muted">' + esc(u.email || '') + (msg ? '<br>' + esc(msg) : '') + '</div><a class="btn pri" href="./' + (CID ? '?c=' + CID : '') + '">회원 화면으로</a></div>';
}
function pinGate(hash) {
  $('#app').innerHTML = '<div class="center"><div class="logo" style="font-size:26px">' + esc(S.club.name) + '</div><div class="muted">관리자 전용 페이지</div>' +
    '<label class="f" style="width:240px">관리자 비밀번호<input id="pin" type="password" inputmode="numeric" autocomplete="off"></label>' +
    '<button class="btn pri" id="go" style="min-height:46px;width:240px">들어가기</button><a class="muted" href="./?c=' + CID + '">회원 화면으로 돌아가기</a></div>';
  const inp = $('#pin'); inp.focus();
  const go = async () => {
    if ((await pinHash(inp.value.trim())) === (hash || PIN_DEFAULT)) { S.unlocked = true; try { sessionStorage.setItem('afutsal_pin_' + CID, '1'); } catch (e) {} loadAll(); }
    else { toast('비밀번호가 달라요'); inp.value = ''; inp.focus(); }
  };
  $('#go').onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
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
    S.claims = {}; S.goals = []; S.polls = []; S.pvotes = []; S.sugs = [];
    const live = (col, key) => onSnapshot(CL(col), (q) => { S[key] = q.docs.map((d) => Object.assign({ id: d.id }, d.data())); if (S.view === 'polls') render(); if (key === 'sugs' || key === 'reqs') render(); }, () => {});
    if (!S.pollSub) S.pollSub = [live('polls', 'polls'), live('pollvotes', 'pvotes'), live('suggest', 'sugs'), live('requests', 'reqs')];
    getDocs(CL('claims')).then((q) => q.docs.forEach((d) => (S.claims[d.id] = d.data()))).catch(() => {});
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
function renderSetup() {
  $('#app').innerHTML = '<div class="center"><div class="logo" style="font-size:28px">' + esc(S.club.name) + ' 시작하기</div><div class="muted">처음 한 번만 고르면 돼요</div>' +
    '<div class="setup3"><button class="scard" id="s1"><b>빈 상태로 시작</b><span>회원·경기를 여기서 직접 등록해요</span></button>' +
    '<label class="scard"><b>구글시트 엑셀 가져오기</b><span>예전 풋살모임 구글시트를 .xlsx로 받은 파일</span><input type="file" accept=".xlsx" id="f" hidden></label>' +
    '<button class="scard" id="s3" hidden><b>예전 A-FUTSAL 데이터 옮기기</b><span>도남풋살에서 쓰던 회원·거래·실력 점수 그대로</span></button></div></div>';
  $('#f').onchange = (e) => e.target.files[0] && readOld(e.target.files[0]);
  $('#s1').onclick = async () => {
    S.cfg = { fee: 30000, guestFee: 10000, oneOff: 120000, rentPerGame: 0, cap: 12, time: '16:00', before: 7, after: 1, nextMonthDay: 25, dueDay: 30, reserve: 0, openChat: '', place: '', account: '' };
    await setDoc(D('config', 'main'), S.cfg); toast('시작했어요 · 톱니바퀴에서 회비·계좌를 먼저 넣어주세요', 6000); loadAll();
  };
  getDoc(doc(db, 'config', 'main')).then((d) => { if (d.exists()) { $('#s3').hidden = false; $('#s3').onclick = moveLegacy; } }).catch(() => {});
}
async function moveLegacy() {
  $('#s3').disabled = true; $('#s3').querySelector('b').textContent = '옮기는 중... (10초쯤)';
  const [cfg, ms, gs, ts, sk] = await Promise.all([getDoc(doc(db, 'config', 'main')), getDocs(collection(db, 'members')), getDocs(collection(db, 'games')), getDocs(collection(db, 'tx')), getDoc(doc(db, 'private', 'skills'))]);
  const list = [];
  ms.docs.forEach((d) => list.push(['members', d.id, d.data()]));
  gs.docs.forEach((d) => list.push(['games', d.id, d.data()]));
  ts.docs.forEach((d) => list.push(['tx', d.id, d.data()]));
  if (sk.exists()) list.push(['private', 'skills', sk.data()]);
  list.push(['config', 'main', cfg.data()]);
  await batchPut(list); toast('옮겼어요! 회원 ' + ms.size + '명 · 거래 ' + ts.size + '건', 6000); loadAll();
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
function payYM() { return C.addYM(today().substr(0, 7), 1); }
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
  const nav = '<header class="bar"><div class="bar-in"><a class="logo" href="./?c=' + CID + '" title="홈으로">' + esc(S.club.name) + '<small>관리자</small></a><nav class="tabs" aria-label="메뉴">' + tab('week', '이번 주') + tab('members', '회원 · 회비' + ((S.reqs || []).length ? ' <em class="badge">' + S.reqs.length + '</em>' : '')) + tab('ledger', '장부') + tab('stats', '스탯 · 이벤트') + tab('polls', '투표 · 건의' + (newSugs() ? ' <em class="badge">' + newSugs() + '</em>' : '')) + '</nav>' +
    '<div class="stats"><div class="stat"><span>통장 잔액</span><b>' + won(C.balance(S.txs)) + '<em>원</em></b></div><div class="stat"><span>' + mon(ym) + ' 회비</span><b>' + list.filter((m) => paid[m.name]).length + '<em> / ' + list.length + '명</em></b></div></div>' +
    '<label class="btn pri up">' + IC.up + '<span>거래내역 엑셀 넣기</span><input type="file" accept=".xlsx,.xls" id="up" hidden></label>' +
    '<a class="btn" href="./?c=' + CID + '">' + IC.home + ' 홈</a><button class="iconbtn" id="gear" aria-label="설정">' + IC.gear + '</button></div></header>';
  const body = v === 'week' ? weekHTML() : v === 'members' ? membersHTML() : v === 'team' ? teamHTML() : v === 'stats' ? statsHTML() : v === 'polls' ? pollsHTML() : ledgerHTML();
  $('#app').innerHTML = nav + '<main class="wrap">' + body + '</main>';
  document.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { S.view = b.dataset.v; render(); }));
  $('#up').onchange = (e) => e.target.files[0] && importBank(e.target.files[0]);
  $('#gear').onclick = openSettings;
  ({ week: bindWeek, members: bindMembers, team: bindTeam, ledger: bindLedger, stats: bindStats, polls: bindPolls })[v]();
  bindSort();
}

/* ---- 이번 주 ---- */
function weekHTML() {
  const days = [...Array(7)].map((_, i) => C.addDays(S.week, i));
  const need = S.txs.filter((t) => t.state === '확인필요');
  const other = need.some((t) => C.dtDate(t.dt) < days[0] || C.dtDate(t.dt) > days[6]);
  const head = '<div class="toolbar"><div class="weeknav"><button class="iconbtn sm" id="pw" aria-label="지난주">' + IC.l + '</button><b>' + md(days[0]) + ' – ' + md(days[6]) + '</b><button class="iconbtn sm" id="nw" aria-label="다음주">' + IC.r + '</button>' +
    (S.week !== monday(today()) ? '<button class="btn sm" id="tw">이번 주로</button>' : '') + '</div>' +
    '<button class="btn sm" id="mlink">' + IC.copy + ' 회원 링크 복사</button>' +
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
    teamBox = '<section class="panel txpanel"><div class="tbhead"><span class="g-lbl2">' + md(tg.date) + ' 팀 편성 · ' + (tg.teamsPublic ? '회원 공개 중' : '회원 비공개') + '</span><button class="btn sm" data-team="' + tg.id + '">고치기</button></div>' +
      '<div class="tlabels"><div class="tlabel t0"><b>A팀 ' + T[0].length + '명</b></div><div class="tlabel t1"><b>B팀 ' + T[1].length + '명</b></div></div>' +
      '<div class="pitch sm"><span class="pl-mid"></span><span class="pl-circle"></span><span class="pl-boxL"></span><span class="pl-boxR"></span>' + pitchSide(T[0], 'L', 0, tg.id, true) + pitchSide(T[1], 'R', 1, tg.id, true) + '</div>' +
      (T[2] ? '<div class="muted" style="margin-top:8px">C팀: ' + esc(T[2].join(', ')) + '</div>' : '') + '</section>';
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
  return head + '<div class="wk"><div class="wk-main"><section class="panel txpanel"><div class="g-lbl2">이번 주 입출금 ' + txN + '건 <small>눌러서 자세히 보기·고치기</small></div>' + (rows || '<div class="empty">이번 주 입출금이 없어요</div>') + '</section>' + teamBox + '</div>' +
    '<div class="wk-side">' + side + foot + '</div></div>';
}
function txHTML(t) {
  const io = t.kind === '입금';
  const cls = t.state === '확인필요' ? 'ask' : t.state === '무시' ? 'ign' : '';
  let h = '<div class="tx ' + cls + '"><button class="tx-main" data-edit="' + t.id + '"><span class="tx-top"><span class="tx-name">' + esc(t.desc) + '</span><span class="tx-amt ' + (io ? 'pos' : 'neg') + '">' + (io ? '+' : '−') + won(t.amt) + '</span></span><span class="tx-sub">' + esc(partLabel(t)) + '</span></button>';
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
  if (g.postponed) return '<div class="game off"><div class="g-head"><b>' + md(g.date) + ' (' + C.dayName(g.date) + ') ' + esc(g.time || '') + '</b><span class="pp">' + esc(g.postponed) + '</span></div><div class="muted">이 경기는 열리지 않았어요. 출석·스탯 계산에서 빠져요.</div></div>';
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
  if (!confirm(md(src.date) + ' 경기 게스트 ' + n + '명을 ' + md(g.date) + ' 경기로 옮길까요?\n\n' + md(src.date) + ' 경기는 "' + md(g.date) + '로 연기"로 표시되고, 출석·스탯 계산에서 빠져요.')) return;
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
  const ml = $('#mlink'); if (ml) ml.onclick = () => copy('⚽ ' + S.club.name + ' 온라인 라커룸에 초대합니다\n' + MEMBER_URL + '\n\n① 링크 열고 구글 로그인\n② 내 실명 쓰고 가입 신청\n③ 관리자 승인 후 바로 입장 🙌\n\n카톡에서 로그인이 안 되면 \'사파리/크롬으로 열기\' 버튼을 눌러주세요.');
  $('#dues').onclick = duesText;
  const tw = $('#tw'); if (tw) tw.onclick = () => { S.week = monday(today()); render(); };
}
/* 종목·인원 설정 (풋살 기본 5~6명, 축구는 설정에서 11명) */
const perSide = () => S.cfg.perSide || 5, maxSide = () => Math.max(perSide(), S.cfg.maxSide || perSide() + 1), minN = () => perSide() * 2;
function sideTxt(total) { if (total < minN()) return (minN() - total) + '명 더 필요'; const k = Math.min(Math.floor(total / 2), maxSide()); return k + '대' + k + ' 가능'; }
function newGameAsk(date) {
  modal('<h2>경기 만들기</h2><div class="row"><label class="f">날짜<input id="nd" type="date" value="' + esc(date) + '"></label><label class="f">시간<input id="nt" type="time" value="' + esc(S.cfg.time || '16:00') + '"></label></div>' +
    '<div class="muted">요일·시간 상관없이 만들 수 있어요. 기본 시간은 설정에서 바꿔요.</div><div class="mfoot"><span style="flex:1"></span><button class="btn" id="cx">취소</button><button class="btn pri" id="ok">만들기</button></div>', (m) => {
    m.querySelector('#cx').onclick = closeModal;
    m.querySelector('#ok').onclick = () => { const d = m.querySelector('#nd').value, t = m.querySelector('#nt').value; if (!d) return toast('날짜를 골라주세요'); if (S.games.some((g) => g.id === 'G' + d.replace(/-/g, ''))) return toast('그 날은 이미 경기가 있어요'); closeModal(); newGame(d, t); };
  });
}
async function newGame(date, time) {
  const id = 'G' + date.replace(/-/g, '');
  const g = { id, date, time: time || S.cfg.time || '16:00', type: S.cfg.rentPerGame ? '정기' : '일회성', fee: S.cfg.rentPerGame || S.cfg.oneOff, cap: S.cfg.cap || 12, attend: [], deadline: '' };
  S.games.push(g); S.games.sort((a, b) => (a.date < b.date ? -1 : 1)); render(); await putGame(g); toast(md(date) + ' 경기를 만들었어요');
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
function makeTeams(names) {
  const bd = bundles(), cnt = {};
  const P = names.map((n) => {
    const base = n.replace(/\s*일행\d+$/, ''), g = bd[base] ? '#' + bd[base] : base;
    cnt[g] = (cnt[g] || 0) + 1;
    return { n, s: scoreOf(n), g };
  });
  P.forEach((p) => { if (cnt[p.g] < 2) p.g = ''; });
  const k = names.length >= 18 ? 3 : 2, cand = [];
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
function pitchSide(team, side, ti, gid, plain) {
  const ord = C.order(team, gid + ':' + ti), f = FORM[Math.min(11, Math.max(3, ord.length))] || FORM[5];
  return ord.map((name, i) => {
    const pos = f[i] || [46, 10 + ((i - f.length) * 16) % 80];
    const x = side === 'L' ? pos[0] : 100 - pos[0];
    if (plain) return '<div class="tok t' + ti + ' plain" style="left:' + x + '%;top:' + pos[1] + '%"><span class="tok-c"></span><span class="tok-n">' + esc(name) + (i === 0 ? ' <i>GK</i>' : '') + '</span></div>';
    const sel = S.pick === name ? ' sel' : '';
    return '<button class="tok t' + ti + sel + '" style="left:' + x + '%;top:' + pos[1] + '%" data-pick="' + esc(name) + '" aria-label="' + esc(name) + ' ' + scoreOf(name) + '점"><span class="tok-c">' + scoreOf(name) + '</span><span class="tok-n">' + esc(name) + (i === 0 ? ' <i>GK</i>' : '') + '</span></button>';
  }).join('');
}
function teamHTML() {
  const g = S.games.find((x) => x.id === S.gid);
  if (!g) { S.view = 'week'; return weekHTML(); }
  const players = playersOf(g), st = teamOf(g);
  const head = '<div class="toolbar"><button class="btn" id="back">' + IC.l + ' 이번 주</button><b class="t-title">' + md(g.date) + ' (' + C.dayName(g.date) + ') ' + esc(g.time || '') + ' · ' + players.length + '명</b>' +
    '<span style="flex:1"></span>' + (st ? '<button class="btn ' + (g.teamsPublic ? 'on-pub' : '') + '" id="pubT">' + (g.teamsPublic ? '회원에게 공개 중 · 숨기기' : '회원에게 공개하기') + '</button><button class="btn" id="copyT">' + IC.copy + ' 카톡 문구 복사</button>' : '') + '<button class="btn pri" id="mk">' + (st ? '다시 짜기' : '팀 짜기') + '</button></div>';
  if (players.length < 4) return head + '<div class="panel pad">참석자가 ' + players.length + '명이에요. 이번 주 화면에서 회원 참석을 체크하거나 게스트 입금을 확인해 주세요.</div>';
  let warn = '';
  if (st && (st.missing.length || st.gone.length)) warn = '<div class="tnote">팀을 짠 뒤 인원이 바뀌었어요' + (st.missing.length ? ' · 추가: <b>' + esc(st.missing.join(', ')) + '</b>' : '') + (st.gone.length ? ' · 빠짐: <b>' + esc(st.gone.join(', ')) + '</b>' : '') + ' → <button class="btn sm" id="mk2">다시 짜기</button></div>';
  if (!st) return head + '<div class="panel pad center2"><div>참석 <b>' + players.length + '명</b> · 실력 점수가 비슷하게, 일행은 같은 팀으로 짜요.</div><button class="btn pri" id="mk3" style="min-height:48px;padding:0 28px">팀 짜기</button></div>' + scoreList(players);
  const T = st.teams.map((t) => t.filter((n) => players.indexOf(n) >= 0));
  const sum = (t) => t.reduce((a, n) => a + scoreOf(n), 0);
  const label = (t, i) => '<div class="tlabel t' + i + '"><b>' + TEAMC[i] + '팀 ' + t.length + '명</b><span>합 ' + sum(t) + '</span></div>';
  const pitch = '<div class="pitchwrap"><div class="tlabels">' + label(T[0], 0) + label(T[1], 1) + '</div><div class="pitch"><span class="pl-mid"></span><span class="pl-circle"></span><span class="pl-boxL"></span><span class="pl-boxR"></span>' +
    pitchSide(T[0], 'L', 0, g.id) + pitchSide(T[1], 'R', 1, g.id) + '</div>' +
    (T[2] ? '<div class="tlabel t2" style="margin-top:10px"><b>C팀 ' + T[2].length + '명 (대기)</b><span>' + esc(T[2].join(', ')) + '</span></div>' : '') +
    '<div class="muted" style="margin-top:8px">동그라미 숫자 = 실력 점수 · 선수를 누르고 상대 팀 선수를 누르면 <b>서로 자리 바꾸기</b> · 점수는 아래에서 고쳐요</div></div>';
  return head + warn + pitch + scoreList(players);
}
function scoreList(players) {
  return '<div class="panel pad"><div class="g-lbl2" style="margin-bottom:10px">실력 점수 (관리자만 보여요 · 카톡에는 이름만 나가요)</div><div class="slist">' +
    players.map((n) => '<div class="srow"><span>' + esc(n) + (scores()[n] ? '' : ' <em class="tag gry">새</em>') + '</span><span class="seg5">' + [1, 2, 3, 4, 5].map((v) => '<button class="' + (scoreOf(n) === v ? 'on' : '') + '" data-sc="' + esc(n) + '" data-v="' + v + '" aria-label="' + esc(n) + ' ' + v + '점">' + v + '</button>').join('') + '</span></div>').join('') +
    '</div><div class="muted" style="margin-top:8px">5 에이스 · 4 잘함 · 3 보통(모르면 3) · 2 초보 · 1 입문</div></div>';
}
function bindTeam() {
  const g = S.games.find((x) => x.id === S.gid); if (!g) return;
  $('#back').onclick = () => { S.view = 'week'; render(); };
  const mk = async () => { g.teams = makeTeams(playersOf(g)); S.pick = null; render(); await putGame(g); toast('팀을 짰어요 · 다시 누르면 새로 짜요'); };
  ['#mk', '#mk2', '#mk3'].forEach((id) => { const b = $(id); if (b) b.onclick = mk; });
  const pb = $('#pubT'); if (pb) pb.onclick = async () => { g.teamsPublic = !g.teamsPublic; render(); await putGame(g); toast(g.teamsPublic ? '회원 화면에 팀이 보여요' : '회원 화면에서 팀을 숨겼어요'); };
  const cp = $('#copyT'); if (cp) cp.onclick = () => {
    const T = g.teams.map((t) => t.filter((n) => playersOf(g).indexOf(n) >= 0));
    copy('⚽ ' + md(g.date) + '(' + C.dayName(g.date) + ') ' + g.time + ' 팀 편성 (' + playersOf(g).length + '명)\n\n' +
      T.map((t, i) => (i === 0 ? '🟠' : i === 1 ? '🔵' : '🟢') + ' ' + TEAMC[i] + '팀 (' + t.length + '명)\n' + t.join(', ')).join('\n\n') + '\n\n즐겁게 차요! 다치지 않게 조심하세요 🙌');
  };
  document.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = async () => {
    const n = b.dataset.pick;
    if (!S.pick) { S.pick = n; return render(); }
    if (S.pick === n) { S.pick = null; return render(); }
    const a = S.pick, ia = g.teams.findIndex((t) => t.indexOf(a) >= 0), ib = g.teams.findIndex((t) => t.indexOf(n) >= 0);
    if (ia === ib) { S.pick = n; return render(); }
    g.teams[ia][g.teams[ia].indexOf(a)] = n; g.teams[ib][g.teams[ib].indexOf(n)] = a; S.pick = null;
    render(); await putGame(g); toast(a + ' ↔ ' + n + ' 자리 바꿈');
  }));
  document.querySelectorAll('[data-sc]').forEach((b) => (b.onclick = async () => { scores()[b.dataset.sc] = +b.dataset.v; render(); await putSkills(); }));
}

function editDeadline(gid) {
  const g = S.games.find((x) => x.id === gid), def = C.addDays(g.date, -1) + 'T22:00';
  modal('<h2>' + md(g.date) + ' 경기 · 투표 마감</h2><label class="f">마감 날짜와 시간<input id="dlv" type="datetime-local" value="' + esc(g.deadline || def) + '"></label><div class="muted">마감이 지나면 회원 화면의 투표 버튼이 잠겨요. 비우면 경기 시작까지 투표할 수 있어요.</div>' +
    '<div class="mfoot"><button class="btn ghost" id="clr">마감 없음</button><span style="flex:1"></span><button class="btn" id="cx">취소</button><button class="btn pri" id="ok">저장</button></div>', (m) => {
    m.querySelector('#cx').onclick = closeModal;
    m.querySelector('#clr').onclick = async () => { g.deadline = ''; closeModal(); render(); await putGame(g); };
    m.querySelector('#ok').onclick = async () => { g.deadline = m.querySelector('#dlv').value; closeModal(); render(); await putGame(g); toast('투표 마감을 저장했어요'); };
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
    return { id: g.id, date: g.date, time: g.time || '', cap: g.cap || S.cfg.cap, deadline: g.deadline || '', attend: a,
             guests: C.guestNames(S.txs, g.id, a), teams: g.teamsPublic && g.teams ? g.teams.map((x) => x.filter((n) => playersOf(g).indexOf(n) >= 0).join('|')) : [] };
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
  const txs = S.txs.map((x) => { bal += x.kind === '입금' ? x.amt : -x.amt; return { dt: x.dt.substr(0, 16).replace(/\./g, '-'), io: x.kind === '입금' ? 1 : 0, amt: x.amt, who: x.desc, what: x.state === '확인필요' ? '관리자 확인 중' : partLabel(x), off: x.state === '무시' ? 1 : 0, bal: x.bal || bal }; }).slice(-1500);
  const played = S.games.filter((g) => g.date <= t && g.date >= statFrom() && !g.postponed).slice(-200).map((g) => { const pl = playersOf(g); return { id: g.id, date: g.date, players: pl, teams: g.teams ? g.teams.map((x) => x.filter((n) => pl.indexOf(n) >= 0).join('|')) : [] }; });
  return { updatedAt: new Date().toISOString(), club: S.club.name, perSide: perSide(), maxSide: maxSide(), txs, played, statFrom: statFrom(), place: S.cfg.place || '', members: act.map((m) => ({ id: m.id, name: m.name })), games, records, ledger,
           dues: { ym, fee: S.cfg.fee, dueDay: S.cfg.dueDay || 30, account: S.cfg.account || '', paid: list.filter((m) => paid[m.name]).map((m) => m.name), unpaid: list.filter((m) => !paid[m.name]).map((m) => m.name) } };
}
async function publish() { await setDoc(D('pub', 'state'), pubData()); }

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
  if (presetCls === '회비') Object.assign(parts[0], { names: [t.desc], ym: payYM() });
  const gOpts = (sel) => '<option value="">(없음)</option>' + S.games.slice(-12).map((g) => '<option value="' + g.id + '"' + (g.id === sel ? ' selected' : '') + '>' + md(g.date) + ' (' + C.dayName(g.date) + ')</option>').join('');
  const partHTML = (p, i) => '<div class="part" data-i="' + i + '"><div class="row">' +
    '<label class="f">분류<select data-k="cls">' + CLS.map((c) => '<option' + (c === p.cls ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>' +
    '<label class="f">금액<input data-k="amt" type="number" value="' + (p.amt || 0) + '"></label>' +
    '<label class="f">이름 (여러 명은 쉼표)<input data-k="names" value="' + esc((p.names || [p.name || '']).join(', ')) + '"></label></div><div class="row">' +
    '<label class="f">귀속월 (회비·정기대관)<input data-k="ym" placeholder="2026-11" value="' + esc(p.ym || '') + '"></label>' +
    '<label class="f">경기 (게스트비)<select data-k="gid">' + gOpts(p.gid) + '</select></label>' +
    '<label class="f">인원<input data-k="cnt" type="number" min="1" value="' + (p.cnt || 1) + '"></label></div>' +
    (parts.length > 1 ? '<button class="btn ghost" data-del="' + i + '">이 항목 삭제</button>' : '') + '</div>';
  const draw = () => modal('<h2>' + esc(t.desc) + ' · ' + (t.kind === '입금' ? '' : '−') + won(t.amt) + '원</h2><div class="muted">' + esc(t.dt) + (t.note ? ' · ' + esc(t.note) : '') + '</div>' +
    parts.map(partHTML).join('') +
    '<div class="row"><button class="btn" id="add">+ 나눠 넣기 (예: 회비 + 경기비)</button><button class="btn" id="nextg">게스트비 → 다음 경기로 이월</button></div>' +
    '<label class="f">메모<input id="note" value="' + esc(t.note || '') + '"></label>' +
    '<div class="row"><button class="btn ghost" id="ign">무시(장부 제외)</button><button class="btn" id="cancel">취소</button><button class="btn pri" id="save">저장</button></div>', (m) => {
    const read = () => m.querySelectorAll('.part').forEach((el) => {
      const p = parts[+el.dataset.i], v = (k) => el.querySelector('[data-k="' + k + '"]').value.trim();
      p.cls = v('cls'); p.amt = +v('amt') || 0; p.cnt = +v('cnt') || 1; p.ym = v('ym'); p.gid = v('gid');
      const ns = v('names').split(',').map((x) => x.trim()).filter(Boolean);
      if (p.cls === '회비' || p.cls === '첫달회비') { p.names = ns; delete p.name; } else { p.name = ns[0] || ''; delete p.names; }
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
    m.querySelector('#ign').onclick = async () => { t.state = '무시'; t.parts = []; t.reason = '무시'; delete t.suggest; closeModal(); render(); await putTx(t); };
    m.querySelector('#save').onclick = async () => {
      read();
      const sum = parts.reduce((a, p) => a + p.amt, 0);
      if (sum !== t.amt) return toast('나눈 금액 합계(' + won(sum) + ')가 거래 금액(' + won(t.amt) + ')과 달라요', 5000);
      t.parts = parts; t.state = '확인'; t.reason = ''; t.note = m.querySelector('#note').value.trim(); delete t.suggest;
      closeModal(); render(); await putTx(t); toast('저장했어요');
    };
  });
  draw();
}

/* ---- 카카오뱅크 엑셀 넣기 ---- */
async function importBank(file) {
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    const parsed = C.parseBankRows(rows);
    const have = new Set(S.txs.map((t) => t.id));
    const fresh = parsed.filter((t) => !have.has(t.id)).sort((a, b) => (a.dt < b.dt ? -1 : 1));
    if (!fresh.length) return toast('새 거래가 없어요 (' + parsed.length + '건 모두 이미 있음)', 4000);
    const recent = S.txs.filter((t) => t.state === '확인필요');
    const pairs = C.pairRefunds(fresh.concat(recent));
    pairs.forEach(([a, b]) => [a, b].forEach((x) => { x.state = '무시'; x.parts = []; x.reason = '취소·환불 상계 (' + x.desc + ')'; delete x.suggest; }));
    const ctx = { cfg: cfgC(), games: S.games, members: S.members, alias: C.aliasMap(S.members), done: S.txs.slice() };
    let auto = 0, need = 0;
    fresh.forEach((t) => {
      if (!t._paired) {
        const r = C.classify(t, ctx);
        t.parts = r.parts; t.state = r.state; t.reason = r.reason || ''; if (r.suggest) t.suggest = r.suggest;
      }
      t.addedAt = new Date().toISOString();
      if (t.state === '확인필요') need++; else auto++;
      ctx.done.push(t);
    });
    const touched = fresh.concat(recent.filter((t) => t._paired));
    S.txs = S.txs.filter((t) => !touched.some((x) => x.id === t.id)).concat(touched).sort((a, b) => (a.dt < b.dt ? -1 : 1));
    await batchPut(touched.map((t) => ['tx', t.id, t]));
    const last = fresh[fresh.length - 1];
    S.week = monday(C.dtDate((S.txs.find((t) => t.state === '확인필요') || last).dt));
    S.view = 'week'; render();
    toast('새 거래 ' + fresh.length + '건 · 자동 확정 ' + auto + '건 · 확인 ' + need + '건 · 잔액 ' + won(C.balance(S.txs)) + '원', 7000);
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
    const same = act.find((m) => m.name === r.name.trim());
    return '<div class="req"><div class="rq"><b>' + esc(r.name) + '</b><small>' + esc(r.email || '') + '</small></div>' +
      '<select data-rsel="' + r.id + '"><option value="">+ 새 회원으로 등록 (' + esc(r.name) + ')</option>' + act.map((m) => '<option value="' + m.id + '"' + (same && same.id === m.id ? ' selected' : '') + '>' + esc(m.name) + (S.claims[m.id] ? ' (연결됨: ' + esc(S.claims[m.id].email || '') + ')' : '') + '</option>').join('') + '</select>' +
      '<button class="btn pri sm" data-rok="' + r.id + '">승인</button><button class="btn ghost sm" data-rno="' + r.id + '">거절</button></div>';
  }).join('') + '</div>';
}
async function approve(uid) {
  const r = S.reqs.find((x) => x.id === uid), mid = document.querySelector('[data-rsel="' + uid + '"]').value;
  let m = S.members.find((x) => x.id === mid);
  if (!m) {
    m = { id: 'M' + String(S.members.length + 1).padStart(3, '0'), name: r.name.trim(), join: today(), quit: '', state: '활동', fee: 0, payers: [r.name.trim()] };
    while (S.members.some((x) => x.id === m.id)) m.id = 'M' + String(+m.id.slice(1) + 1).padStart(3, '0');
    if (!confirm(m.name + ' 님을 새 회원(가입일 오늘)으로 등록하고 승인할까요?')) return;
    S.members.push(m); await putMember(m);
  } else if (S.claims[m.id] && S.claims[m.id].uid !== uid) {
    if (!confirm(m.name + ' 이름은 이미 ' + (S.claims[m.id].email || '다른 계정') + '에 연결돼 있어요. 새 계정으로 바꿀까요?')) return;
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
    '<label class="f">통장에 찍히는 이름 (여러 개면 쉼표 · 부부는 상대 이름도)<input id="p" value="' + esc((m.payers || []).join(', ')) + '"></label>' +
    '<div class="card" style="background:#F6F7FA" id="fm"></div>' +
    (id ? '<div class="linkacc">' + (S.claims[m.id] ? '연결된 구글 계정: <b>' + esc(S.claims[m.id].email || '') + '</b> <button class="btn xs" id="unl">연결 해제</button>' : '<span class="muted">아직 이 이름을 고른 계정이 없어요</span>') + '</div>' : '') +
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
      m.name = el.querySelector('#n').value.trim(); if (!m.name) return toast('이름을 넣어주세요');
      m.join = el.querySelector('#j').value; m.state = el.querySelector('#s').value; m.quit = el.querySelector('#q').value;
      if (m.state === '탈퇴' && !m.quit) m.quit = today();
      m.payers = el.querySelector('#p').value.split(',').map((x) => x.trim()).filter(Boolean); if (m.payers.indexOf(m.name) < 0) m.payers.unshift(m.name);
      if (!id) S.members.push(m);
      closeModal(); render(); await putMember(m); toast('저장했어요');
    };
  });
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

/* ---- 스탯 · 이벤트 (관리자만 보는 페이지) ---- */
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
    return '<div class="glog"><div class="glh"><b>' + md(g.date) + ' (' + C.dayName(g.date) + ')</b>' + (g.teams.length >= 2 ? '<span>A ' + sc[0] + ' : ' + sc[1] + ' B</span>' : '') + '</div>' +
      (gs.length ? gs.map((x) => '<div class="gli">⚽ <b>' + esc(x.scorer) + '</b>' + (x.assist ? ' <span class="muted">도움 ' + esc(x.assist) + '</span>' : '') + '<small>' + esc(x.byName || '') + ' 입력</small><button class="btn xs ghost" data-gdel="' + x.id + '">삭제</button></div>').join('') : '<div class="muted">기록 없음 · 회원 화면 \'스탯\' 탭에서 누구나 넣을 수 있어요</div>') + '</div>';
  }).join('');
  return '<div class="pagehead"><h1>스탯 · 이벤트</h1><div class="ph-act"><select id="sym"><option value="">전체 기간</option>' + months.map((m) => '<option value="' + m + '"' + (m === S.sym ? ' selected' : '') + '>' + m.replace('-', '년 ') + '월</option>').join('') + '</select></div></div>' +
    '<div class="evnote">🔒 이 페이지는 관리자만 볼 수 있어요. 아래 1위 후보는 회원 화면에 나오지 않아요. · 스탯은 ' + md(statFrom()) + ' 경기부터 집계 (설정에서 변경)</div>' +
    '<div class="sumrow">' + top('g', (S.sym ? mon(S.sym) : '전체') + ' 득점 1위', '골') + top('a', '도움 1위', '개') + top('ap', '공격포인트 1위', 'P') + top('gp', '출석 1위', '경기') + '</div>' +
    '<div class="statgrid"><div class="panel tablewrap"><table><thead><tr>' + th('name', '이름') + th('gp', '경기') + th('g', '골') + th('a', '도움') + th('ap', '공격P') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="panel pad"><div class="g-lbl2" style="margin-bottom:8px">경기별 기록</div>' + (gl || '<div class="muted">이 기간 경기가 없어요</div>') + '</div></div>';
}
/* ---- 투표 · 공지 · 건의함 ---- */
const newSugs = () => (S.sugs || []).filter((x) => !x.done).length;
const pollOpen = (p) => !p.closed && (!p.deadline || Date.now() < Date.parse(p.deadline));
function pollOpts(p) {
  const vs = S.pvotes.filter((v) => v.pid === p.id), adds = [...new Set(vs.map((v) => v.add).filter(Boolean))];
  const opts = (p.options || []).concat(adds.filter((a) => !(p.options || []).some((o) => o.text === a)).map((a) => ({ id: 'u:' + a, text: a, user: 1 })));
  return opts.map((o) => Object.assign({}, o, { who: vs.filter((v) => (v.picks || []).indexOf(o.id) >= 0).map((v) => v.name) })).sort((a, b) => b.who.length - a.who.length);
}
function pollsHTML() {
  const ps = S.polls.slice().sort((a, b) => (a.created < b.created ? 1 : -1)), mem = S.members.filter((m) => m.state !== '탈퇴');
  const card = (p) => {
    const vs = S.pvotes.filter((v) => v.pid === p.id), opts = pollOpts(p), mx = Math.max(1, ...opts.map((o) => o.who.length));
    const not = mem.filter((m) => !vs.some((v) => v.mid === m.id)).map((m) => m.name);
    return '<div class="panel pad pcard"><div class="ph"><b>' + esc(p.title) + '</b><span class="pill ' + (pollOpen(p) ? 'ok' : '') + '">' + (pollOpen(p) ? '진행 중' : '마감') + '</span></div>' +
      (p.desc ? '<div class="pdesc">' + esc(p.desc) + '</div>' : '') +
      '<div class="muted">' + (p.multi ? '복수 선택' : '하나만 선택') + (p.allowAdd ? ' · 회원 보기 추가 가능' : '') + ' · ' + (p.deadline ? md(p.deadline.substr(0, 10)) + ' ' + p.deadline.substr(11, 5) + ' 마감' : '마감 없음') + ' · 참여 ' + vs.length + '/' + mem.length + '명</div>' +
      opts.map((o) => '<div class="bar2"><div class="bl"><span>' + esc(o.text) + (o.user ? ' <em class="tag gry">회원 추가</em>' : '') + '</span><b>' + o.who.length + '</b></div><div class="bt"><i style="width:' + (o.who.length / mx * 100) + '%"></i></div><small>' + esc(o.who.join(', ')) + '</small></div>').join('') +
      (not.length ? '<div class="muted" style="margin-top:6px">아직 안 한 사람: ' + esc(not.join(', ')) + '</div>' : '') +
      '<div class="row" style="margin-top:10px"><button class="btn sm" data-pcopy="' + p.id + '">' + IC.copy + ' 카톡 공지 문구</button>' + (pollOpen(p) ? '<button class="btn sm" data-pclose="' + p.id + '">지금 마감</button>' : '') + '<button class="btn sm ghost" data-pdel="' + p.id + '">삭제</button></div></div>';
  };
  const sugs = (S.sugs || []).slice().sort((a, b) => b.at - a.at);
  return '<div class="pagehead"><h1>투표 · 공지 · 건의함</h1><div class="ph-act"><button class="btn pri" id="newp">+ 새 투표 · 공지</button></div></div>' +
    '<div class="statgrid"><div class="pcol">' + (ps.length ? ps.map(card).join('') : '<div class="panel pad muted">아직 만든 투표가 없어요. 예: "우리 팀 이름 정하기"</div>') + '</div>' +
    '<div class="panel pad"><div class="g-lbl2" style="margin-bottom:8px">건의함 ' + (newSugs() ? '· 새 건의 ' + newSugs() + '건' : '') + '</div>' +
    (sugs.length ? sugs.map((x) => '<div class="sug' + (x.done ? ' done' : '') + '"><div class="sh"><b>' + (x.anon ? '익명' : esc(x.name)) + '</b><small>' + new Date(x.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</small><button class="btn xs" data-sdone="' + x.id + '">' + (x.done ? '다시 열기' : '확인함') + '</button></div><div class="st2">' + esc(x.text) + '</div></div>').join('') : '<div class="muted">아직 들어온 건의가 없어요</div>') + '</div></div>';
}
function bindPolls() {
  $('#newp').onclick = newPoll;
  document.querySelectorAll('[data-pclose]').forEach((b) => (b.onclick = async () => { const p = S.polls.find((x) => x.id === b.dataset.pclose); p.closed = true; await setDoc(D('polls', p.id), clean(p)).catch(fail); render(); }));
  document.querySelectorAll('[data-pdel]').forEach((b) => (b.onclick = async () => { if (!confirm('이 투표를 지울까요? 결과도 같이 사라져요.')) return; await deleteDoc(D('polls', b.dataset.pdel)).catch(fail); S.pvotes.filter((v) => v.pid === b.dataset.pdel).forEach((v) => deleteDoc(D('pollvotes', v.id)).catch(() => {})); }));
  document.querySelectorAll('[data-pcopy]').forEach((b) => (b.onclick = () => {
    const p = S.polls.find((x) => x.id === b.dataset.pcopy);
    copy('📢 ' + p.title + (p.desc ? '\n\n' + p.desc : '') + '\n\n🗳 투표하기 👉 ' + MEMBER_URL + (p.deadline ? '\n⏰ ' + md(p.deadline.substr(0, 10)) + '(' + C.dayName(p.deadline.substr(0, 10)) + ') ' + p.deadline.substr(11, 5) + ' 마감' : ''));
  }));
  document.querySelectorAll('[data-sdone]').forEach((b) => (b.onclick = async () => { const x = S.sugs.find((y) => y.id === b.dataset.sdone); x.done = !x.done; const o = clean(x); delete o.id; await setDoc(D('suggest', x.id), o).catch(fail); render(); }));
}
function newPoll() {
  modal('<h2>새 투표 · 공지</h2><label class="f">제목<input id="pt" placeholder="예: 우리 팀 이름 정하기" maxlength="60"></label>' +
    '<label class="f">설명 · 공지 내용 (선택)<textarea id="pd" rows="3" placeholder="예: 후보 중에 골라주세요. 좋은 이름 있으면 직접 추가해도 돼요!"></textarea></label>' +
    '<label class="f">보기 (한 줄에 하나 · 공지만 할 거면 비워두세요)<textarea id="po" rows="4" placeholder="OO FC&#10;킥앤런&#10;일요일의 전설"></textarea></label>' +
    '<div class="row"><label class="chk"><input type="checkbox" id="pm"> 여러 개 고를 수 있게</label><label class="chk"><input type="checkbox" id="pa" checked> 회원이 보기 추가 가능</label></div>' +
    '<label class="f">마감 (비우면 마감 없음)<input id="pdl" type="datetime-local"></label>' +
    '<div class="muted">만들면 회원이 앱을 열 때 아직 안 한 투표가 바로 팝업으로 떠요.</div>' +
    '<div class="mfoot"><span style="flex:1"></span><button class="btn" id="cx">취소</button><button class="btn pri" id="ok">만들기</button></div>', (m) => {
    m.querySelector('#cx').onclick = closeModal;
    m.querySelector('#ok').onclick = async () => {
      const title = m.querySelector('#pt').value.trim(); if (!title) return toast('제목을 넣어주세요');
      const lines = m.querySelector('#po').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20);
      const id = 'P' + Date.now().toString(36);
      const p = { title, desc: m.querySelector('#pd').value.trim(), options: lines.map((t, i) => ({ id: 'o' + (i + 1), text: t })), multi: m.querySelector('#pm').checked,
        allowAdd: m.querySelector('#pa').checked, deadline: m.querySelector('#pdl').value, created: new Date().toISOString(), closed: false };
      await setDoc(D('polls', id), p).catch(fail); closeModal(); toast('만들었어요 · 카톡 공지 문구도 복사해 보세요'); S.view = 'polls'; render();
    };
  });
}
function bindStats() {
  $('#sym').onchange = (e) => { S.sym = e.target.value; render(); };
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
  ['reserve', '곶간(비상금)', 'number'], ['statFrom', '골·도움 스탯 집계 시작일', 'date'], ['place', '구장 이름', 'text'], ['account', '모임통장 (예: 카카오뱅크 3333-00-0000000)', 'text'], ['openChat', '오픈채팅 링크', 'text']];
function openSettings() { openSettingsReal(); }
function openSettingsReal() {
  const grp = (title, keys) => '<div class="sgrp"><div class="g-lbl2">' + title + '</div><div class="row2">' + CFG.filter(([k]) => keys.indexOf(k) >= 0).map(([k, l, ty]) => '<label class="f">' + l + '<input data-c="' + k + '" type="' + ty + '" value="' + esc(S.cfg[k] == null ? '' : S.cfg[k]) + '"></label>').join('') + '</div></div>';
  modal('<h2>설정</h2><div class="muted">팀 만든 구글 계정 + 관리자 비밀번호로만 열려요. 회원 화면에는 나오지 않아요.</div>' +
    grp('회비 · 게스트', ['fee', 'guestFee', 'nextMonthDay', 'dueDay']) + grp('구장 · 경기 인원', ['rentPerGame', 'oneOff', 'cap', 'perSide', 'maxSide', 'time', 'place']) + grp('안내 문구 · 기타', ['statFrom', 'account', 'openChat', 'reserve']) +
    '<div class="sgrp"><div class="g-lbl2">관리자 비밀번호 바꾸기 (처음 0000)</div><label class="f">새 비밀번호 (바꿀 때만 입력)<input id="newpin" type="password" inputmode="numeric" autocomplete="new-password"></label></div>' +
    '<div class="muted" style="margin-top:8px">A-KICK v0.15.2</div>' +
    '<div class="mfoot"><button class="btn" id="bk">백업 내려받기</button><button class="btn ghost" id="lo">로그아웃</button><span style="flex:1"></span><button class="btn" id="cx">닫기</button><button class="btn pri" id="sv">저장</button></div>', (m) => {
    m.querySelector('#cx').onclick = closeModal;
    m.querySelector('#bk').onclick = backup;
    m.querySelector('#lo').onclick = () => { closeModal(); try { sessionStorage.clear(); } catch (e) {} signOut(auth); };
    m.querySelector('#sv').onclick = async () => {
      m.querySelectorAll('[data-c]').forEach((i) => (S.cfg[i.dataset.c] = i.type === 'number' ? +i.value : i.value.trim()));
      const np = m.querySelector('#newpin').value.trim(); if (np) S.cfg.pinHash = await pinHash(np);
      await putCfg(); closeModal(); toast('저장했어요'); render();
    };
  });
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
