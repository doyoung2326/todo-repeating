/**
 * 타임라인 배치 계산. 화면 기술(DOM·React Native)을 모르는 순수 계산이라
 * 웹(frontend)과 앱(mobile)이 같은 파일을 쓴다.
 *
 * 여기서 나오는 값의 단위는 px다. 웹은 CSS 픽셀로, 앱은 RN의 밀도 독립 픽셀로
 * 읽지만 둘 다 "논리 픽셀"이라 같은 수를 그대로 쓸 수 있다.
 */

export const DAY_START = 6;
export const DAY_END   = 24;

export const HOUR_PX       = 52;   // 항목이 걸쳐 있는 시간대
export const EMPTY_HOUR_PX = 18;   // 빈 시간대 — 눈금은 그대로 두고 높이만 접는다

// 블록 안에 들어가는 것은 제목 한 줄뿐이다: 여백 8 + 테두리 2 + 글자 줄 19 ≈ 29px.
// 시각은 블록이 놓인 위치가 말해주므로 블록 안에 또 적지 않는다 — 좁은 칸에서
// "21:51 – 12:51"이 말줄임표로 끊기면 시간을 적은 의미가 없어진다.
export const MIN_BLOCK_PX = 30;

export function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * 시간이 겹치는 항목들을 나란한 칸으로 나눈다.
 *
 * 예전에는 모든 블록을 같은 자리(왼쪽 끝~오른쪽 끝)에 그려서, 시간이 겹치면
 * 나중 것이 앞 것을 덮어 글자가 잘렸다. 여기서 겹치는 것끼리 묶고(cluster)
 * 묶음 안에서 빈 칸을 찾아 넣은 뒤, 칸 수만큼 폭을 나눠 갖게 한다.
 */
export function layoutTimed(items) {
  const events = items
    .map(t => {
      const start = timeToMin(t.start_time);
      let end = t.end_time ? timeToMin(t.end_time) : start + 60;
      // 종료가 시작보다 빠르면(잘못 입력된 값) 1시간짜리로 본다.
      // 그냥 두면 높이가 음수가 되어 최소 높이로 찌그러지고 글자가 잘린다.
      if (end <= start) end = start + 60;
      return { t, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const placed = [];
  let cluster = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds = [];
    for (const ev of cluster) {
      // 이 항목이 시작할 때 이미 비어 있는 칸을 찾는다. 없으면 칸을 하나 늘린다.
      let lane = laneEnds.findIndex(end => ev.start >= end);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = ev.end;
      ev.lane = lane;
    }
    cluster.forEach(ev => placed.push({ ...ev, lanes: laneEnds.length }));
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const ev of events) {
    if (cluster.length > 0 && ev.start >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.end);
  }
  flush();

  return placed;
}

/**
 * 세로 축을 만든다. 06–24시 눈금은 그대로 두되, **항목이 하나도 없는 시간대는 높이를 접는다.**
 * 예전에는 18시간을 똑같이 52px씩 그려서 936px이 됐고, 저녁에만 일정이 있어도
 * 아침부터 한참 스크롤해야 했다.
 *
 * 축은 06–24시를 기본으로 하되, 그 밖의 시각에 항목이 있으면 거기까지 늘린다
 * (예전에는 05시 항목이 축 위쪽 바깥에 그려져 보이지 않았다).
 */
export function buildTimeAxis(events) {
  const occupied = new Set();
  let first = DAY_START;
  let last  = DAY_END;

  for (const ev of events) {
    const from = Math.floor(ev.start / 60);
    const to   = Math.ceil(ev.end / 60);
    for (let h = from; h < to; h++) occupied.add(h);
    if (from < first) first = from;
    if (to   > last)  last  = to;
  }

  const rows = [];
  let y = 0;
  for (let h = first; h < last; h++) {
    const busy = occupied.has(h);
    const height = busy ? HOUR_PX : EMPTY_HOUR_PX;
    rows.push({ hour: h, y, height, busy });
    y += height;
  }

  const byHour = new Map(rows.map(r => [r.hour, r]));

  /** 분 단위 시각 → 축 위의 y. 시간대마다 높이가 다르므로 그 안에서 비례로 나눈다. */
  const yOf = (min) => {
    const h = Math.floor(min / 60);
    const row = byHour.get(h);
    if (!row) return h < first ? 0 : y;
    return row.y + ((min - h * 60) / 60) * row.height;
  };

  return { rows, height: y, yOf };
}
