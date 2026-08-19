/**
 * 화면에서 쓰는 값 중 JS가 인라인 스타일로 넣어야 하는 것들.
 *
 * 색은 실제 색상값이 아니라 CSS 변수를 가리킨다. 그래야 App.css의 토큰 하나만
 * 고치면 화면 전체가 따라오고, 개발 모드의 테마 패널로 조정한 값도 그대로 반영된다.
 * (예전에는 세 파일이 각자 '#3b82f6' 같은 값을 들고 있어서 따로 놀았다.)
 *
 * 말과 판단 기준은 shared/labels.js에 있다 — 앱(mobile)과 같은 것을 쓴다.
 * **CSS 변수로 바꾸는 일만 이 파일이 한다.** 앱에는 CSS 변수가 없다.
 */

import { progressLevel } from '../../shared/labels.js';

import { CAT_SLOTS } from '../../shared/labels.js';

export { STAGE_LABELS, IMP_LABELS, CAT_SLOTS, CAT_COLOR_LABELS } from '../../shared/labels.js';
export { formatKoreanDate } from '../../shared/dates.js';

export const IMP_COLORS = {
  1: 'var(--imp-1)',
  2: 'var(--imp-2)',
  3: 'var(--imp-3)',
};

/* 성격의 색 칸(1~8) → CSS 변수. 칸 번호만 저장하고 색은 App.css에만 두는 덕분에
   화면 조정 패널로 여덟 색을 그대로 맞출 수 있다. */
const slotMap = suffix =>
  Object.fromEntries(CAT_SLOTS.map(n => [n, `var(--cat-${n}${suffix})`]));

export const CAT_COLORS = slotMap('');      // 색 고르는 칸의 채움
export const CAT_BG     = slotMap('-bg');   // 칩 배경
export const CAT_FG     = slotMap('-fg');   // 칩 글자

const PROGRESS_COLORS = {
  low:  'var(--prog-low)',
  mid:  'var(--prog-mid)',
  high: 'var(--prog-high)',
};

/** 진행률이 낮을수록 주의색. 경계는 shared/labels.js가 정한다. */
export function progressColor(pct) {
  return PROGRESS_COLORS[progressLevel(pct)];
}
