/**
 * 모바일 전용 하단 탭바. 좁은 화면에서는 세 영역을 한 번에 보여줄 수 없으므로
 * 오늘 / 목록 / 복습을 오가게 한다. 넓은 화면에서는 App이 아예 그리지 않는다.
 *
 * 아이콘은 이모지가 아니라 선 아이콘이다 — 이 디자인은 이모지를 쓰지 않는다.
 */

const ICONS = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6.5h11M9 12h11M9 17.5h11M4 6.5h.01M4 12h.01M4 17.5h.01" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 3.5v5h-5" />
    </svg>
  ),
};

const TABS = [
  { key: 'today',  label: '오늘' },
  { key: 'list',   label: '목록' },
  { key: 'review', label: '복습' },
];

export default function BottomTabBar({ active, onChange, alerts = {} }) {
  return (
    <nav className="tabbar" aria-label="화면 전환">
      {TABS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            className={`tabbar-btn${isActive ? ' active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(key)}
          >
            {/* 처리할 게 남은 탭에만 점을 찍는다 */}
            {alerts[key] > 0 && (
              <span className="tabbar-dot" aria-label={`처리할 항목 ${alerts[key]}개`} />
            )}
            {ICONS[key]}
            {label}
          </button>
        );
      })}
    </nav>
  );
}
