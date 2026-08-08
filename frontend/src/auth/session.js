// 로그인 세션(토큰 + 사용자 정보)을 브라우저에 보관한다.
// 저장된 값은 사용자가 직접 고칠 수 있으므로 읽을 때마다 형태를 검사한다.

export const STORAGE_KEY = 'study-todo-session';

/**
 * 세션으로 쓸 수 있는 형태인지 확인하고 필요한 필드만 남겨 돌려준다. 아니면 null.
 * 저장된 값을 읽을 때뿐 아니라 로그인 응답을 받아들일 때도 이 문을 지난다.
 */
export function normalizeSession(data) {
  if (!data || typeof data.token !== 'string' || !data.token) return null;
  if (!data.user || typeof data.user.email !== 'string' || !data.user.email) return null;
  return { token: data.token, user: { id: data.user.id, email: data.user.email } };
}

/** 저장된 문자열을 세션 객체로 되돌린다. 깨졌거나 형태가 다르면 null. */
export function parseSession(raw) {
  if (!raw) return null;
  try {
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

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
    storage?.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch { /* 저장에 실패해도 이번 세션은 메모리로 계속 쓴다 */ }
}

export function clearSession(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch { /* 무시 */ }
}
