/**
 * 로그인 세션의 "형태"에 관한 규칙. 어디에 보관하는지는 모른다.
 *
 * 웹은 localStorage(동기), 앱은 SecureStore(비동기)라 저장소 자체는 공유할 수 없다.
 * 공유되는 것은 **저장된 값을 믿지 않는다**는 규칙뿐이다 — 사용자가 직접 고칠 수
 * 있는 자리에 있으므로 읽을 때마다 형태를 검사한다.
 */

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

/** 세션 객체를 저장할 문자열로. parseSession의 반대편이다. */
export function serializeSession(session) {
  return JSON.stringify(session);
}
