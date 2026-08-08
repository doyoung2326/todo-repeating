import { useState } from 'react';
import { normalizeSession } from '../auth/session';

const MIN_PASSWORD_LENGTH = 8;

/** 로그인 / 회원가입 화면. 성공하면 onAuth({ token, user })로 세션을 넘긴다. */
export default function AuthScreen({ api, onAuth }) {
  const [mode, setMode]         = useState('login'); // 'login' | 'register'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);

  const isRegister = mode === 'register';

  function switchMode() {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
    setPassword('');
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;

    if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '요청에 실패했습니다.');

      // 200이어도 토큰·사용자가 빠져 있으면 그대로 넘기지 않는다.
      // 반쪽짜리 세션을 저장하면 다음 화면에서 터진다.
      const session = normalizeSession(data);
      if (!session) throw new Error('서버 응답을 이해할 수 없습니다.');
      onAuth(session);
    } catch (err) {
      // 네트워크 자체가 끊긴 경우 fetch가 던지는 메시지는 사용자에게 의미가 없다
      setError(err instanceof TypeError ? '서버에 연결할 수 없습니다.' : err.message);
    } finally {
      // 성공하면 보통 이 화면이 사라지지만, 잠금 해제를 거기에 기대지는 않는다
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <h1>공부 할 일 관리</h1>
          <p>망각곡선 복습으로 효율적인 학습을</p>
        </div>

        <h2 className="auth-heading">{isRegister ? '회원가입' : '로그인'}</h2>

        {error && <div className="auth-error">{error}</div>}

        <label className="auth-field">
          <span>이메일</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="auth-field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder={isRegister ? `${MIN_PASSWORD_LENGTH}자 이상` : ''}
            required
          />
        </label>

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? '처리 중...' : isRegister ? '가입하고 시작하기' : '로그인'}
        </button>

        <button className="auth-switch" type="button" onClick={switchMode}>
          {isRegister ? '이미 계정이 있어요 · 로그인' : '처음이신가요? · 회원가입'}
        </button>
      </form>
    </div>
  );
}
