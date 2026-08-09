import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { STORAGE_KEY, parseSession, serializeSession } from '@shared/session.js';

/** shared/session.js가 통과시킨 것만 이 모양이 된다. */
export type Session = {
  token: string;
  user: { id?: string; email: string };
};

/**
 * 로그인 토큰을 이 기기에 보관한다.
 * "무엇이 올바른 세션인가"는 웹과 같은 규칙(shared/session.js)을 쓰고,
 * 여기 있는 것은 **보관 장소**에 관한 것뿐이다.
 *
 * 앱에서는 SecureStore를 쓴다 — AsyncStorage와 달리 iOS 키체인·안드로이드 키스토어에
 * 들어가므로 기기를 잃어버렸을 때 토큰이 평문으로 남지 않는다.
 * (웹은 localStorage다. `npm run web`으로 개발할 때를 위해 갈래를 남겨 둔다.)
 *
 * 웹의 loadSession과 달리 전부 async다. SecureStore가 동기 API를 주지 않는다.
 */

const webStore = {
  getItem: (k: string) => Promise.resolve(globalThis.localStorage?.getItem(k) ?? null),
  setItem: (k: string, v: string) => { globalThis.localStorage?.setItem(k, v); return Promise.resolve(); },
  removeItem: (k: string) => { globalThis.localStorage?.removeItem(k); return Promise.resolve(); },
};

const store = Platform.OS === 'web' ? webStore : {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

export async function loadSession(): Promise<Session | null> {
  try {
    return parseSession(await store.getItem(STORAGE_KEY));
  } catch {
    // 키체인 접근이 막히는 기기가 있다. 로그인 화면으로 보내면 될 뿐, 앱이 죽으면 안 된다.
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await store.setItem(STORAGE_KEY, serializeSession(session));
  } catch { /* 저장에 실패해도 이번 실행은 메모리로 계속 쓴다 */ }
}

export async function clearSession(): Promise<void> {
  try {
    await store.removeItem(STORAGE_KEY);
  } catch { /* 무시 */ }
}
