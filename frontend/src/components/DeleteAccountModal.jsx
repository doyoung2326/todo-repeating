import { useState } from 'react';

/**
 * 회원 탈퇴 모달.
 *
 * 성공하면 App이 곧바로 로그아웃시키므로 이 컴포넌트에는 "완료" 화면이 없다.
 * (비밀번호 변경 모달과 달리 보여줄 다음 화면이 없다 — 트리째 사라진다.)
 * onSubmit(비밀번호)이 던진 메시지는 이 안에 남겨 모달을 닫지 않는다.
 */
export default function DeleteAccountModal({ onSubmit, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
    // 성공하면 잠금을 풀지 않는다 — 화면이 사라지는 중에 다시 누를 수 있게 만들 이유가 없다.
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-head">
          <h2 className="modal-title">회원 탈퇴</h2>
        </div>

        <form className="pw-form" onSubmit={submit}>
          <p className="modal-desc">
            계정과 함께 <strong>할 일·복습 기록·알림 설정이 모두 삭제</strong>됩니다.
            삭제한 뒤에는 되돌릴 수 없습니다.
          </p>

          {error && <div className="auth-error">{error}</div>}

          <label className="auth-field">
            <span>비밀번호 확인</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <div className="modal-actions">
            <button className="btn btn-ghost" type="button" onClick={onClose}>취소</button>
            <button className="btn btn-danger" type="submit" disabled={busy}>
              {busy ? '탈퇴 처리 중...' : '탈퇴하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
