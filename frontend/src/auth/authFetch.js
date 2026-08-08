// 토큰을 실어 보내고 401을 한 곳에서 처리하는 fetch 껍데기.

/**
 * 세션 만료는 "실패"가 아니라 예정된 흐름이다.
 * 이 예외를 받은 쪽은 사용자에게 오류를 알리지 않는다 — 이미 로그인 화면으로 넘어가 있다.
 */
export class SessionExpiredError extends Error {}

/**
 * 요청마다 Authorization 헤더를 붙이는 fetch를 만든다.
 * 서버가 401을 주면 onUnauthorized를 부르고 SessionExpiredError를 던진다.
 * (토큰이 만료·위조된 뒤에는 재시도해도 소용없으므로 붙잡지 않는다)
 */
export function createAuthFetch({ token, onUnauthorized }) {
  return async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (res.status === 401) {
      onUnauthorized();
      throw new SessionExpiredError('로그인이 만료되었습니다.');
    }
    return res;
  };
}
