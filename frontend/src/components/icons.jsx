/**
 * 아이콘 버튼용 선 아이콘. 이 디자인은 이모지를 쓰지 않으므로
 * 📌 ✏️ 🗑️ 자리를 이것들이 대신한다. 뜻은 버튼의 title/aria-label이 전달한다.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: '1.15em',
  height: '1.15em',
  'aria-hidden': true,
};

export const PinIcon = () => (
  <svg {...base}>
    <path d="M12 17v5" />
    <path d="M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
  </svg>
);

export const EditIcon = () => (
  <svg {...base}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

/** 더하기. 글자 '+'는 글꼴마다 광학 중심이 달라 버튼 한가운데에 놓이지 않는다. */
export const PlusIcon = () => (
  <svg {...base} width="1.6em" height="1.6em" strokeWidth={2}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

export const TrashIcon = () => (
  <svg {...base}>
    <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" />
    <path d="M10.5 11v5.5M13.5 11v5.5" />
  </svg>
);
