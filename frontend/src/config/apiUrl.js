// Vite에서 API 주소를 읽는 자리. 판단 자체는 shared/apiUrl.js가 한다 —
// 앱(mobile)도 같은 규칙을 쓰되 변수 이름과 등록하는 곳만 다르다.

import { resolveApiUrl as resolve } from '../../../shared/apiUrl.js';

const SETUP_HINT =
  'Vercel → Settings → Environment Variables에 VITE_API_URL을 등록하세요 ' +
  '(예: https://todo-repeating-production.up.railway.app/api).';

/** vite.config.js와 앱 코드가 함께 쓴다. `env`는 loadEnv 또는 import.meta.env. */
export function resolveApiUrl(env, mode) {
  return resolve({
    url: env.VITE_API_URL,
    isProd: mode === 'production',
    setupHint: SETUP_HINT,
  });
}
