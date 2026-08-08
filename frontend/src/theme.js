/**
 * 화면에서 쓰는 값 중 JS가 인라인 스타일로 넣어야 하는 것들.
 *
 * 색은 실제 색상값이 아니라 CSS 변수를 가리킨다. 그래야 App.css의 토큰 하나만
 * 고치면 화면 전체가 따라오고, 개발 모드의 테마 패널로 조정한 값도 그대로 반영된다.
 * (예전에는 세 파일이 각자 '#3b82f6' 같은 값을 들고 있어서 따로 놀았다.)
 */

export const STAGE_LABELS = ['1일차', '3일차', '7일차', '16일차', '30일차'];

export const IMP_COLORS = {
  1: 'var(--imp-1)',
  2: 'var(--imp-2)',
  3: 'var(--imp-3)',
};

export const IMP_LABELS = { 1: '낮음', 2: '중간', 3: '높음' };

/** 진행률이 낮을수록 주의색. 경계는 30 / 70. */
export function progressColor(pct) {
  if (pct < 30) return 'var(--prog-low)';
  if (pct < 70) return 'var(--prog-mid)';
  return 'var(--prog-high)';
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-08-08' → '8월 8일 금요일'. 모바일 헤더에서만 쓴다. */
export function formatKoreanDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}
