// API 주소 결정 + 프로덕션 빌드 가드.
//
// 웹(Vite)도 앱(Expo)도 환경변수를 **빌드 시점에 번들에 박아넣는다**. 값이 잘못되면
// 런타임에 고칠 수 없다 — 잘못된 번들이 배포되느니 빌드를 실패시킨다.
// 변수 이름만 다르므로(VITE_API_URL / EXPO_PUBLIC_API_URL) 값과 안내 문구를 받는다.

/**
 * @param url       읽어온 환경변수 값 (없으면 undefined)
 * @param isProd    프로덕션 빌드인가
 * @param setupHint 값이 없을 때 사람에게 보여줄 안내 (플랫폼마다 등록하는 곳이 다르다)
 * @param fallback  개발 중에 쓸 기본값
 */
export function resolveApiUrl({ url, isProd, setupHint, fallback = '/api' }) {
  if (!isProd) {
    return url || fallback;
  }

  if (!url) {
    throw new Error(`프로덕션 빌드에는 API 주소가 필요합니다. ${setupHint}`);
  }
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      `API 주소는 http(s)://로 시작하는 절대 URL이어야 합니다. 받은 값: "${url}". ${setupHint}`
    );
  }
  return url;
}
