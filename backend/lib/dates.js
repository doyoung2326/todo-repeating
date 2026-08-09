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

/**
 * from에서 to까지 며칠인지. to가 과거면 음수다.
 * (DST 때문에 24시간으로 나누면 어긋나므로 정오 기준으로 재서 반올림한다)
 */
function daysDiff(from, to) {
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

module.exports = { toDateStr, localDate, addDays, daysDiff };
