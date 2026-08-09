/**
 * 앱 바깥으로 나가는 주소.
 *
 * 개인정보처리방침은 **스토어 심사가 반드시 확인하는 자리**다. 로그인하기 전에도
 * 닿을 수 있어야 하므로 로그인 화면 아래에 둔다.
 *
 * 문서 본문은 `frontend/public/privacy.html` 하나뿐이고 웹·앱이 같은 것을 본다.
 * 여기서 짧은 `/privacy`를 쓸 수 있는 것은 `vercel.json`의 rewrite가 그 파일로 보내주기
 * 때문이다. 웹 쪽(frontend/src/config/links.js)만 `/privacy.html`을 그대로 쓰는데,
 * 설치한 PWA의 서비스 워커가 프리캐시해 둔 키가 그 주소라서다.
 *
 * ★ 도메인은 실제 Vercel 배포 주소로 확인할 것. 잘못 박히면 심사에서 링크가 죽는다.
 */
export const PRIVACY_URL = 'https://study-todo.vercel.app/privacy';
