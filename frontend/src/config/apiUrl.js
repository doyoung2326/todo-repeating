// API 주소 결정 + 프로덕션 빌드 가드.
// Vite는 환경변수를 빌드 시점에 번들에 박아넣으므로, 값이 잘못되면
// 런타임에 고칠 수 없다. 잘못된 번들이 배포되느니 빌드를 실패시킨다.

const SETUP_HINT =
  'Vercel → Settings → Environment Variables에 VITE_API_URL을 등록하세요 ' +
  '(예: https://todo-repeating-production.up.railway.app/api).';

export function resolveApiUrl(env, mode) {
  const url = env.VITE_API_URL;

  if (mode !== 'production') {
    return url || '/api';
  }

  if (!url) {
    throw new Error(`프로덕션 빌드에는 VITE_API_URL이 필요합니다. ${SETUP_HINT}`);
  }
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      `VITE_API_URL은 http(s)://로 시작하는 절대 URL이어야 합니다. 받은 값: "${url}". ${SETUP_HINT}`
    );
  }
  return url;
}
