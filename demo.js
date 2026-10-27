/* 체험 팀: 로그인 없이 둘러보는 샘플 데이터 (서버에 저장 안 함 · 날짜는 항상 오늘 기준) */
export function demoData() {
  const C = window.Core, D = (d) => C.ymd(d), add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const N = ['김민준', '이서준', '박도윤', '최예준', '정시우', '강하준', '조주원', '윤지호', '장지후', '임준우', '한도현', '오건우'];
  const members = N.map((n, i) => ({ id: 'm' + (i + 1), name: n })), ME = members[0];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thu = add(today, (4 - today.getDay() + 7) % 7);                 // 이번 주 목요일 (오늘이 목요일이면 오늘)
  const gid = (d) => 'G' + D(d).replace(/-/g, '');
  const split = (pl) => [pl.filter((_, i) => i % 2 === 0).join('|'), pl.filter((_, i) => i % 2 === 1).join('|')];

  // 지난 8주 경기 + 골 기록
  const played = [], goals = [];
  for (let w = 8; w >= 1; w--) {
    const d = add(thu, -7 * w), pl = N.filter(() => rnd() < 0.8);
    if (pl.indexOf(ME.name) < 0 && w % 3) pl.unshift(ME.name);
    played.push({ id: gid(d), date: D(d), players: pl, teams: split(pl) });
    const k = 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < k; i++) { const sc = pick(pl), as = rnd() < 0.6 ? pick(pl.filter((x) => x !== sc)) : ''; goals.push({ id: 'gl' + goals.length, gid: gid(d), scorer: sc, assist: as, by: 'x', byName: '체험', at: d.getTime() }); }
  }
  const records = {};
  N.forEach((n) => { const hits = played.map((g) => (g.players.indexOf(n) >= 0 ? 1 : 0)); records[n] = { total: played.length, came: hits.filter(Boolean).length, last: hits.slice(-8) }; });

  // 다가올 경기 2개 (첫 경기는 팀 편성까지 공개)
  const att = N.filter((n, i) => i < 9), dl = (d) => D(add(d, -1)) + 'T22:00';
  const games = [
    { id: gid(thu), date: D(thu), postponed: false, time: '20:00', cap: 14, deadline: dl(thu), attend: att, guests: ['게스트'], teams: split(att) },
    { id: gid(add(thu, 7)), date: D(add(thu, 7)), postponed: false, time: '20:00', cap: 14, deadline: dl(add(thu, 7)), attend: N.slice(1, 6), guests: [], teams: [] }];

  // 통장 거래 (3달치) → 장부 · 회비
  const txs = [], ym0 = D(today).substr(0, 7), months = [C.addYM(ym0, -2), C.addYM(ym0, -1), ym0];
  let bal = 412000; const tx = (dt, io, amt, who, what) => { bal += io ? amt : -amt; txs.push({ dt, io, amt, who, what, off: 0, bal, pend: 0 }); };
  const ledger = [];
  months.forEach((ym, mi) => {
    const L = { ym, fee: 0, guest: 0, guestN: 0, field: 0, etcIn: 0, etcOut: 0 };
    tx(ym + '-01 09:00', 0, 400000, '풋살파크', '구장비 (정기대관)'); L.field += 400000;
    const gn = 2 + mi; for (let i = 0; i < gn; i++) { tx(ym + '-' + String(8 + i * 6).padStart(2, '0') + ' 21:10', 1, 10000, '게스트' + (i + 1), '게스트비'); L.guest += 10000; L.guestN++; }
    if (mi === 1) { tx(ym + '-19 13:00', 0, 32000, '스포츠몰', '기타지출 (조끼)'); L.etcOut += 32000; }
    const payers = mi < 2 ? N : N.slice(0, 8), nx = C.addYM(ym, 1);
    payers.forEach((n, i) => { const dd = Math.min(25, 20 + (i % 6)); if (mi === 2 && dd > today.getDate()) return; tx(ym + '-' + dd + ' ' + (10 + i) + ':00', 1, 40000, n, '회비 (' + (+nx.substr(5, 2)) + '월)'); L.fee += 40000; });
    L.net = L.fee + L.guest + L.etcIn - L.field - L.etcOut; L.end = bal; ledger.push(L);
  });
  txs.sort((a, b) => (a.dt < b.dt ? -1 : 1)); let b2 = 412000; txs.forEach((t) => (t.bal = b2 += t.io ? t.amt : -t.amt));
  const payYM = C.addYM(ym0, 1), paidN = txs.filter((t) => t.what === '회비 (' + (+payYM.substr(5, 2)) + '월)').map((t) => t.who);

  const pub = { updatedAt: new Date(Date.now() - 36e5).toISOString(), xpAdj: {}, wxLoc: null, club: '체험FC', perSide: 5, maxSide: 6, txs, played, statFrom: played[0].date,
    place: '풋살파크 1구장', members, games, records, ledger,
    dues: { ym: payYM, fee: 40000, dueDay: 25, account: '체험용 계좌 0000-00-0000000', paid: N.filter((n) => paidN.indexOf(n) >= 0), unpaid: N.filter((n) => paidN.indexOf(n) < 0) } };

  const profs = {}, POS = ['FW', 'MF', 'DF', 'GK'];
  members.forEach((m, i) => (profs[m.id] = { num: i === 0 ? 10 : 2 + ((i * 7) % 97), pos: [POS[i % 4]], lv: [14, 31, 8, 22, 5, 41, 17, 3, 26, 12, 9, 50][i], xp: 0 }));

  const ts = (d, h) => D(d) + 'T' + h;
  const polls = [
    { id: 'p1', title: '11월 회식 날짜 골라주세요', desc: '경기 끝나고 같이 밥 먹어요 🍖', options: [{ id: 'a', text: '첫째 주 목요일' }, { id: 'b', text: '둘째 주 목요일' }, { id: 'c', text: '셋째 주 목요일' }], multi: true, allowAdd: true, anon: false, deadline: ts(add(today, 3), '23:00'), created: new Date(Date.now() - 864e5).toISOString() },
    { id: 'p2', title: '팀 유니폼 색깔', desc: '', options: [{ id: 'a', text: '네이비' }, { id: 'b', text: '형광 노랑' }, { id: 'c', text: '블랙' }], multi: false, allowAdd: false, anon: true, deadline: ts(add(today, -4), '23:00'), created: new Date(Date.now() - 9 * 864e5).toISOString() },
    { id: 'p3', title: '📢 이번 달부터 정기대관 시작해요', desc: '매주 목요일 20시, 풋살파크 1구장입니다.', options: [], multi: false, allowAdd: false, anon: false, deadline: '', created: new Date(Date.now() - 20 * 864e5).toISOString() }];
  const pvotes = []; N.slice(1, 8).forEach((n, i) => pvotes.push({ id: 'p1__m' + (i + 2), pid: 'p1', mid: 'm' + (i + 2), name: n, picks: [['a', 'b', 'c'][i % 3]], add: '', at: 0 }));
  N.slice(0, 9).forEach((n, i) => pvotes.push({ id: 'p3__m' + (i + 1), pid: 'p3', mid: 'm' + (i + 1), name: n, picks: [], add: '', at: 0 }));
  const avotes = [0, 0, 1, 0, 2, 0, 1].map((k, i) => ({ id: 'p2__k' + i, pid: 'p2', picks: [['a', 'b', 'c'][k]], add: '', at: 0 }));
  const votes = {}; att.forEach((n, i) => (votes[n] = { gid: games[0].id, mid: 'm' + (i + 1), name: n, v: '참석', uid: i ? 'x' : 'demo', at: 0 }));
  const wx = { gid: games[0].id, date: games[0].date, time: '20:00', t: 14, pop: 20, pr: 0, mx: 0, st: 0, code: 2, wind: 3, at: Date.now() };
  return { club: { name: '체험FC', owner: 'demo-owner' }, pub, me: { mid: ME.id, name: ME.name }, polls, pvotes, avotes, goals, profs, votes, wx };
}
