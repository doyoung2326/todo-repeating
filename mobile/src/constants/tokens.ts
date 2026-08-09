/**
 * 화면의 색·모양. **여기 아닌 곳에 색값을 적지 않는다.**
 *
 * 웹(frontend/src/App.css의 `:root`)과 같은 팔레트를 손으로 옮겨 둔 것이다.
 * 웹은 CSS 변수라 개발 모드의 화면 조정 패널이 실시간으로 고쳐 쓸 수 있지만,
 * 앱에는 CSS 변수가 없어서 그 장치를 그대로 가져올 수 없다.
 * → **App.css의 토큰을 바꾸면 이 파일도 함께 고쳐야 한다.** 지금은 이것이 유일한 중복이다.
 */

export const colors = {
  bg: '#f1f3ef',
  card: '#fbfbf9',
  text: '#2b322d',
  muted: '#78807a',
  line: '#e0e4dd',
  lineSoft: '#eaeee7',

  accent: '#4d6b57',
  accentSoft: '#e4ebe5',
  onAccent: '#ffffff',

  danger: '#96574a',
  dangerSoft: '#f0e5e1',
  warn: '#91753c',
  warnSoft: '#f3ecdd',
} as const;

/** 중요도 1·2·3 — 한 색의 세 농도. 빨강·주황·파랑이 아니다. */
export const importanceColors = {
  1: '#c3cec5',
  2: '#9aa89f',
  3: '#4d6b57',
} as const;

/** 진행률 단계 — shared/labels.js의 progressLevel이 고른 단계에 색을 붙인다. */
export const progressColors = {
  low: '#96574a',
  mid: '#91753c',
  high: '#4d6b57',
} as const;

export const radius = { md: 14, sm: 10 } as const;

/** 누르는 것의 최소 크기. 웹의 `--tap`과 같은 약속이다. */
export const TAP = 44;

/** 입력칸 글자 크기. 이보다 작게 두지 않는다 — iOS가 누를 때 화면을 확대한다. */
export const INPUT_FONT_SIZE = 16;
