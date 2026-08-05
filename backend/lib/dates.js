// 날짜 관련 순수 함수 모음 (DB·서버 상태에 의존하지 않으므로 단위 테스트 대상)

/** YYYY-MM-DD 문자열로 변환 */
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 오늘 날짜(로컬 기준) YYYY-MM-DD */
function localDate() {
  return toDateStr(new Date());
}

/** YYYY-MM-DD 문자열에 days일을 더한 YYYY-MM-DD */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

module.exports = { toDateStr, localDate, addDays };
