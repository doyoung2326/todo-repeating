import { Platform, type TextStyle } from 'react-native';

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
  line: '#e0e4dd',      // 카드 테두리
  lineSoft: '#eaeee7',  // 항목 사이 구분선

  accent: '#4d6b57',
  accentSoft: '#e4ebe5',
  onAccent: '#ffffff',

  danger: '#96574a',
  dangerSoft: '#f0e5e1',
  warn: '#91753c',
  warnSoft: '#f3ecdd',
} as const;

/** 중요도 1·2·3 — 한 색의 세 농도. 빨강·주황·파랑이 아니다. 점에 쓴다. */
export const importanceColors = {
  1: '#c3cec5',
  2: '#9aa89f',
  3: '#4d6b57',
} as const;

/** 같은 중요도를 칩으로 그릴 때의 바탕·글자 (웹의 --imp-N-bg / --imp-N-fg). */
export const importanceChip = {
  1: { bg: '#eef0ec', fg: '#78807a' },
  2: { bg: '#e7ece7', fg: '#5f7566' },
  3: { bg: '#dbe6dd', fg: '#3a5442' },
} as const;

/**
 * 할 일 성격 — 사용자가 고르는 8칸.
 * 서버에는 칸 번호(1~8)만 저장하고 실제 색은 여기서만 정한다.
 * 채도는 danger·warn과 같은 대역으로 눌러 둔다 — 여기만 쨍하면
 * "강조는 accent 한 색뿐"이라는 화면 전체의 약속이 무너진다.
 */
export const categoryColors = {
  1: { solid: '#657051', bg: '#e7ebe0', fg: '#4c5738' },
  2: { solid: '#456668', bg: '#e0eaeb', fg: '#325052' },
  3: { solid: '#516885', bg: '#e3e7ee', fg: '#35455a' },
  4: { solid: '#746487', bg: '#e8e3ed', fg: '#4c3f5a' },
  5: { solid: '#856073', bg: '#ede3e8', fg: '#573d4a' },
  6: { solid: '#915b55', bg: '#eee3e2', fg: '#5d3b37' },
  7: { solid: '#816b4b', bg: '#ede7de', fg: '#584932' },
  8: { solid: '#746b63', bg: '#e9e5e2', fg: '#514943' },
} as const;

/** 진행률 단계 — shared/labels.js의 progressLevel이 고른 단계에 색을 붙인다. */
export const progressColors = {
  low: '#96574a',
  mid: '#91753c',
  high: '#4d6b57',
} as const;

/** 진행률 막대의 바탕. 웹 .progress-bar-container의 배경과 같은 값이다. */
export const progressTrack = '#e7eae5';

export const radius = { md: 14, sm: 10 } as const;

/**
 * 글꼴. 웹 App.css의 `--font-body` / `--font-display`와 같은 것을 쓴다.
 *
 * **RN에는 CSS 같은 글꼴 목록 폴백이 없다** — 이름 하나만 받고, 그 이름이 없으면
 * 시스템 기본으로 떨어진다. 그래서 본문은 갈래를 나눈다:
 *
 *   웹      — 웹과 같은 목록을 그대로 넘긴다(react-native-web이 CSS로 흘려보낸다).
 *   네이티브 — 시스템 기본에 맡긴다. iOS의 기본이 마침 웹 목록의 2순위(Apple SD Gothic Neo)다.
 *
 * 제목은 나눔명조다. 웹은 Google Fonts에서 받아오고 앱은 파일을 담는데, 어느 쪽이든
 * **한글 명조는 기기에 기본으로 없어서** 직접 들이지 않으면 무조건 고딕으로 떨어진다.
 * 불러오는 곳은 `src/app/_layout.tsx`이고, 다 받기 전에는 화면을 열지 않는다.
 */
export const fontFamily = {
  body: Platform.select({
    web: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, "
      + "'Segoe UI', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
    default: undefined,
  }),
  display: 'NanumMyeongjo_800ExtraBold',
} as const;

/**
 * 웹이 `.pill-btn`·`.field-label`·`.imp-btn`에 쓰는 650.
 * RN의 타입은 백 단위만 받으므로 네이티브는 600으로 둔다 — 글꼴에 650 굵기가 없으면
 * 브라우저도 가까운 쪽으로 반올림하므로 실제로 보이는 차이는 크지 않다.
 */
export const WEIGHT_SEMI = Platform.select({
  web: '650',
  default: '600',
}) as TextStyle['fontWeight'];

/**
 * 글자 크기. 웹의 --fs-* 를 px로 옮긴 것이다(웹 기준 1rem = 16px).
 * 웹에는 --type-scale 배율이 있지만 앱에는 화면 조정 패널이 없어 고정값이다.
 */
export const fontSize = {
  title: 16,  // --fs-title
  meta: 13,   // --fs-meta  (.8125rem)
  chip: 12,   // --fs-chip  (.75rem)
} as const;

/**
 * 떠 있는 하단 탭바 — 높이와 화면 끝에서 띄우는 거리(웹의 --tabbar-h / --tabbar-gap).
 * + 버튼 위치와 목록 아래 여백이 이 값들로 계산되므로 한 곳에 둔다.
 */
export const TABBAR_H = 60;
export const TABBAR_GAP = 11;

/** 누르는 것의 최소 크기. 웹의 `--tap`과 같은 약속이다. */
export const TAP = 44;

/** 입력칸 글자 크기. 이보다 작게 두지 않는다 — iOS가 누를 때 화면을 확대한다. */
export const INPUT_FONT_SIZE = 16;
