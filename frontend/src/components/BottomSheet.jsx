import { useEffect } from 'react';

/**
 * 할 일 추가/수정 폼을 담는 겹침 창.
 *
 * 폼을 목록 위에 상시 띄워두면 어느 폭에서든 자리를 크게 먹어서, 어느 화면에서나
 * + 버튼을 눌렀을 때만 나오게 한다. 생김새는 폭에 따라 CSS가 정한다 —
 * 좁으면 아래에서 올라오는 시트, 넓으면 화면 가운데 대화상자.
 */
export default function BottomSheet({ label, onClose, children }) {
  // 열려 있는 동안 뒤 화면이 같이 스크롤되지 않게 막는다
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="sheet-scrim"
      // 바깥(어두운 부분)을 눌렀을 때만 닫는다. 폼 안을 누른 건 여기까지 올라오지만
      // target이 폼이므로 무시된다.
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <span className="sheet-grabber" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
