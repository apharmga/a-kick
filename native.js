/* A-KICK 아이폰 앱 전용 기능 연결
 * 웹 브라우저·안드로이드(TWA)에서는 IOS_APP이 false라 아무 일도 하지 않는다.
 * 아이폰 앱(Capacitor) 안에서만: Apple/Google 로그인, 경기 알림(로컬 알림), 애플워치 운동(건강 앱) 불러오기. */
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const Cap = window.Capacitor;
export const IOS_APP = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.getPlatform && Cap.getPlatform() === 'ios');

function call(plugin, method, opts) {
  const P = Cap && Cap.Plugins && Cap.Plugins[plugin];
  if (P && typeof P[method] === 'function') return P[method](opts || {});
  if (Cap && Cap.nativePromise) return Cap.nativePromise(plugin, method, opts || {});
  return Promise.reject(new Error('앱 기능을 쓸 수 없어요'));
}
const canceled = (e) => /cancel/i.test((e && (e.message || e.errorMessage)) || String(e));

/** 앱 정보 (Google 로그인 설정 여부 포함) */
let infoP = null;
export function appInfo() { return (infoP = infoP || call('AKick', 'info').catch(() => ({ google: false }))); }

/** 로그인: which = 'apple' | 'google'. 성공 시 Firebase UserCredential, 취소 시 null */
export async function nativeSignIn(auth, which) {
  try {
    if (which === 'apple') {
      const r = await call('AKick', 'appleSignIn');
      const cred = new OAuthProvider('apple.com').credential({ idToken: r.idToken, rawNonce: r.rawNonce });
      return await signInWithCredential(auth, cred);
    }
    const r = await call('AKick', 'googleSignIn');
    return await signInWithCredential(auth, GoogleAuthProvider.credential(r.idToken));
  } catch (e) {
    if (canceled(e)) return null;
    throw e;
  }
}

/** 로그인 버튼 HTML (아이폰 앱에서만 사용) */
export async function signInButtons() {
  const i = await appInfo();
  return '<button class="abtn" id="in-apple"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-4.2zM13.9 4.9c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg>Apple로 계속하기</button>' +
    (i.google ? '<button class="gbtn" id="in-google">구글로 계속하기</button>' : '');
}

/** 팀을 만든 계정 확인처럼 '다시 로그인'이 필요할 때: 처음 로그인한 방식 그대로 */
export function providerOf(user) {
  const p = ((user && user.providerData) || [])[0];
  return p && p.providerId === 'apple.com' ? 'apple' : 'google';
}

/* ---------- 경기 알림 (로컬 알림) ---------- */
/** list: [{at: Date, title, body}] — 이 경기(gid)의 예전 알림은 지우고 새로 등록 */
export async function scheduleAlarms(gid, list) {
  const perm = await call('LocalNotifications', 'requestPermissions').catch(() => ({}));
  if (perm.display && perm.display !== 'granted') throw new Error('알림 권한이 꺼져 있어요. 설정 → A-KICK → 알림을 켜주세요');
  const base = (Math.abs(hash(gid)) % 100000) * 100;
  const pend = await call('LocalNotifications', 'getPending').catch(() => ({ notifications: [] }));
  const old = (pend.notifications || []).filter((n) => n.id >= base && n.id < base + 100).map((n) => ({ id: n.id }));
  if (old.length) await call('LocalNotifications', 'cancel', { notifications: old }).catch(() => {});
  const now = Date.now();
  const items = list.filter((x) => x.at.getTime() > now).slice(0, 60).map((x, i) => ({
    id: base + i, title: x.title, body: x.body || '', schedule: { at: x.at.toISOString(), allowWhileIdle: true }, sound: 'default'
  }));
  if (items.length) await call('LocalNotifications', 'schedule', { notifications: items });
  return items.length;
}
function hash(s) { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0; return h; }

/* ---------- 애플워치 운동 (건강 앱) ---------- */
/** 경기 시간대(시작~끝 ±30분)에 기록된 운동을 합산. 없으면 null */
export async function workoutFor(start, end) {
  const av = await call('Health', 'isAvailable').catch(() => ({ available: false }));
  if (!av.available) throw new Error('이 기기에서는 건강 앱을 쓸 수 없어요');
  await call('Health', 'requestAuthorization', { read: ['workouts', 'calories', 'distance'] });
  const from = new Date(start.getTime() - 30 * 60000), to = new Date(end.getTime() + 30 * 60000);
  const r = await call('Health', 'queryWorkouts', { startDate: from.toISOString(), endDate: to.toISOString(), limit: 20 });
  const W = (r.workouts || []).filter((w) => new Date(w.endDate) > from && new Date(w.startDate) < to);
  if (!W.length) return null;
  const sum = (k) => W.reduce((a, w) => a + (+w[k] || 0), 0);
  return { kcal: Math.round(sum('totalEnergyBurned')), km: Math.round(sum('totalDistance') / 100) / 10, min: Math.round(sum('duration') / 60), n: W.length,
    type: W.map((w) => w.workoutType).join(',') };
}

/** 가벼운 진동 (버튼 누름 등) */
export function tap() { if (IOS_APP) call('Haptics', 'impact', { style: 'LIGHT' }).catch(() => {}); }
