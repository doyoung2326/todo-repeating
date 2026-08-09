import { resolveApiUrl } from '@shared/apiUrl.js';

/**
 * 서버 주소. 판단 규칙은 웹과 같은 파일(shared/apiUrl.js)이 쥐고 있고,
 * 여기서는 Expo가 어디에 값을 두는지만 안다.
 *
 * `EXPO_PUBLIC_` 접두사가 붙은 변수만 앱 번들에 들어간다. 그리고 **빌드 시점에 박힌다** —
 * 잘못된 값으로 스토어에 올리면 앱을 다시 심사받아야 하므로, 운영 빌드에서는
 * 값이 없거나 상대 경로면 빌드를 실패시킨다.
 *
 * 개발 기본값이 localhost가 아닌 이유: 시뮬레이터·실기기는 개발 PC의 localhost에
 * 닿지 못한다. 안드로이드 에뮬레이터는 10.0.2.2가 PC를 가리키고, 실기기는
 * PC의 LAN 주소를 .env.local에 적어야 한다.
 */
const SETUP_HINT =
  'mobile/.env(또는 EAS의 환경변수)에 EXPO_PUBLIC_API_URL을 등록하세요 ' +
  '(예: https://todo-repeating-production.up.railway.app/api).';

export const API_URL: string = resolveApiUrl({
  url: process.env.EXPO_PUBLIC_API_URL,
  isProd: process.env.NODE_ENV === 'production',
  setupHint: SETUP_HINT,
  fallback: 'http://10.0.2.2:3001/api',
});
