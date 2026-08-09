/**
 * 화면에 적는 말과, 색을 고르는 기준.
 *
 * **색값 자체는 여기 없다.** 웹은 CSS 변수(`var(--prog-low)`)로, 앱은 RN 스타일 객체로
 * 색을 표현하므로 공유할 수 없다. 공유되는 것은 "몇 %부터 어느 단계인가" 같은 판단이다.
 */

export const STAGE_LABELS = ['1일차', '3일차', '7일차', '16일차', '30일차'];

export const IMP_LABELS = { 1: '낮음', 2: '중간', 3: '높음' };

/** 진행률이 낮을수록 주의 단계. 경계는 30 / 70. */
export function progressLevel(pct) {
  if (pct < 30) return 'low';
  if (pct < 70) return 'mid';
  return 'high';
}
