/* 기존 구글시트(엑셀로 내려받은 것) → A-KICK 데이터 */
(function (root) {
  'use strict';
  var C = root.Core || (typeof require !== 'undefined' ? require('./core.js') : null);

  function d10(v) {
    if (v instanceof Date) return C.ymd(v);
    var s = String(v == null ? '' : v).trim();
    var m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
  }
  function ym7(v) {
    if (v instanceof Date) return C.ymd(v).substr(0, 7);
    var s = String(v == null ? '' : v).trim().replace(/^'/, '');
    var m = s.match(/^(\d{4})[.\-](\d{1,2})/);
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
  }
  function body(rows) { return (rows || []).slice(1).filter(function (r) { return r && r.some(function (c) { return c !== null && c !== '' && c !== undefined; }); }); }
  function names(s) { return String(s || '').split(/[,+&/·]/).map(function (x) { return x.trim(); }).filter(Boolean); }

  /** get(sheetName) → 2차원 배열 */
  function fromOldSheet(get) {
    var cfgRows = body(get('⚙️설정')), raw = {};
    cfgRows.forEach(function (r) { if (r[0]) raw[String(r[0]).trim()] = r[1]; });
    var cfg = {
      fee: C.num(raw['월회비']) || 30000, guestFee: C.num(raw['게스트비']) || 10000,
      oneOff: C.num(raw['구장비_일회성']) || 120000, rentPerGame: C.num(raw['정기대관_회당']) || 60000,
      cap: C.num(raw['정원_기본']) || 12, time: String(raw['경기시간'] || '16:00'),
      before: C.num(raw['게스트매칭_전일']) || 7, after: C.num(raw['게스트매칭_후일']) || 1,
      nextMonthDay: C.num(raw['회비_다음달분_시작일']) || 25, dueDay: C.num(raw['회비마감일']) || 30,
      reserve: C.num(raw['곶간']) || 100000, openChat: String(raw['모집_오픈채팅'] || ''),
      place: String(raw['구장_이름'] || ''), account: String(raw['모임통장'] || '')
    };

    var members = body(get('회원')).filter(function (r) { return r[1]; }).map(function (r) {
      return { id: String(r[0]).trim(), name: String(r[1]).trim(), join: d10(r[2]), quit: d10(r[3]),
               state: String(r[4] || '활동').trim(), fee: C.num(r[5]) || 0, payers: [], note: '' };
    });
    var byId = {}; members.forEach(function (m) { byId[m.id] = m; });
    body(get('별칭')).forEach(function (r) {
      var m = byId[String(r[0]).trim()], p = String(r[2] || '').trim();
      if (m && p && m.payers.indexOf(p) < 0) m.payers.push(p);
    });
    members.forEach(function (m) { if (!m.payers.length) m.payers.push(m.name); });

    var gr = get('경기') || [], hdr = gr[0] || [], games = [];
    body(gr).forEach(function (r) {
      if (!r[0] || !/^G\d{8}/.test(String(r[0]))) return;
      var date = d10(r[1]); if (!date) return;
      var att = [];
      for (var c = 16; c < hdr.length; c++) if (hdr[c] && r[c] === true) att.push(String(hdr[c]).trim());
      games.push({ id: String(r[0]).trim(), date: date, time: String(r[3] || cfg.time), type: String(r[4] || ''),
                   fee: C.num(r[5]), cap: C.num(r[6]) || cfg.cap, attend: att, deadline: '' });
    });

    var rawTx = {};
    body(get('거래원본')).forEach(function (r) {
      if (!r[0]) return;
      rawTx[String(r[0])] = { bal: C.num(r[4]), type: String(r[5] || ''), memo: String(r[7] || ''), src: String(r[9] || '자동') };
    });
    var txs = [];
    body(get('거래분류')).forEach(function (r) {
      if (!r[0]) return;
      var id = String(r[0]), rw = rawTx[id] || {};
      if (rw.src === '수기') return;                     // 수기 입력은 실제 거래로 대체된 것만 남김
      var t = { id: id, dt: String(r[1]).trim(), kind: String(r[2]).trim(), amt: C.num(r[3]), desc: String(r[4] || '').trim(),
                bal: rw.bal || 0, type: rw.type || '', memo: rw.memo || '' };
      var cls = String(r[5] || ''), tName = String(r[7] || ''), ym = ym7(r[8]), gid = String(r[9] || ''),
          state = String(r[10] || '신규'), note = String(r[12] || ''), cnt = C.num(r[13]) || 1;
      t.note = note;
      t.state = state === '무시' ? '무시' : (state === '확인완료' ? '확인' : (state === '확인필요' || state === '신규' ? '확인필요' : '확인'));
      t.parts = [];
      if (/상계/.test(cls)) { t.state = '무시'; t.reason = '취소·환불 상계'; }
      else if (cls === '회비') {
        var ns = names(tName); if (!ns.length) ns = [t.desc];
        var due = ns.reduce(function (a, n) { var m = members.filter(function (x) { return x.name === n; })[0]; return a + ((m && m.fee) || cfg.fee); }, 0);
        if (/중간가입/.test(note)) due = t.amt;
        if (t.amt > due && (t.amt - due) % cfg.guestFee === 0) {
          var ng = C.nextGameAfter(games, t.dt);
          t.parts.push({ cls: '회비', amt: due, names: ns, ym: ym });
          t.parts.push({ cls: '게스트비', amt: t.amt - due, cnt: (t.amt - due) / cfg.guestFee, name: ns[0], gid: ng ? ng.id : '', self: true });
        } else t.parts.push({ cls: '회비', amt: t.amt, names: ns, ym: ym });
      }
      else if (/게스트비/.test(cls)) t.parts.push({ cls: '게스트비', amt: t.amt, cnt: cnt, name: tName || t.desc, gid: gid });
      else if (/구장비|정기대관/.test(cls)) t.parts.push(ym ? { cls: '구장비', amt: t.amt, ym: ym } : { cls: '구장비', amt: t.amt, gid: gid });
      else if (cls === '이자') { t.state = '확인'; t.parts.push({ cls: '이자', amt: t.amt }); }
      else if (cls === '기타지출' || cls === '기타수입' || cls === '환불') t.parts.push({ cls: cls, amt: t.amt, name: tName });
      else if (cls) t.parts.push({ cls: t.kind === '입금' ? '기타수입' : '기타지출', amt: t.amt, name: tName });
      txs.push(t);
    });

    var skills = {}, bundles = {};
    body(get('🔒실력')).forEach(function (r) {
      var n = String(r[0] || '').trim(); if (!n) return;
      var s = C.num(r[1]); if (s >= 1 && s <= 5) skills[n] = s;
      if (r[4]) bundles[n] = String(r[4]).trim();
    });
    return { cfg: cfg, members: members, games: games, txs: txs, skills: skills, bundles: bundles };
  }

  var Importer = { fromOldSheet: fromOldSheet };
  if (typeof module !== 'undefined' && module.exports) module.exports = Importer; else root.Importer = Importer;
})(this);
