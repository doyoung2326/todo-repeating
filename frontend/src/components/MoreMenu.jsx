import { useEffect, useRef, useState } from 'react';

/**
 * 좁은 화면에서 아이콘 버튼 여러 개 대신 쓰는 ⋯ 메뉴.
 * 손가락으로 누르기엔 아이콘 세 개가 한 줄에 붙어 있으면 오조작이 난다.
 *
 * items: [{ label, onSelect, danger? }]
 */
/** 메뉴 높이를 대충 잡은 값. 아래로 펼칠 자리가 이만큼 없으면 위로 뒤집는다. */
const MENU_ROOM = 140;

export default function MoreMenu({ label = '더보기', items }) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const closeOnEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="more-wrap" ref={wrapRef}>
      <button
        type="button"
        className="more-btn"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={e => {
          // 목록 열은 스크롤 컨테이너라, 아래쪽 항목에서 펼치면 메뉴가 잘린다.
          // 열기 직전에 남은 자리를 재서 모자라면 위로 펼친다.
          const rect = e.currentTarget.getBoundingClientRect();
          setDropUp(window.innerHeight - rect.bottom < MENU_ROOM);
          setOpen(o => !o);
        }}
      >
        ⋯
      </button>

      {open && (
        <div className={`more-menu${dropUp ? ' drop-up' : ''}`} role="menu">
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? 'danger' : undefined}
              onClick={() => { setOpen(false); item.onSelect(); }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
