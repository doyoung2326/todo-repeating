// 앱 밖에 있는 문서로 가는 주소.
//
// 개인정보처리방침은 라우터를 타지 않는다 — `public/privacy.html`에 그대로 놓고
// Vite가 `dist/`로 복사한 것을 Vercel이 서빙한다. 그래야 스토어 심사와 AdSense에
// 제출할 수 있는 **공개 URL**이 생긴다. 파일 이름을 바꾸면 여기도 같이 바꿔야 한다.
//
// 앱(mobile/src/constants/links.ts)은 짧은 `/privacy`를 쓴다 — vercel.json의 rewrite가
// 같은 파일로 보낸다. 웹만 확장자까지 적는 이유는 **설치한 PWA 때문**이다:
// 서비스 워커가 프리캐시해 둔 키가 `/privacy.html`이라, `/privacy`로 열면 프리캐시를
// 비껴가 오프라인에서 앱 껍데기(index.html)가 대신 뜬다.

export const PRIVACY_URL = '/privacy.html';
