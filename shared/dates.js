/**
 * 날짜 계산. 서버가 주고받는 날짜는 전부 'YYYY-MM-DD' 문자열이고,
 * 여기서는 **기기의 시계(로컬 시간대)** 를 기준으로 읽는다 — 사용자가 말하는 "오늘"은
 * UTC의 오늘이 아니다.
 */

/** 기기 시계 기준의 오늘. 'YYYY-MM-DD' */
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 다음 자정까지 남은 밀리초. 1초를 더하는 것은 정확히 0시 0분 0초에 깨면
 * 시계가 아직 어제로 읽힐 수 있어서다.
 */
export function msUntilMidnight(now = new Date()) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight - now + 1000;
}

/** 두 'YYYY-MM-DD' 사이의 날짜 수. 미래가 양수다. */
export function daysDiff(dateStr, today) {
  return Math.round((new Date(dateStr + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-08-08' → '8월 8일 금요일'. 좁은 화면의 헤더에서 쓴다. */
export function formatKoreanDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}
