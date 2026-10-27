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

/* 관리자 체험: 관리자 화면이 읽는 원본 데이터(회원·경기·통장 거래)를 메모리에 만들어 줌 (path → 문서) */
export function demoAdmin() {
  const C = window.Core, D = (d) => C.ymd(d), add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  let seed = 11; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const N = ['김민준', '이서준', '박도윤', '최예준', '정시우', '강하준', '조주원', '윤지호', '장지후', '임준우', '한도현', '오건우'];
  const st = {}, P = 'clubs/demo/', put = (p, d) => (st[P + p] = d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thu = add(today, (4 - today.getDay() + 7) % 7), gid = (d) => 'G' + D(d).replace(/-/g, '');
  const start = add(thu, -63);
  st['clubs/demo'] = { name: '체험FC', owner: 'demo', created: start.toISOString() };
  put('config/main', { fee: 40000, guestFee: 10000, oneOff: 120000, rentPerGame: 100000, cap: 14, time: '20:00', before: 7, after: 1, nextMonthDay: 25, dueDay: 25, reserve: 100000,
    place: '풋살파크 1구장', account: '체험용 계좌 0000-00-0000000', dow: 4, perSide: 5, maxSide: 6, sport: '풋살', statFrom: D(start), openChat: '' });
  N.forEach((n, i) => put('members/m' + (i + 1), { id: 'm' + (i + 1), name: n, join: D(start), quit: '', state: '활동', fee: 0, payers: [n], note: '' }));
  const sk = {}; N.forEach((n, i) => (sk[n] = [4, 3, 2, 5, 3, 4, 2, 3, 4, 1, 3, 5][i])); put('private/skills', { scores: sk, bundles: {} });
  N.forEach((n, i) => put('profiles/m' + (i + 1), { num: i === 0 ? 10 : 2 + ((i * 7) % 97), pos: [['FW', 'MF', 'DF', 'GK'][i % 4]], lv: [14, 31, 8, 22, 5, 41, 17, 3, 26, 12, 9, 50][i], xp: 0 }));
  N.slice(0, 9).forEach((n, i) => put('claims/m' + (i + 1), { uid: 'u' + i, email: '', name: n, at: 0 }));
  put('requests/r1', { name: '신입회원', email: 'new@example.com', at: Date.now() - 36e5 });
  put('suggest/s1', { text: '경기 끝나고 공 정리 당번 정하면 좋겠어요', name: '조주원', anon: false, uid: 'u6', at: Date.now() - 2 * 864e5 });
  // 경기: 지난 9주 + 다음 2주
  const split = (pl) => [pl.filter((_, i) => i % 2 === 0), pl.filter((_, i) => i % 2 === 1)];
  for (let w = 9; w >= -1; w--) {
    const d = add(thu, -7 * w), past = w >= 1, pl = past ? N.filter(() => rnd() < 0.8) : [];
    const g = { id: gid(d), date: D(d), time: '20:00', type: '정기대관', fee: 100000, cap: 14, attend: pl, deadline: D(add(d, -1)) + 'T22:00' };
    if (past) { const t = split(pl); g.teams = [t[0].join('|'), t[1].join('|')]; g.teamsPublic = true;
      const k = 3 + Math.floor(rnd() * 5); for (let i = 0; i < k; i++) { const sc = pl[Math.floor(rnd() * pl.length)]; put('goals/g' + w + '_' + i, { gid: g.id, scorer: sc, assist: '', by: 'u0', byName: N[0], at: d.getTime() }); } }
    put('games/' + g.id, g);
  }
  N.slice(0, 9).forEach((n, i) => put('votes/' + gid(thu) + '__m' + (i + 1), { gid: gid(thu), mid: 'm' + (i + 1), name: n, v: i === 4 ? '불참' : '참석', uid: 'u' + i, at: Date.now() - (i + 1) * 36e5 }));
  // 통장 거래 (지난 2달 + 이번 달)
  const txs = []; let bal = 300000, k = 0;
  const tx = (dt, kind, amt, desc, parts, state, reason) => { bal += kind === '입금' ? amt : -amt; const t = { id: 'dt' + (k++), dt, kind, amt, desc, bal, type: kind === '입금' ? '일반입금' : '일반출금', memo: '', note: '', state: state || '확인', parts }; if (reason) t.reason = reason; txs.push(t); };
  const ym0 = D(today).substr(0, 7), dd = (ym, d, h) => ym.replace('-', '.') + '.' + String(d).padStart(2, '0') + ' ' + String(h).padStart(2, '0') + ':10:00';
  const games = Object.keys(st).filter((p) => p.indexOf(P + 'games/') === 0).map((p) => st[p]);
  [C.addYM(ym0, -2), C.addYM(ym0, -1), ym0].forEach((ym, mi) => {
    tx(dd(ym, 1, 9), '출금', 400000, '풋살파크', [{ cls: '구장비', amt: 400000, ym }]);
    games.filter((g) => g.date.substr(0, 7) === ym && g.date <= D(today)).forEach((g, i) => { if (i % 2) return; const d = +g.date.substr(8, 2);
      tx(dd(ym, d, 19), '입금', 10000, '게스트' + (mi * 3 + i + 1), [{ cls: '게스트비', amt: 10000, cnt: 1, name: '게스트' + (mi * 3 + i + 1), gid: g.id }]); });
    if (mi === 1) tx(dd(ym, 18, 13), '출금', 32000, '스포츠몰', [{ cls: '기타지출', amt: 32000 }]);
    const nx = C.addYM(ym, 1), payers = mi < 2 ? N : N.slice(1, 8);
    payers.forEach((n, i) => { const d = 20 + (i % 6); if (mi === 2 && d > today.getDate()) return; tx(dd(ym, d, 10 + (i % 9)), '입금', 40000, n, [{ cls: '회비', amt: 40000, names: [n], ym: nx }]); });
  });
  // 총무가 확인할 거래 2건
  const last = D(add(today, -1)).replace(/-/g, '.');
  tx(last + ' 11:20:00', '입금', 40000, '김민준엄마', [], '확인필요', '회원 이름과 달라요');
  tx(last + ' 15:05:00', '입금', 30000, '한도현', [], '확인필요', '회비 금액(40,000원)과 달라요');
  txs.sort((a, b) => (a.dt < b.dt ? -1 : 1)); let b2 = 300000; txs.forEach((t) => { b2 += t.kind === '입금' ? t.amt : -t.amt; t.bal = b2; put('tx/' + t.id, t); });
  put('polls/p1', { title: '11월 회식 날짜 골라주세요', desc: '경기 끝나고 같이 밥 먹어요 🍖', options: [{ id: 'a', text: '첫째 주 목요일' }, { id: 'b', text: '둘째 주 목요일' }], multi: true, allowAdd: true, anon: false, deadline: D(add(today, 3)) + 'T23:00', created: new Date(Date.now() - 864e5).toISOString() });
  N.slice(1, 6).forEach((n, i) => put('pollvotes/p1__m' + (i + 2), { pid: 'p1', mid: 'm' + (i + 2), name: n, picks: [i % 2 ? 'b' : 'a'], add: '', at: 0 }));
  return st;
}
