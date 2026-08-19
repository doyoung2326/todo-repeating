/**
 * 화면에 적는 말과, 색을 고르는 기준.
 *
 * **색값 자체는 여기 없다.** 웹은 CSS 변수(`var(--prog-low)`)로, 앱은 RN 스타일 객체로
 * 색을 표현하므로 공유할 수 없다. 공유되는 것은 "몇 %부터 어느 단계인가" 같은 판단이다.
 */

export const STAGE_LABELS = ['1일차', '3일차', '7일차', '16일차', '30일차'];

export const IMP_LABELS = { 1: '낮음', 2: '중간', 3: '높음' };

/** 할 일 성격이 고를 수 있는 색 칸. 성격 문서에는 이 번호만 저장한다.
 *  실제 색은 플랫폼마다 따로다 — 웹은 App.css의 --cat-N, 앱은 tokens.ts. */
export const CAT_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

/** 각 칸의 색 이름. 화면 낭독기는 색을 읽지 못하고, 색으로만 구분하면
 *  못 알아보는 사람이 있어서 말로도 붙여 준다.
 *  칸의 색을 다른 계열로 바꾸면 이 이름도 같이 고쳐야 한다. */
export const CAT_COLOR_LABELS = {
  1: '쑥', 2: '청록', 3: '쪽빛', 4: '보라',
  5: '자두', 6: '벽돌', 7: '황토', 8: '회갈',
};

/** 진행률이 낮을수록 주의 단계. 경계는 30 / 70. */
export function progressLevel(pct) {
  if (pct < 30) return 'low';
  if (pct < 70) return 'mid';
  return 'high';
}
