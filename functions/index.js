/**
 * A-KICK 푸시 알림 발송 서버 (앱 출시 때 배포 · Firebase Blaze 요금제 필요)
 * 배포: firebase deploy --only functions
 * 새 투표·공지 / 새 하이라이트 → 그 팀 회원 전체, 하이라이트 답글 → 원댓글 쓴 사람
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
initializeApp();
const db = getFirestore();
const BASE = 'https://apharmga.github.io/a-kick/';
const REGION = 'asia-northeast3';

async function tokensOf(cid, onlyUids, exceptUid) {
  const q = await db.collection('clubs').doc(cid).collection('push').where('on', '==', true).get();
  return q.docs.filter((d) => d.data().token && d.id !== exceptUid && (!onlyUids || onlyUids.includes(d.id))).map((d) => ({ uid: d.id, token: d.data().token }));
}
async function send(cid, list, title, body, url, tag) {
  if (!list.length) return;
  const club = (await db.collection('clubs').doc(cid).get()).data() || {};
  const res = await getMessaging().sendEachForMulticast({ tokens: list.map((x) => x.token),
    webpush: { notification: { title: (club.name ? '[' + club.name + '] ' : '') + title, body, icon: BASE + 'icon-192.png' }, fcmOptions: { link: url } },
    data: { url, tag: tag || '' } });
  // 더 이상 안 쓰는 기기 토큰 정리
  await Promise.all(res.responses.map((r, i) => (!r.success && /registration-token-not-registered|invalid-argument/.test((r.error && r.error.code) || '')
    ? db.collection('clubs').doc(cid).collection('push').doc(list[i].uid).update({ token: '' }) : null)));
}
exports.newPoll = onDocumentCreated({ document: 'clubs/{cid}/polls/{pid}', region: REGION }, async (e) => {
  const p = e.data.data(), cid = e.params.cid;
  await send(cid, await tokensOf(cid), (p.options || []).length ? '🗳 새 투표' : '📢 새 공지', p.title, BASE + '?c=' + cid, 'poll-' + e.params.pid);
});
exports.newVideo = onDocumentCreated({ document: 'clubs/{cid}/videos/{vid}', region: REGION }, async (e) => {
  const v = e.data.data(), cid = e.params.cid;
  await send(cid, await tokensOf(cid), '🎬 하이라이트 올라왔어요', v.title || '', BASE + '?c=' + cid + '&v=' + e.params.vid, 'video-' + e.params.vid);
});
exports.newReply = onDocumentCreated({ document: 'clubs/{cid}/vcomments/{id}', region: REGION }, async (e) => {
  const c = e.data.data(), cid = e.params.cid; if (!c.pid) return;
  const root = (await db.collection('clubs').doc(cid).collection('vcomments').doc(c.pid).get()).data();
  if (!root || root.uid === c.uid) return;
  await send(cid, await tokensOf(cid, [root.uid]), '💬 ' + c.name + '님이 답글을 달았어요', c.text.slice(0, 80), BASE + '?c=' + cid + '&v=' + c.vid, 'reply-' + c.pid);
});
