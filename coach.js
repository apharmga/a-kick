/* 킥키: 관리자(총무) 도우미 (헤드셋 낀 축구공 캐릭터)
   - 사용법 질문 → 앱 안의 도움말에서 찾아 답하고, 해당 화면으로 바로 이동
   - "미납자 누구야?" 같은 질문 → 지금 팀 데이터로 바로 계산해서 답 (밖으로 보내지 않음) */
let X = null, open = false, log = [];
const ICON = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="53" r="35" fill="#fff"/><path d="M16 52 A34 34 0 0 1 84 52" stroke="#FFD23F" stroke-width="10" stroke-linecap="round" fill="none"/><rect x="5" y="40" width="20" height="28" rx="10" fill="#FFD23F"/><rect x="75" y="40" width="20" height="28" rx="10" fill="#FFD23F"/><path d="M84 66 Q84 86 64 86" stroke="#FFD23F" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="60" cy="86" r="8" fill="#FFD23F"/><polygon points="50,23 60,30.5 56,42 44,42 40,30.5" fill="#14306B" stroke="#14306B" stroke-width="2" stroke-linejoin="round"/><circle cx="39" cy="54" r="7" fill="#14306B"/><circle cx="61" cy="54" r="7" fill="#14306B"/><path d="M39 67 Q50 76 61 67" stroke="#14306B" stroke-width="7" fill="none" stroke-linecap="round"/></svg>';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nz = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

/* ---- 지금 팀 상황으로 답하는 질문 ---- */
const LIVE = [
  { k: ['미납', '안낸', '안냈', '회비안', '누가안'], f() {
      const S = X.S, ym = X.payYM(), list = X.C.membersFor(S.members, ym), paid = X.C.duesPaid(S.txs, ym), un = list.filter((m) => !paid[m.name]).map((m) => m.name);
      return { a: un.length ? '<b>' + (+ym.substr(5, 2)) + '월 회비 미납 ' + un.length + '명</b><br>' + un.map(esc).join(', ') : (+ym.substr(5, 2)) + '월 회비는 <b>모두 냈어요</b> 🎉', acts: un.length ? [['안내 문구 복사', () => X.duesText()], ['회원·회비 보기', () => X.go('members')]] : [] }; } },
  { k: ['잔액', '통장에얼마', '남은돈', '얼마있'], f() { return { a: '지금 통장 잔액은 <b>' + X.C.comma(X.C.balance(X.S.txs)) + '원</b>이에요. 마지막으로 올린 거래내역 기준이에요.', acts: [['장부 보기', () => X.go('ledger')]] }; } },
  { k: ['확인할거래', '확인필요', '확인해야', '처리할'], f() {
      const n = X.S.txs.filter((t) => t.state === '확인필요');
      return { a: n.length ? '확인할 거래가 <b>' + n.length + '건</b> 있어요.<br>' + n.slice(0, 5).map((t) => esc(t.desc) + ' ' + X.C.comma(t.amt) + '원' + (t.reason ? ' · <small>' + esc(t.reason) + '</small>' : '')).join('<br>') + '<br><br>카드에 있는 빠른 버튼(게스트·기타수입·무시)을 누르거나, 카드를 눌러 회비로 고르면 돼요.' : '확인할 거래가 <b>없어요</b> 👍', acts: n.length ? [['이번 주 화면으로', () => X.go('week')]] : [] }; } },
  { k: ['다음경기', '이번경기', '몇명', '참석자', '인원'], f() {
      const t = X.C.ymd(new Date()), g = X.S.games.find((x) => x.date >= t && !x.postponed);
      if (!g) return { a: '예정된 경기가 없어요. [이번 주] 화면에서 <b>+ 이번 주 경기 만들기</b>를 눌러 만들 수 있어요.', acts: [['이번 주 화면으로', () => X.go('week')]] };
      const a = X.attOf(g), cap = X.S.cfg.perSide || 5;
      return { a: '<b>' + (+g.date.substr(5, 2)) + '/' + (+g.date.substr(8, 2)) + ' ' + esc(g.time || '') + '</b> 경기 · 지금 <b>' + a.length + '명</b>' + (a.length < cap * 2 ? ' (' + (cap * 2 - a.length) + '명 더 필요)' : '') + '<br>' + a.map(esc).join(', '), acts: [['팀 편성 하러 가기', () => X.go('team')]] }; } },
  { k: ['부족', '정기대관유지', '적자', '흑자', '모자'], f() {
      const S = X.S, mem = S.members.filter((m) => m.state !== '탈퇴').length, fee = S.cfg.fee || 0, rent = (S.cfg.rentPerGame || 0) * 4, gf = S.cfg.guestFee || 10000, gap = rent - mem * fee;
      if (!rent) return { a: '설정에 <b>정기대관 회당 구장비</b>가 없어서 계산을 못 했어요. 설정 → 구장·경기 인원에서 넣어주세요.', acts: [['설정 열기', () => X.openSettings()]] };
      return { a: '한 달 대관비(4회) <b>' + X.C.comma(rent) + '원</b><br>회비 ' + mem + '명 × ' + X.C.comma(fee) + '원 = <b>' + X.C.comma(mem * fee) + '원</b><br>' + (gap > 0 ? '→ 매달 <b>' + X.C.comma(gap) + '원 부족</b> · 게스트 ' + Math.ceil(gap / gf) + '명분이에요.' : '→ 매달 <b>' + X.C.comma(-gap) + '원 남아요</b> 👍'), acts: [['장부 보기', () => X.go('ledger')]] }; } },
];

/* ---- 사용법 도움말 ---- */
const KB = [
  { q: '3파전 (3팀 로테이션)', k: ['3파전', '세팀', '3팀', '로테이션', '판결과', '승점', '삼파전'], a: '경기 카드의 [팀 편성]에서 위쪽 <b>[3파전]</b>을 누르면 3팀으로 나눠져요 (15명 이상이면 자동으로 3파전).<br>· 경기 중 판이 끝날 때마다 <b>[+ 판 결과 넣기]</b>로 점수를 넣으면 승 3점·무 1점으로 순위가 계산돼요<br>· <b>⏱ 진행 방식</b>에서 한 판 시간·휴식·판 수·시작 시간을 정하면 타임테이블이 자동으로 짜지고, 회원 화면에도 내 팀 경기/휴식 시간이 보여요<br>· <b>[⌚ 알람 받기]</b>를 누르면 판마다 시작·1분 전·종료 알림이 폰 캘린더(애플워치)에 들어가요<br>· 판 순서는 A:B → B:C → C:A 고정이라 판 수를 3의 배수(6·9·12판)로 하면 모든 팀이 똑같이 뛰고 쉬어요<br>· 팀을 회원에게 공개하면 팀과 순위가 회원 화면에도 보여요', acts: [['팀 편성 하러 가기', () => X.go('team')]] },
  { q: '통장 거래내역 엑셀 올리기', k: ['엑셀', '거래내역', '통장올', '업로드', '파일', '카카오뱅크', '은행'], a: '맨 위 <b>[거래내역 엑셀 넣기]</b>를 누르고 은행 앱에서 받은 엑셀(또는 CSV)을 고르세요.<br>· 회비·게스트비·구장비로 자동 분류돼요<br>· 이미 넣은 거래는 건너뛰어서 여러 번 올려도 괜찮아요<br>· 다른 은행 양식이면 날짜·금액·이름 열을 한 번만 골라주면 다음부터 기억해요<br>· 비밀번호 걸린 엑셀은 비밀번호를 풀고 저장한 뒤 올려주세요', acts: [['엑셀 넣기', () => { const u = document.getElementById('up'); if (u) u.click(); }]] },
  { q: '통장에 안 찍힌 돈 직접 넣기', k: ['직접입력', '현금', '수기', '직접넣', '손으로'], a: '[이번 주] 화면의 <b>[+ 직접 입력]</b>을 눌러 날짜·이름·금액을 넣으세요. 현금으로 받은 게스트비 같은 걸 넣을 때 써요. 나중에 같은 거래가 통장 엑셀로 들어오면 자동으로 짝을 맞춰요.', acts: [['이번 주 화면으로', () => X.go('week')]] },
  { q: '확인할 거래 처리하기', k: ['확인할', '노란', '처리', '분류', '잘못분류', '고치'], a: '노란 카드가 확인할 거래예요.<br>· <b>게스트 N명</b>: 게스트비로 처리<br>· <b>기타수입 / 무시</b>: 장부에 넣거나 빼기<br>· 회비라면 <b>카드를 눌러</b> 분류를 회비로, 이름과 월을 골라 저장<br>틀리게 처리해도 카드를 다시 눌러 언제든 고칠 수 있어요.', acts: [['이번 주 화면으로', () => X.go('week')]] },
  { q: '가족·지인 이름으로 들어온 회비', k: ['다른이름', '엄마', '가족', '지인', '대신', '입금자명', '동반', '이름으로', '다른사람'], a: '회원을 눌러 <b>‘통장에 찍히는 이름’</b>에 그 이름을 쉼표로 추가하세요 (예: 김민준, 김민준지인). 다음부터는 그 이름으로 들어온 돈도 그 회원 회비로 자동 처리돼요.', acts: [['회원·회비 보기', () => X.go('members')]] },
  { q: '경기 만들기 · 투표 마감 바꾸기', k: ['경기만들', '경기추가', '일정', '마감', '마감시간', '연기', '취소'], a: '[이번 주] 화면에서 <b>+ 이번 주 경기 만들기</b>로 만들어요. 기본 요일·시간은 설정에서 바꿔요.<br>투표 마감은 경기 카드의 <b>‘투표 마감 … · 바꾸기’</b>를 눌러 바꿔요. 비가 오면 경기 카드에서 연기 처리할 수 있어요.', acts: [['이번 주 화면으로', () => X.go('week')]] },
  { q: '팀 편성 (팀 짜기)', k: ['팀짜', '팀편성', '팀나누', '실력', '점수', '포메이션', '일행'], a: '경기 카드의 <b>[팀 편성]</b> → <b>[팀 짜기]</b>를 누르면 실력 점수가 비슷하게 나눠져요.<br>· 실력 점수(1~5)는 <b>관리자에게만</b> 보이고 회원에겐 안 보여요<br>· 같이 오는 일행은 같은 팀으로 묶여요<br>· 마음에 안 들면 [다시 짜기], 끝나면 공개하면 회원 화면에 떠요', acts: [['팀 편성 하러 가기', () => X.go('team')]] },
  { q: '회원 초대하기', k: ['초대', '링크', '회원추가', '들어오게', '들어오는법'], a: '<b>[회원 링크 복사]</b>를 눌러 단톡방에 붙여넣으세요. 회원이 링크로 들어와 구글 로그인 → 이름 쓰고 가입 신청 → <b>[회원·회비]</b>에서 승인하면 끝이에요.', acts: [['회원·회비 보기', () => X.go('members')]] },
  { q: '가입 신청 승인하기', k: ['승인', '신청', '거절', '대기'], a: '[회원·회비] 맨 위에 가입 신청이 떠요. 기존 회원이면 목록에서 이름을 고르고, 새 사람이면 <b>‘새 회원으로 등록’</b>을 고른 뒤 <b>[승인]</b>을 누르세요.', acts: [['회원·회비 보기', () => X.go('members')]] },
  { q: '회원 탈퇴 · 강퇴', k: ['탈퇴', '강퇴', '내보내', '삭제', '나간'], a: '회원을 눌러 <b>탈퇴일</b>을 넣으면 그다음 달부터 회비 대상에서 빠져요. 과거 회비 기록은 그대로 남아요.<br>바로 내보내야 하면 같은 창의 <b>[🚪 강퇴]</b>를 쓰세요. 기록이 하나도 없는 회원만 완전히 지울 수 있어요.', acts: [['회원·회비 보기', () => X.go('members')]] },
  { q: '미납자 안내 문구', k: ['독촉', '안내문구', '미납안내', '공지문구'], a: '[회원·회비]의 <b>[미납자 안내 문구]</b>를 누르면 미납자 이름과 계좌가 들어간 문구가 복사돼요. 단톡방에 붙여넣기만 하면 돼요.', acts: [['안내 문구 복사', () => X.duesText()]] },
  { q: '월별 장부 · 정산 문구', k: ['장부', '결산', '정산', '월별', '수입', '지출'], a: '[장부]에서 월별 회비·게스트비·구장비·잔액을 볼 수 있어요. 달마다 <b>[정산 문구]</b>를 누르면 회원에게 공유할 결산 문구가 복사돼요.', acts: [['장부 보기', () => X.go('ledger')]] },
  { q: '골·도움 기록 · 지난 경기 기록', k: ['골', '도움', '기록', '득점', '지난경기', '집계'], a: '골·도움은 회원 누구나 [경기기록]에서 넣을 수 있어요. 지난 경기가 안 보이면 설정 → 안내 문구·기타 → <b>‘골·도움 집계 시작일’</b>을 그 경기 날짜 전으로 당기세요.', acts: [['경기기록 보기', () => X.go('stats')], ['설정 열기', () => X.openSettings()]] },
  { q: '투표 · 공지 만들기', k: ['투표만들', '공지', '설문', '익명'], a: '[투표·건의] → <b>[+ 새 투표·공지]</b>. 보기를 비우면 공지가 되고, 익명·여러 개 고르기·의견 추가도 고를 수 있어요. 만들면 카톡 공지 문구도 복사할 수 있어요.', acts: [['투표·건의 보기', () => X.go('polls')]] },
  { q: '회비 · 게스트비 금액 바꾸기', k: ['회비금액', '회비바꾸', '게스트비', '참가비', '금액'], a: '오른쪽 위 <b>톱니바퀴(설정)</b> → 회비·게스트에서 바꿔요.', acts: [['설정 열기', () => X.openSettings()]] },
  { q: '관리자 비밀번호 바꾸기', k: ['비밀번호', '비번', 'pin', '암호'], a: '설정 맨 아래 <b>‘관리자 비밀번호 바꾸기’</b>에 숫자 4자리를 넣고 저장하세요. 잊었으면 비밀번호 화면의 [비밀번호를 잊었어요] → 팀을 만든 구글 계정으로 다시 정할 수 있어요.', acts: [['설정 열기', () => X.openSettings()]] },
  { q: '경기 날씨 위치 설정', k: ['날씨', '비', '위치', '구장위치', '강수'], a: '설정에서 구장 위치를 검색하거나 <b>[📍 지금 내 위치]</b>를 누르세요. 경기 15일 전부터 경기 시간대 강수량으로 진행 여부를 안내해요.', acts: [['설정 열기', () => X.openSettings()]] },
  { q: '하이라이트 영상 올리기', k: ['영상', '유튜브', '하이라이트', '동영상'], a: '[경기기록]의 <b>[+ 하이라이트 추가]</b>에서 경기를 고르고 유튜브 링크(일부공개 추천)를 넣으면 회원 화면에 영상이 떠요. 회원은 시간이 찍힌 댓글을 달 수 있어요.', acts: [['경기기록 보기', () => X.go('stats')]] },
  { q: '데이터 백업', k: ['백업', '저장', '내려받', '엑셀로'], a: '설정의 <b>[백업 내려받기]</b>를 누르면 회원·경기·거래 전체를 파일로 받아둘 수 있어요.', acts: [['설정 열기', () => X.openSettings()]] },
];
const STARTERS = ['이번 달 미납자 누구야?', '통장 잔액 얼마야?', '다음 경기 몇 명이야?', '통장 엑셀 올리는 법', '정기대관 부족한 돈'];

function answer(text) {
  const t = nz(text);
  const live = LIVE.find((x) => x.k.some((k) => t.indexOf(k) >= 0));
  // 사용법 질문(‘~법’, ‘어떻게’)은 도움말 우선
  const how = /법|어떻게|방법|하려면|하나요|돼\?|되나/.test(text);
  let best = null, bs = 0;
  KB.forEach((e) => { const s = e.k.reduce((n, k) => n + (t.indexOf(nz(k)) >= 0 ? k.length : 0), 0) + (t.indexOf(nz(e.q)) >= 0 ? 5 : 0); if (s > bs) { bs = s; best = e; } });
  if (live && !(how && best)) return live.f();
  if (best) return { a: '<b>' + esc(best.q) + '</b><br>' + best.a, acts: best.acts };
  return { a: '음, 그건 아직 잘 모르겠어요. 아래 중에 찾으시는 게 있을까요?', acts: [], chips: KB.slice(0, 6).map((e) => e.q), dev: true };
}

function draw() {
  const p = document.getElementById('coachp'); if (!p) return;
  const body = p.querySelector('.cb');
  body.innerHTML = log.map((m, i) => m.me ? '<div class="cm me">' + esc(m.t) + '</div>' :
    '<div class="cm"><div>' + m.a + '</div>' + ((m.acts || []).length ? '<div class="ca">' + m.acts.map((a, j) => '<button data-ca="' + i + '_' + j + '">' + esc(a[0]) + '</button>').join('') + '</div>' : '') +
    (m.chips ? '<div class="cc">' + m.chips.map((c) => '<button data-cq="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' : '') +
    (m.dev ? '<div class="cdev">원하는 답이 없으면 설정의 <b>[💌 앱 개발자에게 건의]</b>로 알려주세요.</div>' : '') + '</div>').join('');
  body.querySelectorAll('[data-ca]').forEach((b) => (b.onclick = () => { const [i, j] = b.dataset.ca.split('_'); const fn = log[i].acts[j][1]; if (innerWidth < 700) toggle(false); fn(); }));
  body.querySelectorAll('[data-cq]').forEach((b) => (b.onclick = () => ask(b.dataset.cq)));
  body.scrollTop = body.scrollHeight;
}
function ask(q) { q = String(q || '').trim(); if (!q) return; log.push({ me: 1, t: q }); log.push(answer(q)); draw(); }
function toggle(on) {
  open = on === undefined ? !open : on;
  const p = document.getElementById('coachp'); p.hidden = !open;
  document.getElementById('coachb').setAttribute('aria-expanded', open);
  if (open) { if (!log.length) { log.push({ a: '안녕하세요, 총무님! 저는 도우미 <b>킥키</b>예요 ⚽<br>앱 쓰는 법이나 우리 팀 회비·경기 상황을 물어보세요.', chips: STARTERS }); } draw(); setTimeout(() => p.querySelector('input').focus(), 50); }
}
export function mountCoach(ctx) {
  X = ctx; if (document.getElementById('coachb')) return;
  document.body.insertAdjacentHTML('beforeend', '<button id="coachb" class="coachb" aria-label="도우미 킥키 열기" aria-expanded="false">' + ICON + '<em>킥키</em></button>' +
    '<section id="coachp" class="coachp" hidden aria-label="도우미 킥키"><header>' + ICON + '<b>킥키</b><small>총무 도우미' + (ctx.demo ? ' · 체험 중' : '') + '</small><button class="cx" aria-label="닫기">✕</button></header>' +
    '<div class="cb" aria-live="polite"></div><form class="cf"><input maxlength="100" placeholder="예: 미납자 누구야? / 팀 짜는 법" aria-label="질문"><button>보내기</button></form></section>');
  document.getElementById('coachb').onclick = () => toggle();
  document.querySelector('#coachp .cx').onclick = () => toggle(false);
  document.querySelector('#coachp form').onsubmit = (e) => { e.preventDefault(); const i = e.target.querySelector('input'); ask(i.value); i.value = ''; };
}
