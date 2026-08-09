// 로그인 세션을 이 브라우저에 보관한다.
// "무엇이 올바른 세션인가"는 shared/session.js가 정한다 — 앱(mobile)과 같은 규칙을 쓴다.
// 여기 있는 것은 localStorage라는 **보관 장소**에 관한 것뿐이다.

import { STORAGE_KEY, parseSession, serializeSession } from '../../../shared/session.js';

export { STORAGE_KEY, normalizeSession, parseSession } from '../../../shared/session.js';

export function loadSession(storage = globalThis.localStorage) {
  try {
    return parseSession(storage?.getItem(STORAGE_KEY));
  } catch {
    // 사파리 프라이빗 모드 등에서 localStorage 접근 자체가 막힐 수 있다
    return null;
  }
}

export function saveSession(session, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, serializeSession(session));
  } catch { /* 저장에 실패해도 이번 세션은 메모리로 계속 쓴다 */ }
}

export function clearSession(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch { /* 무시 */ }
}
