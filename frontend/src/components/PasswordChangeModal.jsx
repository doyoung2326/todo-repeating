import { useState } from 'react';

const MIN_PASSWORD_LENGTH = 8;

/**
 * 비밀번호 변경 모달.
 * onSubmit(현재비밀번호, 새비밀번호)이 성공하면 성공 안내를, 실패하면 던진 메시지를 보여준다.
 */
export default function PasswordChangeModal({ onSubmit, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [error, setError]     = useState(null);
  const [done, setDone]       = useState(false);
  const [busy, setBusy]       = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;

    // 서버도 같은 규칙으로 막지만, 굳이 왕복할 필요가 없다
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (next === current) {
      setError('새 비밀번호는 현재와 다른 값이어야 합니다.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSubmit(current, next);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-head">
          <h2 className="modal-title">비밀번호 변경</h2>
        </div>

        {done ? (
          <>
            <p className="pw-success">✅ 비밀번호가 변경되었습니다.</p>
            <div className="modal-actions">
              <button className="btn btn-primary" type="button" onClick={onClose}>닫기</button>
            </div>
          </>
        ) : (
          <form className="pw-form" onSubmit={submit}>
            <p className="modal-desc">
              바꾸고 나면 <strong>다른 기기에서는 모두 로그아웃</strong>됩니다. 이 기기는 그대로 유지됩니다.
            </p>

            {error && <div className="auth-error">⚠️ {error}</div>}

            <label className="auth-field">
              <span>현재 비밀번호</span>
              <input
                type="password"
                value={current}
                onChange={e => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <label className="auth-field">
              <span>새 비밀번호</span>
              <input
                type="password"
                value={next}
                onChange={e => setNext(e.target.value)}
                autoComplete="new-password"
                placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
                required
              />
            </label>

            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={onClose}>닫기</button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? '변경 중...' : '변경'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
