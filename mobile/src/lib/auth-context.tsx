import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createApi, type Api } from './api';
import { clearSession, loadSession, saveSession, type Session } from './session';

type AuthValue = {
  session: Session | null;
  /** 저장된 세션을 아직 읽는 중인가. 이때 로그인 화면을 보이면 화면이 한 번 깜빡인다. */
  restoring: boolean;
  api: Api;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  // 앱을 켤 때 한 번: 기기에 남아 있는 세션을 되살린다.
  useEffect(() => {
    let alive = true;
    loadSession().then(found => {
      if (!alive) return;
      setSession(found);
      setRestoring(false);
    });
    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async (next: Session) => {
    await saveSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  // 서버가 401을 주면 토큰이 죽은 것이다(만료됐거나 비밀번호가 바뀌었거나).
  // 붙잡아 봐야 소용없으므로 바로 로그아웃한다 — 웹과 같은 약속이다.
  const api = useMemo(
    () => createApi({ token: session?.token ?? null, onUnauthorized: () => { void signOut(); } }),
    [session?.token, signOut]
  );

  const value = useMemo(
    () => ({ session, restoring, api, signIn, signOut }),
    [session, restoring, api, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다.');
  return value;
}
