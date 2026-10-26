/* A-KICK core — 화면·서버와 무관한 계산만 모아둔 파일 (브라우저·노드 공용) */
(function (root) {
  'use strict';

  /* ---------- MD5 (기존 구글시트 거래ID와 같은 값을 만들기 위해) ---------- */
  function md5(str) {
    var bytes = unescape(encodeURIComponent(str));
    function add(x, y) { var l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
    function rol(n, c) { return (n << c) | (n >>> (32 - c)); }
    function cmn(q, a, b, x, s, t) { return add(rol(add(add(a, q), add(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
    var n = bytes.length, words = [], i;
    for (i = 0; i < n; i++) words[i >> 2] |= bytes.charCodeAt(i) << ((i % 4) * 8);
    words[n >> 2] |= 0x80 << ((n % 4) * 8);
    words[(((n + 8) >> 6) << 4) + 14] = n * 8;
    var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (i = 0; i < words.length; i += 16) {
      var oa = a, ob = b, oc = c, od = d, w = function (k) { return words[i + k] | 0; };
      a = ff(a, b, c, d, w(0), 7, -680876936); d = ff(d, a, b, c, w(1), 12, -389564586); c = ff(c, d, a, b, w(2), 17, 606105819); b = ff(b, c, d, a, w(3), 22, -1044525330);
      a = ff(a, b, c, d, w(4), 7, -176418897); d = ff(d, a, b, c, w(5), 12, 1200080426); c = ff(c, d, a, b, w(6), 17, -1473231341); b = ff(b, c, d, a, w(7), 22, -45705983);
      a = ff(a, b, c, d, w(8), 7, 1770035416); d = ff(d, a, b, c, w(9), 12, -1958414417); c = ff(c, d, a, b, w(10), 17, -42063); b = ff(b, c, d, a, w(11), 22, -1990404162);
      a = ff(a, b, c, d, w(12), 7, 1804603682); d = ff(d, a, b, c, w(13), 12, -40341101); c = ff(c, d, a, b, w(14), 17, -1502002290); b = ff(b, c, d, a, w(15), 22, 1236535329);
      a = gg(a, b, c, d, w(1), 5, -165796510); d = gg(d, a, b, c, w(6), 9, -1069501632); c = gg(c, d, a, b, w(11), 14, 643717713); b = gg(b, c, d, a, w(0), 20, -373897302);
      a = gg(a, b, c, d, w(5), 5, -701558691); d = gg(d, a, b, c, w(10), 9, 38016083); c = gg(c, d, a, b, w(15), 14, -660478335); b = gg(b, c, d, a, w(4), 20, -405537848);
      a = gg(a, b, c, d, w(9), 5, 568446438); d = gg(d, a, b, c, w(14), 9, -1019803690); c = gg(c, d, a, b, w(3), 14, -187363961); b = gg(b, c, d, a, w(8), 20, 1163531501);
      a = gg(a, b, c, d, w(13), 5, -1444681467); d = gg(d, a, b, c, w(2), 9, -51403784); c = gg(c, d, a, b, w(7), 14, 1735328473); b = gg(b, c, d, a, w(12), 20, -1926607734);
      a = hh(a, b, c, d, w(5), 4, -378558); d = hh(d, a, b, c, w(8), 11, -2022574463); c = hh(c, d, a, b, w(11), 16, 1839030562); b = hh(b, c, d, a, w(14), 23, -35309556);
      a = hh(a, b, c, d, w(1), 4, -1530992060); d = hh(d, a, b, c, w(4), 11, 1272893353); c = hh(c, d, a, b, w(7), 16, -155497632); b = hh(b, c, d, a, w(10), 23, -1094730640);
      a = hh(a, b, c, d, w(13), 4, 681279174); d = hh(d, a, b, c, w(0), 11, -358537222); c = hh(c, d, a, b, w(3), 16, -722521979); b = hh(b, c, d, a, w(6), 23, 76029189);
      a = hh(a, b, c, d, w(9), 4, -640364487); d = hh(d, a, b, c, w(12), 11, -421815835); c = hh(c, d, a, b, w(15), 16, 530742520); b = hh(b, c, d, a, w(2), 23, -995338651);
      a = ii(a, b, c, d, w(0), 6, -198630844); d = ii(d, a, b, c, w(7), 10, 1126891415); c = ii(c, d, a, b, w(14), 15, -1416354905); b = ii(b, c, d, a, w(5), 21, -57434055);
      a = ii(a, b, c, d, w(12), 6, 1700485571); d = ii(d, a, b, c, w(3), 10, -1894986606); c = ii(c, d, a, b, w(10), 15, -1051523); b = ii(b, c, d, a, w(1), 21, -2054922799);
      a = ii(a, b, c, d, w(8), 6, 1873313359); d = ii(d, a, b, c, w(15), 10, -30611744); c = ii(c, d, a, b, w(6), 15, -1560198380); b = ii(b, c, d, a, w(13), 21, 1309151649);
      a = ii(a, b, c, d, w(4), 6, -145523070); d = ii(d, a, b, c, w(11), 10, -1120210379); c = ii(c, d, a, b, w(2), 15, 718787259); b = ii(b, c, d, a, w(9), 21, -343485551);
      a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
    }
    var out = '';
    [a, b, c, d].forEach(function (v) { for (var j = 0; j < 4; j++) out += ('0' + ((v >> (j * 8)) & 255).toString(16)).slice(-2); });
    return out;
  }

  /* ---------- 날짜 도우미 ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dtStr(d) { return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function dtDate(s) { return String(s).substr(0, 10).replace(/\./g, '-'); }          // '2026.10.18 ..' → '2026-10-18'
  function ymOf(s) { return String(s).substr(0, 7).replace('.', '-'); }
  function addYM(ym, k) { var y = +ym.substr(0, 4), m = +ym.substr(5, 2) + k; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + '-' + pad(m); }
  function addDays(dateS, k) { var d = new Date(dateS + 'T00:00:00'); d.setDate(d.getDate() + k); return ymd(d); }
  function dayName(dateS) { return '일월화수목금토'[new Date(dateS + 'T00:00:00').getDay()]; }
  function comma(n) { return (n < 0 ? '−' : '') + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function txId(dt, amt, desc, bal) { return md5(dt + '|' + amt + '|' + desc + '|' + bal).substr(0, 12); }

  /* ---------- 카카오뱅크 엑셀 읽기 (rows = 2차원 배열) ---------- */
  function parseBankRows(rows, map) {
    var hr = -1, idx = {};
    for (var r = 0; r < rows.length && hr < 0; r++) {
      for (var c = 0; c < rows[r].length; c++) {
        if (String(rows[r][c] == null ? '' : rows[r][c]).replace(/\s/g, '') === '거래일시') { hr = r; break; }
      }
    }
    if (hr >= 0) rows[hr].forEach(function (h, c) { var k = String(h == null ? '' : h).replace(/\s/g, ''); if (k) idx[k] = c; });
    // 카카오뱅크 양식이 아니면 → 다른 은행 자동 인식 (카카오는 예전과 똑같이 읽어서 거래 번호가 바뀌지 않게)
    if (hr < 0 || ['구분', '거래금액', '거래후잔액'].some(function (k) { return idx[k] === undefined; })) {
      var g0 = map || guessBank(rows);
      if (!g0) { var e = new Error('통장 엑셀의 칸을 자동으로 못 찾았어요'); e.code = 'NEED_MAP'; throw e; }
      return parseWith(rows, g0);
    }
    var out = [];
    for (var i = hr + 1; i < rows.length; i++) {
      var row = rows[i], raw = row[idx['거래일시']];
      if (raw == null || raw === '') continue;
      var dt = raw instanceof Date ? dtStr(raw) : String(raw).trim().replace(/-/g, '.');
      if (!/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/.test(dt)) continue;
      var g = function (k) { return idx[k] !== undefined && row[idx[k]] != null ? String(row[idx[k]]).trim() : ''; };
      var amt = Math.abs(num(row[idx['거래금액']])), bal = num(row[idx['거래후잔액']]), desc = g('내용');
      out.push({ id: txId(dt, amt, desc, bal), dt: dt, kind: g('구분'), amt: amt, bal: bal,
                 type: g('거래구분'), desc: desc, memo: g('메모') });
    }
    return out;
  }

  /* ---------- 다른 은행 통장 엑셀: 칸 이름으로 자동 인식 ---------- */
  var BANKCOL = {
    dt: ['거래일시', '거래일자', '거래일', '일자', '날짜', '거래날짜', '일시', '처리일시', '거래일자및시간', '거래일시분'],
    tm: ['거래시간', '시간', '시각', '거래시각'],
    in: ['입금액', '입금', '입금금액', '맡기신금액', '받은금액', '들어온금액', '입금된금액'],
    out: ['출금액', '출금', '출금금액', '지급', '찾으신금액', '보낸금액', '지급금액', '나간금액', '출금된금액'],
    amt: ['거래금액', '금액', '이체금액'],
    kind: ['구분', '입출금구분', '입출구분', '입/출금', '입출금', '거래유형'],
    desc: ['보낸분/받는분', '상대계좌예금주명', '거래기록사항', '받는분/보낸분', '입금자명', '입금자', '상대방', '상대방명', '거래처', '의뢰인/수취인', '기재내용', '통장표시내용', '받는분', '보낸분', '내용', '거래내용', '적요'],
    bal: ['거래후잔액', '잔액', '거래후잔고', '잔고', '남은금액'],
    memo: ['메모', '비고'],
    type: ['거래구분', '거래종류', '적요', '거래방법']
  };
  var hnorm = function (v) { return String(v == null ? '' : v).replace(/\s|\(원\)|\(₩\)|\*/g, ''); };
  function colsOf(head) {
    var c = {}, used = {};
    ['dt', 'tm', 'in', 'out', 'amt', 'bal', 'desc', 'kind', 'memo', 'type'].forEach(function (k) {
      for (var j = 0; j < BANKCOL[k].length && c[k] === undefined; j++) {
        for (var i = 0; i < head.length; i++) if (!used[i] && hnorm(head[i]) === BANKCOL[k][j]) { c[k] = i; used[i] = 1; break; }
      }
    });
    return c;
  }
  function guessBank(rows) {
    for (var r = 0; r < Math.min(rows.length, 40); r++) {
      var c = colsOf(rows[r] || []);
      if (c.dt !== undefined && (c.amt !== undefined || c.in !== undefined || c.out !== undefined) && c.desc !== undefined) return { hr: r, c: c };
    }
    return null;
  }
  function bankDt(v, t) {
    if (v == null || v === '') return '';
    var d = '', tm = '';
    if (v instanceof Date) { d = dtStr(v); if (t == null || t === '') return d; d = d.substr(0, 10); }
    else if (typeof v === 'number' && v > 20000 && v < 80000) { var x = new Date(Math.round((v - 25569) * 864e5)); var s0 = new Date(x.getTime() + x.getTimezoneOffset() * 6e4); d = dtStr(s0); if (t == null || t === '') return d; d = d.substr(0, 10); }
    else {
      var s = String(v).trim(), m = s.match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})(?:\D+(\d{1,2}):?(\d{2})(?::?(\d{2}))?)?/);
      if (!m) return '';
      d = m[1] + '.' + pad(+m[2]) + '.' + pad(+m[3]);
      if (m[4] !== undefined) tm = pad(+m[4]) + ':' + m[5] + ':' + (m[6] || '00');
    }
    if (!tm && t != null && t !== '') {
      if (t instanceof Date) tm = pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds());
      else if (typeof t === 'number' && t < 1) { var sec = Math.round(t * 86400); tm = pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60); }
      else { var q = String(t).replace(/\D/g, ''); if (q.length >= 4) tm = q.substr(0, 2) + ':' + q.substr(2, 2) + ':' + (q.substr(4, 2) || '00'); }
    }
    return d.length === 10 ? d + ' ' + (tm || '00:00:00') : d;
  }
  function parseWith(rows, g) {
    var c = g.c, out = [];
    var cell = function (row, k) { return c[k] !== undefined && row[c[k]] != null ? String(row[c[k]]).trim() : ''; };
    for (var i = g.hr + 1; i < rows.length; i++) {
      var row = rows[i] || [], dt = bankDt(row[c.dt], c.tm !== undefined ? row[c.tm] : null);
      if (!/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/.test(dt)) continue;
      var vi = c.in !== undefined ? Math.abs(num(row[c.in])) : 0, vo = c.out !== undefined ? Math.abs(num(row[c.out])) : 0, kind = '', amt = 0;
      if (vi || vo) { kind = vi ? '입금' : '출금'; amt = vi || vo; }
      else if (c.amt !== undefined) {
        var a = num(row[c.amt]), k = cell(row, 'kind');
        if (!a) continue;
        kind = a < 0 || /출|지급|^-$/.test(k) ? '출금' : '입금'; amt = Math.abs(a);
      }
      if (!amt) continue;
      var desc = cell(row, 'desc'), bal = c.bal !== undefined ? num(row[c.bal]) : 0;
      out.push({ id: txId(dt, amt, desc, bal), dt: dt, kind: kind, amt: amt, bal: bal, type: cell(row, 'type'), desc: desc, memo: cell(row, 'memo') });
    }
    if (!out.length) { var e = new Error('통장 엑셀에서 거래를 하나도 못 읽었어요'); e.code = 'NEED_MAP'; throw e; }
    return out;
  }
  function num(v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).replace(/[^\d.-]/g, ''); return s ? +s : 0; }


  /* ---------- 레벨: 꾸준히 1년 쓰면 50(GOAT) ---------- */
  var LV_MAX = 50;
  function lvNeed(l) { return Math.round(60 + 3.3 * l); }                     // l → l+1 에 필요한 EXP
  function lvOf(xp) {
    var l = 1, acc = 0; xp = Math.max(0, Math.floor(xp || 0));
    while (l < LV_MAX && xp >= acc + lvNeed(l)) { acc += lvNeed(l); l++; }
    return { lv: l, cur: xp - acc, need: l < LV_MAX ? lvNeed(l) : 0, xp: xp, base: acc };
  }
  var LV_BAND = [[1, '루키', 'B'], [10, '레귤러', 'S'], [20, '에이스', 'G'], [30, '캡틴', 'E'], [40, '레전드', 'P'], [50, 'GOAT', 'X']];
  function lvBand(lv) { var b = LV_BAND[0]; LV_BAND.forEach(function (x) { if (lv >= x[0]) b = x; }); return { name: b[1], key: b[2], from: b[0] }; }

  /* ---------- 날씨 (Open-Meteo · 키 없이 무료) ---------- */
  var WX = { 0: ['☀️', '맑음'], 1: ['🌤️', '대체로 맑음'], 2: ['⛅', '구름 조금'], 3: ['☁️', '흐림'], 45: ['🌫️', '안개'], 48: ['🌫️', '안개'],
    51: ['🌦️', '이슬비'], 53: ['🌦️', '이슬비'], 55: ['🌦️', '이슬비'], 56: ['🌧️', '어는 비'], 57: ['🌧️', '어는 비'], 61: ['🌧️', '비'], 63: ['🌧️', '비'], 65: ['🌧️', '강한 비'],
    66: ['🌧️', '어는 비'], 67: ['🌧️', '어는 비'], 71: ['🌨️', '눈'], 73: ['🌨️', '눈'], 75: ['❄️', '많은 눈'], 77: ['🌨️', '싸락눈'], 80: ['🌦️', '소나기'], 81: ['🌧️', '소나기'], 82: ['⛈️', '강한 소나기'],
    85: ['🌨️', '눈 소나기'], 86: ['❄️', '눈 소나기'], 95: ['⛈️', '뇌우'], 96: ['⛈️', '뇌우'], 99: ['⛈️', '뇌우'] };
  function wxLabel(code) { return WX[code] || ['🌡️', '날씨']; }
  /** 경기 날짜·시간의 날씨 (16일 이내만 예보가 있음) */
  function fetchWx(lat, lon, date, time) {
    var u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&wind_speed_unit=ms&timezone=Asia%2FSeoul&start_date=' + date + '&end_date=' + date;
    return fetch(u).then(function (r) { if (!r.ok) throw new Error('날씨 조회 실패 ' + r.status); return r.json(); }).then(function (j) {
      var h = j.hourly, k = h.time.indexOf(date + 'T' + String(time || '16:00').substr(0, 2) + ':00'); if (k < 0) k = 16;
      var k2 = Math.min(k + 1, h.time.length - 1);
      return { t: Math.round(h.temperature_2m[k]), pop: Math.max(h.precipitation_probability[k] || 0, h.precipitation_probability[k2] || 0),
               pr: Math.round(((h.precipitation[k] || 0) + (h.precipitation[k2] || 0)) * 10) / 10, code: h.weather_code[k], wind: Math.round(h.wind_speed_10m[k] * 10) / 10 };
    });
  }

  /* ---------- 회원 ---------- */
  /** 회비 시작 월 : 가입일이 1일이면 그 달, 아니면 다음 달 */
  function startYM(m) {
    if (!m.join) return '';
    var ym = m.join.substr(0, 7);
    return +m.join.substr(8, 2) === 1 ? ym : addYM(ym, 1);
  }
  /** 그 달 회비를 내야 하는 회원 */
  function membersFor(members, ym) {
    return members.filter(function (m) {
      var s = startYM(m);
      if (!s || s > ym) return false;
      if (m.quit && m.quit < ym + '-01') return false;
      if (!m.quit && m.state === '탈퇴') return false;
      return true;
    });
  }
  /** 입금자명 → 회원들 (부부처럼 한 이름에 여러 명) */
  function aliasMap(members) {
    var map = {};
    members.forEach(function (m) {
      (m.payers || [m.name]).forEach(function (p) {
        var k = String(p).replace(/\s/g, '');
        if (!k) return;
        (map[k] = map[k] || []);
        if (map[k].indexOf(m) < 0) map[k].push(m);
      });
    });
    return map;
  }

  /* ---------- 거래 집계 ---------- */
  function partsOf(t) { return t.state === '무시' ? [] : (t.parts || []); }
  function duesPaid(txs, ym) {
    var set = {};
    txs.forEach(function (t) { partsOf(t).forEach(function (p) { if (p.cls === '회비' && p.ym === ym) (p.names || []).forEach(function (n) { set[n] = 1; }); }); });
    return set;
  }
  function guestCount(txs, gid, attend) { return guestNames(txs, gid, attend || []).length; }
  /** 경기 참가 게스트 이름 목록 (대납은 '이름 일행1') */
  function guestNames(txs, gid, memberNames) {
    var out = [], seen = {};
    (memberNames || []).forEach(function (n) { seen[n] = 1; });
    // 회원 본인이 낸 경기비(self)는 게스트가 아님 → 이름만 잡아두고 인원에는 안 셈 (본인 참석은 투표로)
    txs.forEach(function (t) { partsOf(t).forEach(function (p) { if (p.cls === '게스트비' && p.gid === gid && p.self) seen[p.name || t.desc] = 1; }); });
    txs.forEach(function (t) {
      partsOf(t).forEach(function (p) {
        if (p.cls !== '게스트비' || p.gid !== gid) return;
        var base = p.name || t.desc || '게스트', cnt = p.cnt || 1;
        for (var k = 0; k < cnt; k++) {
          if (k === 0 && p.self) continue;                    // 회원 본인 경기비
          var nm = (p.names && p.names[k]) || base;      // 이름을 여러 개 적어두면 그 이름으로
          if (seen[nm] || (k > 0 && !(p.names && p.names[k]))) { var j = 1; while (seen[base + ' 일행' + j]) j++; nm = base + ' 일행' + j; }
          seen[nm] = 1; out.push(nm);
        }
      });
    });
    return out;
  }
  /** 잔액 = 통장 엑셀의 마지막 잔액 + 아직 통장에서 확인 안 된 직접 입력 건 */
  function balance(txs) {
    var s = txs.filter(function (t) { return !t.manual; }).sort(function (a, b) { return a.dt < b.dt ? -1 : 1; });
    return (s.length ? s[s.length - 1].bal || 0 : 0) + pendingManual(txs).sum;
  }
  function pendingManual(txs) {
    var m = txs.filter(function (t) { return t.manual && t.state !== '무시'; });
    return { n: m.length, sum: m.reduce(function (a, t) { return a + (t.kind === '입금' ? t.amt : -t.amt); }, 0), list: m };
  }
  /* ---------- 직접 입력 ↔ 통장 거래 짝 찾기 (구글시트 시절 기준: 같은 금액·구분, 하루 차이까지, 이름 비슷) ---------- */
  function nmCore(x) { return String(x || '').replace(/외\s*\d+/g, '').replace(/[^가-힣A-Za-z]/g, ''); }
  function nmMatch(a, b) { var x = nmCore(a), y = nmCore(b); return !!x && !!y && (x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0); }
  function dayGap(a, b) { return Math.abs((new Date(dtDate(a) + 'T00:00:00') - new Date(dtDate(b) + 'T00:00:00')) / 86400000); }
  function sameTx(m, b, days) { return m.amt === b.amt && m.kind === b.kind && dayGap(m.dt, b.dt) <= (days == null ? 1 : days) && nmMatch(m.desc, b.desc); }
  /** 직접 입력 건을 '진짜'인 통장 거래와 비교해서 무엇이 이상한지 알려줌 */
  function diagnoseManual(t, txs) {
    var bank = txs.filter(function (x) { return !x.manual && x.kind === t.kind && !/직접 입력\(/.test(x.note || ''); });
    var lastBank = txs.filter(function (x) { return !x.manual; }).map(function (x) { return dtDate(x.dt); }).sort().pop() || '';
    var d = dtDate(t.dt), near = bank.filter(function (x) { return dayGap(x.dt, t.dt) <= 3; });
    var w = function (x) { return dtDate(x.dt).substr(5).replace('-', '/') + ' ' + x.desc + ' ' + String(x.amt).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'; };
    var pick = function (f) { return near.filter(f).sort(function (a, b) { return dayGap(a.dt, t.dt) - dayGap(b.dt, t.dt); }); };
    var exact = pick(function (x) { return x.amt === t.amt && nmMatch(x.desc, t.desc); });
    if (exact.length && dayGap(exact[0].dt, t.dt) <= 1) return { code: 'dup', msg: '통장 내역에 이미 ' + w(exact[0]) + '이 있어요. 같은 돈이면 [합치기], 잘못 넣은 거면 [삭제]하세요.', cands: exact };
    if (exact.length) return { code: 'date', msg: '날짜가 다르게 들어간 것 같아요. 통장엔 ' + w(exact[0]) + '이 있어요. 같은 돈이면 [합치기]를 누르세요.', cands: exact };
    var amtDiff = pick(function (x) { return x.amt !== t.amt && nmMatch(x.desc, t.desc); });
    if (amtDiff.length) return { code: 'amt', msg: '금액이 달라요. 통장엔 ' + w(amtDiff[0]) + '이 들어왔어요. 직접 입력 금액을 잘못 넣었으면 금액을 고친 뒤 합치세요.', cands: amtDiff };
    var nameDiff = pick(function (x) { return x.amt === t.amt && dayGap(x.dt, t.dt) <= 1; });
    if (nameDiff.length) return { code: 'name', msg: '이름이 달라요. 같은 무렵 ' + w(nameDiff[0]) + '이 있어요. 다른 사람이 대신 냈다면 [합치기]를 누르세요.', cands: nameDiff };
    if (!lastBank || d > lastBank) return { code: 'wait', msg: '통장 엑셀이 아직 이 날짜(' + d.substr(5).replace('-', '/') + ')까지 안 들어왔어요. 엑셀을 넣으면 자동으로 맞춰봐요.', cands: [] };
    return { code: 'none', msg: '이 날짜 앞뒤로 통장에 비슷한 거래가 없어요. 날짜·이름·금액을 다시 확인하고, 현금으로 받은 돈이면 통장에 넣은 날짜로 고치세요.', cands: near.filter(function (x) { return x.amt === t.amt; }).slice(0, 3) };
  }
  /** 통장 잔액 이어짐 검사: 앞 거래 잔액 ± 금액 = 이번 잔액이 아니면 그 사이 거래가 엑셀에서 빠진 것 */
  function balanceGaps(txs) {
    var b = txs.filter(function (x) { return !x.manual && typeof x.bal === 'number'; }).sort(function (a, c) { return a.dt < c.dt ? -1 : a.dt > c.dt ? 1 : 0; });
    var groups = [];                                                   // 같은 시각 거래는 순서가 섞일 수 있어 한 묶음으로
    b.forEach(function (x) { var g = groups[groups.length - 1]; if (g && g.dt === x.dt) g.list.push(x); else groups.push({ dt: x.dt, list: [x] }); });
    var out = [];
    for (var i = 1; i < groups.length; i++) {
      var prev = groups[i - 1].list, cur = groups[i].list;
      var start = prev.map(function (x) { return x.bal; }), net = cur.reduce(function (a, x) { return a + (x.kind === '입금' ? x.amt : -x.amt); }, 0);
      var ends = cur.map(function (x) { return x.bal; });
      var ok = start.some(function (s0) { return ends.some(function (e) { return s0 + net === e; }); }) ||
               (cur.length === 1 && start.some(function (s0) { return s0 + net === ends[0]; }));
      if (!ok) out.push({ from: prev[prev.length - 1].dt, to: cur[0].dt, diff: ends[ends.length - 1] - (start[start.length - 1] + net) });
    }
    return out;
  }
  /** 새로 들어온 통장 거래(fresh)마다 짝이 되는 직접 입력 건 1:1로 찾기 → [[통장건, 직접입력건], ...] */
  function matchManual(fresh, txs) {
    var man = txs.filter(function (t) { return t.manual; }), used = {}, out = [];
    fresh.forEach(function (b) {
      var best = null, bd = 9;
      man.forEach(function (m) { if (used[m.id] || !sameTx(m, b)) return; var g = dayGap(m.dt, b.dt); if (g < bd) { best = m; bd = g; } });
      if (best) { used[best.id] = 1; out.push([b, best]); }
    });
    return out;
  }
  /** 월 장부 (회비는 귀속월, 게스트비·구장비는 경기 달) */
  function book(txs, games, ym) {
    var gYM = {}; games.forEach(function (g) { gYM[g.id] = g.date.substr(0, 7); });
    var o = { fee: 0, guest: 0, guestN: 0, field: 0, etcIn: 0, etcOut: 0 };
    txs.forEach(function (t) {
      partsOf(t).forEach(function (p) {
        var when = p.ym || (p.gid && gYM[p.gid]) || ymOf(t.dt);
        if (when !== ym) return;
        if (p.cls === '회비' || p.cls === '첫달회비') o.fee += p.amt;
        else if (p.cls === '게스트비') { o.guest += p.amt; o.guestN += p.cnt || 1; }
        else if (p.cls === '구장비') o.field += p.amt;
        else if (t.kind === '입금') o.etcIn += p.amt; else o.etcOut += p.amt;
      });
    });
    o.net = o.fee + o.guest + o.etcIn - o.field - o.etcOut;
    return o;
  }

  /* ---------- 자동 분류 ---------- */
  /** 입금 날짜 기준 게스트비가 연결될 경기 : 경기 하루 뒤 ~ 7일 전 입금 */
  function nearestGame(games, dt, cfg) {
    var d = dtDate(dt), next = null, prev = null;
    games.forEach(function (g) {
      if (g.date >= d && g.date <= addDays(d, cfg.before || 7) && (!next || g.date < next.date)) next = g;
      if (g.date < d && g.date >= addDays(d, -(cfg.after || 1)) && (!prev || g.date > prev.date)) prev = g;
    });
    return next || prev;                                // 다가오는 경기 우선, 없으면 바로 전 경기(늦게 낸 돈)
  }
  function nextGameAfter(games, dt) {
    var d = dtDate(dt), best = null;
    games.forEach(function (g) { if (g.date > d && (!best || g.date < best.date)) best = g; });
    return best;
  }
  function gamesInMonth(games, ym) { return games.filter(function (g) { return g.date.substr(0, 7) === ym; }); }
  /** 첫 달 회비 = 가입일 이후 그 달 남은 경기 × 게스트비 (월회비를 넘지 않음) */
  function firstMonth(m, games, cfg) {
    if (!m.join) return null;
    var ym = m.join.substr(0, 7);
    var left = gamesInMonth(games, ym).filter(function (g) { return g.date > m.join; });   // 가입한 날 경기는 게스트비로
    return { ym: ym, games: left.map(function (g) { return g.id; }), amt: Math.min(left.length * cfg.guestFee, m.fee || cfg.fee) };
  }

  /**
   * 새 거래 한 건을 분류. done = 이미 분류된 거래들 (회비 중복 확인용)
   * 반환 { parts, state: '자동'|'확인필요'|'무시', reason, suggest }
   */
  function classify(t, ctx) {
    var cfg = ctx.cfg, games = ctx.games, members = ctx.members, done = ctx.done;
    var GF = cfg.guestFee, FEE = cfg.fee;
    var key = t.desc.replace(/\s/g, ''), hit = ctx.alias[key] || null, partial = false;
    if (!hit && /[,·+&\/]/.test(t.desc)) {             // '원현정, 정진호' 처럼 여러 이름
      var multi = [], okAll = t.desc.split(/[,·+&\/]/).every(function (x) {
        var hs = ctx.alias[x.replace(/\s/g, '')]; if (!hs) return false;
        hs.forEach(function (m) { if (multi.indexOf(m) < 0) multi.push(m); }); return true;
      });
      if (okAll && multi.length) hit = multi;
    }
    if (!hit) {                                         // '서유준 용병' → 서유준 대납 후보
      var first = t.desc.split(/[\s(]/)[0];
      if (first && first !== t.desc && ctx.alias[first]) { hit = ctx.alias[first]; partial = true; }
    }
    if (hit) {                                          // 가입하기 전 입금은 회원 돈이 아님 (게스트)
      var dd = dtDate(t.dt), ng0 = nextGameAfter(games, t.dt);
      hit = hit.filter(function (m) {
        if (!m.join || m.join <= dd) return true;
        // 가입 직전 입금: 그 돈이 가입 후 경기를 위한 것이면 회원 돈으로 봄 (예: 1일 가입자의 선납, 첫 달 회비)
        return m.join <= addDays(dd, 14) && ng0 && ng0.date > m.join;
      });
      if (!hit.length) { hit = null; partial = false; }
    }
    function guestPart(n, name) {
      var g = nearestGame(games, t.dt, cfg);
      return { cls: '게스트비', amt: n * GF, cnt: n, name: name, gid: g ? g.id : '' };
    }
    function need(reason, suggest) { return { parts: [], state: '확인필요', reason: reason, suggest: suggest || null }; }

    if (t.kind === '입금') {
      if (/이자/.test(t.desc) || /예금이자/.test(t.type)) return { parts: [{ cls: '이자', amt: t.amt }], state: '자동', reason: '통장 이자' };
      if (/취소/.test(t.desc)) return need('취소 입금이에요. 같은 금액 출금과 짝이면 "무시"를 눌러주세요.', { label: '무시', state: '무시' });

      // 동명이인: 같은 입금자명을 가진 회원이 둘 이상이고 금액이 '전원 합계'가 아니면 자동으로 정하지 않음
      // (부부·가족이 대신 내는 경우와 구분: 실제 이름(realName, 없으면 표시 이름)이 입금자명과 같은 회원이 둘 이상일 때만)
      if (hit && !partial) {
        var twins = hit.filter(function (m) { return String(m.realName || m.name).replace(/\s/g, '') === key; });
        if (twins.length > 1) return need('동명이인 ' + twins.map(function (m) { return m.name; }).join('·') + ' — 누구 돈인지 골라주세요');
      }
      if (hit && !partial) {
        var dtYM = ymOf(t.dt), day = +t.dt.substr(8, 2);
        // 1) 첫 달 회비 (회비 시작 전 달에 예정 금액이 들어오면)
        for (var i = 0; i < hit.length; i++) {
          var m = hit[i];
          if (dtYM <= startYM(m) && m.name === t.desc.trim()) {
            var fm = firstMonth(m, games, cfg);
            if (fm && fm.ym === dtYM && fm.amt === t.amt && fm.games.length)
              return { parts: [{ cls: '첫달회비', amt: t.amt, names: [m.name], ym: dtYM, games: fm.games }], state: '자동', reason: m.name + ' 첫 달 회비 (' + fm.games.length + '경기)' };
          }
        }
        // 2) 회비 (부부 등 여러 명 포함). 25일부터는 다음 달분
        var payers = hit.filter(function (m) { return startYM(m); });
        var self = payers.filter(function (m) { return m.name === t.desc.trim(); });
        if (payers.length > 1 && !self.length && hit !== ctx.alias[key]) self = [];
        var sets = [payers]; if (self.length && self.length < payers.length) sets.push(self);
        for (var s = 0; s < sets.length; s++) {
          var M = sets[s]; if (!M.length) continue;
          var total = M.reduce(function (a, m) { return a + (m.fee || FEE); }, 0);
          var base = day >= (cfg.nextMonthDay || 25) ? addYM(dtYM, 1) : dtYM;
          var st = M.map(startYM).sort().pop(); if (base < st) base = st;
          var paid = duesPaid(done, base);
          if (M.every(function (m) { return paid[m.name]; })) base = addYM(base, 1);
          var names = M.map(function (m) { return m.name; });
          if (t.amt === total) return { parts: [{ cls: '회비', amt: total, names: names, ym: base }], state: '자동', reason: base.substr(5, 2) * 1 + '월 회비' + (names.length > 1 ? ' (' + names.join('·') + ')' : '') };
          var rest = t.amt - total;
          var ng = nextGameAfter(games, t.dt);
          if (rest > 0 && rest % GF === 0 && rest < FEE && ng && ng.date <= addDays(dtDate(t.dt), 7)) {
            return { parts: [{ cls: '회비', amt: total, names: names, ym: base },
                             { cls: '게스트비', amt: rest, cnt: rest / GF, name: names[0], gid: ng.id, self: true }],
                     state: '자동', reason: base.substr(5, 2) * 1 + '월 회비 + 경기비 ' + rest / GF + '명' };
          }
        }
        // 3) 회비보다 적은 1만원 단위 = 게스트비(가입 전) 또는 친구 대납
        if (t.amt % GF === 0 && t.amt < FEE) {
          var n = t.amt / GF, mm = hit[0];
          return { parts: [guestPart(n, mm.name)], state: '자동',
                   reason: (dtYM < startYM(mm) ? '가입 전 게스트비' : '회원 대납') + ' ' + n + '명' };
        }
        return need(hit.map(function (m) { return m.name; }).join('·') + ' 님 입금인데 예정 금액과 달라요.', { label: '회비', cls: '회비' });
      }
      if (hit && partial && t.amt % GF === 0 && t.amt < FEE) {
        return { parts: [guestPart(t.amt / GF, hit[0].name)], state: '자동', reason: hit[0].name + ' 님 친구 대납 ' + t.amt / GF + '명' };
      }
      if (t.amt % GF === 0 && t.amt < FEE) {
        var n2 = t.amt / GF;
        return { parts: [guestPart(n2, t.desc.trim())], state: '자동', reason: '게스트 ' + n2 + '명' };
      }
      if (t.amt < GF && t.amt >= GF * 0.8)
        return need('게스트비에서 수수료가 빠진 금액 같아요.', { label: '게스트 1명', cls: '게스트비', cnt: 1 });
      return need('예정에 없는 입금이에요.');
    }

    // 출금
    var ym0 = ymOf(t.dt);
    for (var k = 0; k <= 1; k++) {
      var ymk = addYM(ym0, k), cnt = gamesInMonth(games, ymk).length;
      if (cfg.rentPerGame && cnt && t.amt === cnt * cfg.rentPerGame)
        return { parts: [{ cls: '구장비', amt: t.amt, ym: ymk, note: '정기대관 ' + cnt + '회' }], state: '자동', reason: (+ymk.substr(5, 2)) + '월 정기대관 ' + cnt + '회' };
    }
    if (cfg.oneOff && t.amt === cfg.oneOff) {
      var g1 = nextGameAfter(games, t.dt);
      return { parts: [{ cls: '구장비', amt: t.amt, gid: g1 ? g1.id : '' }], state: '자동', reason: '일회성 구장비' };
    }
    var who = (t.desc.match(/\(([^)]+)\)/) || [])[1];
    if (who) return need(who + ' 님에게 보낸 돈이에요.', { label: '환불', cls: '환불', name: who });
    return need('예정에 없는 출금이에요.');
  }

  /** 48시간 안에 같은 사람·같은 금액의 입금과 출금 → 서로 상계(무시) */
  function pairRefunds(list, hours) {
    var lim = (hours || 48) * 3600000, out = [];
    function ms(s) { return new Date(dtDate(s) + 'T' + s.substr(11)).getTime(); }
    function who(t) { return ((t.desc.match(/\(([^)]+)\)/) || [])[1] || t.desc).replace(/\s/g, ''); }
    list.forEach(function (a) {
      if (a.kind !== '출금' || a._paired) return;
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        if (b === a || b._paired || b.kind !== '입금' || b.amt !== a.amt) continue;
        if (who(b) !== who(a)) continue;
        if (Math.abs(ms(a.dt) - ms(b.dt)) > lim) continue;
        a._paired = b._paired = true; out.push([b, a]); break;
      }
    });
    return out;
  }

  /** 포메이션 자리는 그대로, 누가 어느 자리에 설지만 랜덤 (같은 경기·팀이면 항상 같은 순서) */
  function order(names, seed) {
    return names.map(function (n) { return [md5(String(seed) + '|' + n), n]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).map(function (x) { return x[1]; });
  }
  /** 골·도움 통계. games: [{id,date,players[]}], goals: [{gid,scorer,assist}], ym: '' 전체 또는 'YYYY-MM', base: 기본 표시할 이름들 */
  function statTable(games, goals, ym, base) {
    var R = {}, gs = games.filter(function (g) { return !ym || g.date.substr(0, 7) === ym; }), ids = {};
    function row(n) { return R[n] = R[n] || { name: n, gp: 0, g: 0, a: 0, ap: 0 }; }
    (base || []).forEach(row);
    gs.forEach(function (g) { ids[g.id] = 1; (g.players || []).forEach(function (n) { row(n).gp++; }); });
    goals.forEach(function (x) { if (!ids[x.gid]) return; if (x.scorer) { row(x.scorer).g++; row(x.scorer).ap++; } if (x.assist) { row(x.assist).a++; row(x.assist).ap++; } });
    return Object.keys(R).map(function (k) { return R[k]; });
  }
  /** 경기 점수: 팀 편성 기준 [A팀 골, B팀 골, C팀 골] */
  function score(game, goals) {
    var T = game.teams || [], s = T.map(function () { return 0; });
    goals.forEach(function (x) { if (x.gid !== game.id) return; T.forEach(function (t, i) { if (t.indexOf(x.scorer) >= 0) s[i]++; }); });
    return s;
  }
  /* ---- 팀 테마: 메인 · 서브1(포인트) · 서브2(바탕) ---- */
  // 색 역할: c[0] 메인(상단 배경) · c[1] 서브1(버튼·강조 글씨) · c[2] 서브2(포인트: 배지·카드 선)
  // c: [메인, 서브1, 서브2] · g: 오로라 그라데이션 3색(프리셋 전용)
  var THEMES = [
    { id: 'navy', name: '기본 네이비', c: ['#1E3A8A', '#1E3A8A', '#60A5FA'], flat: true },
    { id: 'lavender', name: '오로라 라벤더', c: ['#E2D9FF', '#4B3A99', '#A78BFA'], g: ['#E2D9FF', '#D3CBF6', '#C6E6F4'] },
    { id: 'peach', name: '선셋 피치', c: ['#FFDCC8', '#A9472F', '#FF9F7A'], g: ['#FFDCC8', '#FFCDC3', '#FBE6B2'] },
    { id: 'lemon', name: '레몬 소다', c: ['#FAF0A2', '#2C6A4D', '#F2A93B'], g: ['#FAF0A2', '#CDEFC6', '#ACDDF1'] },
    { id: 'cotton', name: '코튼 캔디', c: ['#FFD4E6', '#A33A76', '#F48FB8'], g: ['#FFD4E6', '#EED3F3', '#CBE4FA'] }
  ];
  function hexRgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbHex(c) { return '#' + c.map(function (x) { return ('0' + Math.round(Math.max(0, Math.min(255, x))).toString(16)).slice(-2); }).join(''); }
  function mix(a, b, t) { var x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  function lum(h) { var c = hexRgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function darkTo(c, L) { var k = 0; while (lum(c) > L && k++ < 20) c = mix(c, '#000000', 0.08); return c; }
  function toHsl(h) { var c = hexRgb(h).map(function (v) { return v / 255; }), mx = Math.max.apply(0, c), mn = Math.min.apply(0, c), l = (mx + mn) / 2, d = mx - mn, hh = 0, s = 0;
    if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === c[0] ? (c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0) : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4; hh *= 60; } return [hh, s * 100, l * 100]; }
  function hsl(h, s, l) { h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    var k = function (n) { return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l), f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return rgbHex([f(0) * 255, f(8) * 255, f(4) * 255]); }
  /** 직접 고른 색: 검정을 섞지 않고 같은 색 계열 안에서 밝기만 조절 (메인=상단 오로라, 서브1=버튼, 서브2=글씨·테두리) */
  function customTheme(main, s1, s2) {
    var M = toHsl(main), h = M[0], S = Math.max(M[1], 45), O = toHsl(s1), os = Math.max(O[1], 70), B = toHsl(s2);
    var ink = hsl(B[0], Math.max(B[1], 55), Math.min(B[2], 38));
    if (B[1] < 12) ink = hsl(h, 65, 28);                                  // 서브2가 무채색(검정·회색)이면 메인 계열 진한 색으로
    var btn = O[1] < 12 ? [hsl(h, 70, 50), hsl(h + 15, 70, 58)] : [hsl(O[0], os, 54), hsl(O[0] + 12, os, 62)];
    var g = [hsl(h, S, 87), hsl(h + 8, S, 93), O[1] < 12 ? hsl(h - 15, S, 90) : hsl(O[0], os, 93)];
    return { '--hdr': g[0], '--grad': 'linear-gradient(120deg,' + g[0] + ' 0%,' + g[1] + ' 50%,' + g[2] + ' 100%)', '--on-hdr': ink,
      '--btn': 'linear-gradient(120deg,' + btn[0] + ',' + btn[1] + ')', '--on-btn': '#FFFFFF', '--navy': ink, '--navy-d': hsl(B[0], Math.max(B[1], 55), 24), '--navy-l': hsl(h, S, 94),
      '--tint': hsl(h, S, 95), '--acc': ink, '--on-acc': '#FFFFFF', '--bg': hsl(h, S, 97), '--bg-grad': 'linear-gradient(180deg,' + hsl(h, S, 95) + ' 0%,' + hsl(h + 8, S, 97) + ' 100%)',
      '--glow': '1', '--aur': 'aur 14s ease-in-out infinite alternate', _top: g[0] };
  }
  /** 상단·버튼은 메인색 기반 오로라 그라데이션, 글씨색은 자동 대비 */
  function applyTheme(t) {
    var d = THEMES[0].c, main = (t && t.main) || d[0], s1 = (t && t.sub1) || d[1], acc = (t && t.sub2) || d[2];
    var pre = THEMES.filter(function (x) { return x.c[0].toLowerCase() === String(main).toLowerCase() && x.c[1].toLowerCase() === String(s1).toLowerCase() && x.c[2].toLowerCase() === String(acc).toLowerCase(); })[0];
    if (!pre) { var cv = customTheme(main, s1, acc); if (typeof document === 'undefined') return cv; var rs = document.documentElement.style;
      Object.keys(cv).forEach(function (k3) { if (k3[0] === '-') rs.setProperty(k3, cv[k3]); }); var mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute('content', cv._top); return cv; }
    var g = pre ? (pre.g || [main, main, main]) : [main, mix(main, '#FFFFFF', 0.4), mix(main, s1, 0.22)];
    var light = (lum(g[0]) + lum(g[1]) + lum(g[2])) / 3 > 0.4;
    var ink = darkTo(s1, 0.12), onHdr = light ? ink : '#FFFFFF';
    var grad = 'linear-gradient(120deg,' + g[0] + ' 0%,' + g[1] + ' 50%,' + g[2] + ' 100%)';
    var btn = light ? 'linear-gradient(120deg,' + mix(g[0], ink, 0.1) + ',' + mix(g[1], ink, 0.1) + ',' + mix(g[2], ink, 0.1) + ')'
                    : 'linear-gradient(120deg,' + ink + ',' + mix(ink, acc, 0.45) + ')';
    var v = { '--hdr': g[0], '--grad': grad, '--on-hdr': onHdr, '--btn': btn, '--on-btn': light ? ink : '#FFFFFF',
      '--navy': ink, '--navy-d': mix(ink, '#000000', 0.2), '--navy-l': mix(ink, '#FFFFFF', 0.88),
      '--tint': mix(light ? g[1] : ink, '#FFFFFF', light ? 0.6 : 0.9), '--acc': acc, '--on-acc': lum(acc) > 0.4 ? '#0F172A' : '#FFFFFF',
      '--bg': mix(g[0], '#FFFFFF', 0.86), '--bg-grad': 'linear-gradient(180deg,' + mix(g[0], '#FFFFFF', 0.8) + ' 0%,' + mix(g[1], '#FFFFFF', 0.86) + ' 45%,' + mix(g[2], '#FFFFFF', 0.82) + ' 100%)' };
    if (pre && pre.flat) { v['--grad'] = main; v['--btn'] = main; v['--on-hdr'] = '#FFFFFF'; v['--on-btn'] = '#FFFFFF'; v['--navy'] = main; v['--tint'] = '#EEF3FF'; v['--bg'] = '#EEF1F5'; v['--bg-grad'] = 'none'; v['--glow'] = '0'; v['--aur'] = 'none'; }
    else { v['--glow'] = '1'; v['--aur'] = 'aur 14s ease-in-out infinite alternate'; }
    if (typeof document === 'undefined') return v;
    var r = document.documentElement.style; Object.keys(v).forEach(function (k2) { r.setProperty(k2, v[k2]); });
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', g[0]);
    return v;
  }
  var VERSION = 'v0.43';
  var Core = { diagnoseManual: diagnoseManual, balanceGaps: balanceGaps, pendingManual: pendingManual, matchManual: matchManual, sameTx: sameTx, nmMatch: nmMatch, dayGap: dayGap, VERSION: VERSION, THEMES: THEMES, applyTheme: applyTheme, statTable: statTable, score: score, order: order, md5: md5, txId: txId, parseBankRows: parseBankRows, lvOf: lvOf, lvNeed: lvNeed, lvBand: lvBand, LV_MAX: LV_MAX, fetchWx: fetchWx, wxLabel: wxLabel, guessBank: guessBank, parseWith: parseWith, BANKCOL: BANKCOL, num: num, ymd: ymd, dtStr: dtStr, dtDate: dtDate, ymOf: ymOf,
    addYM: addYM, addDays: addDays, dayName: dayName, comma: comma, startYM: startYM, membersFor: membersFor,
    aliasMap: aliasMap, partsOf: partsOf, duesPaid: duesPaid, guestCount: guestCount, guestNames: guestNames,
    balance: balance, book: book, nearestGame: nearestGame, nextGameAfter: nextGameAfter, gamesInMonth: gamesInMonth,
    firstMonth: firstMonth, classify: classify, pairRefunds: pairRefunds };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(this);
