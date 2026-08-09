// 브라우저 쪽 알림 구독. 지원하지 않는 환경에서는 조용히 물러난다 —
// 알림이 없다고 해서 앱이 못 쓰게 되면 안 된다. (registerServiceWorker.js와 같은 규약)

import { getRegistration } from './registerServiceWorker';

/**
 * 서버가 준 VAPID 공개키(base64url)를 subscribe가 받는 형태로 바꾼다.
 * 브라우저에 이 변환을 해주는 API가 없어서 직접 푼다.
 */
export function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** 이 브라우저가 웹 푸시를 할 수 있는가 */
export function isPushSupported() {
  return typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window;
}

/** 홈 화면에 설치된 상태로 실행 중인가 (iOS는 설치했을 때만 알림이 온다) */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.navigator?.standalone) return true;
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
}

/** iOS/iPadOS인가. 홈 화면 설치 안내를 이 기기에만 띄운다. */
export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // 아이패드는 최근 버전에서 자신을 Mac이라고 소개한다 — 터치 지원 여부로 가른다
  return /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

/** 'granted' | 'denied' | 'default' | null(지원 안 함) */
export function permissionState() {
  return isPushSupported() ? Notification.permission : null;
}

/** 이 기기에 이미 만들어 둔 구독. 없으면(또는 서비스 워커가 없으면) null. */
export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const registration = await getRegistration().catch(() => null);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * 권한을 묻고 구독을 만든다.
 * 사용자가 거부하거나 서비스 워커가 없으면 예외를 던진다 — 호출한 쪽이 문구로 안내한다.
 */
export async function subscribe(publicKey) {
  if (!isPushSupported()) throw new Error('이 브라우저는 알림을 지원하지 않습니다.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.');

  const registration = await getRegistration().catch(() => null);
  if (!registration) throw new Error('알림을 준비하지 못했습니다. 새로고침 후 다시 시도해 주세요.');

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

/** 브라우저 쪽 구독을 끊는다. 끊긴 구독(또는 없던 구독)의 endpoint를 돌려준다. */
export async function unsubscribe() {
  const subscription = await getExistingSubscription();
  if (!subscription) return null;

  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}
