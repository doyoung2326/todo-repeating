import { useState, useEffect } from 'react';
import { STAGE_LABELS, IMP_COLORS, progressColor } from '../theme';
import MoreMenu from './MoreMenu';

function daysDiff(dateStr, today) {
  return Math.round((new Date(dateStr + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
}

function Dot({ importance }) {
  return <span className="imp-dot" style={{ background: IMP_COLORS[importance] }} />;
}

/* ── 타임라인 뷰 ────────────────────────────────── */
const DAY_START = 6;
const DAY_END   = 24;

const HOUR_PX       = 52;   // 항목이 걸쳐 있는 시간대
const EMPTY_HOUR_PX = 18;   // 빈 시간대 — 눈금은 그대로 두고 높이만 접는다

// 블록 안에 들어가는 것은 제목 한 줄뿐이다: 여백 8 + 테두리 2 + 글자 줄 19 ≈ 29px.
// 시각은 블록이 놓인 위치가 말해주므로 블록 안에 또 적지 않는다 — 좁은 칸에서
// "21:51 – 12:51"이 말줄임표로 끊기면 시간을 적은 의미가 없어진다.
const MIN_BLOCK_PX = 30;

function timeToMin(t) {
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

function Timeline({ items }) {
  const timed   = items.filter(t => t.start_time);
  const untimed = items.filter(t => !t.start_time);
  const placed  = layoutTimed(timed);
  const axis    = buildTimeAxis(placed);

  return (
    <div className="timeline-wrap">
      {timed.length === 0 && untimed.length === 0 && (
        <p className="tl-empty">오늘 할 일이 없습니다</p>
      )}

      {untimed.length > 0 && (
        <div className="tl-untimed">
          <span className="tl-section-label">시간 미정</span>
          {untimed.map(t => (
            <div key={t.id} className="tl-chip">
              <Dot importance={t.importance} />
              <span className="tl-chip-text">{t.text}</span>
            </div>
          ))}
        </div>
      )}

      {timed.length > 0 && (
        <div className="tl-grid" style={{ height: axis.height }}>
          {axis.rows.map(row => (
            <div
              key={row.hour}
              className={`tl-hour-line${row.busy ? '' : ' empty'}`}
              style={{ top: row.y }}
            >
              <span className="tl-hour-label">{String(row.hour).padStart(2, '0')}:00</span>
            </div>
          ))}

          {/* 30분 기준선. 블록 안에 시각을 적지 않으므로, 위치만으로 반 시간까지
              읽을 수 있게 눈금을 하나 더 둔다. 접힌 시간대에는 넣을 자리가 없다. */}
          {axis.rows.filter(row => row.busy).map(row => (
            <div
              key={`half-${row.hour}`}
              className="tl-half-line"
              style={{ top: row.y + row.height / 2 }}
            />
          ))}

          {/* 블록은 시간 눈금 오른쪽 영역 안에서만 자리를 나눠 갖는다 */}
          <div className="tl-lanes">
            {placed.map(({ t, start, end, lane, lanes }) => {
              const top    = axis.yOf(start);
              const height = Math.max(axis.yOf(end) - top, MIN_BLOCK_PX);
              const label  = `${t.start_time}${t.end_time ? ` – ${t.end_time}` : ''}`;
              return (
                <div
                  key={t.id}
                  className="tl-block"
                  style={{
                    top, height,
                    left: `${(lane / lanes) * 100}%`,
                    width: `calc(${100 / lanes}% - 2px)`,
                    borderLeftColor: IMP_COLORS[t.importance],
                  }}
                  title={`${label} ${t.text}`}
                >
                  <span className="tl-block-text">{t.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 오늘 수행 항목 행 (진행률 슬라이더 포함) ──────── */
function TodayTodoRow({ t, today, compact, onComplete, onRemove, onSaveProgress }) {
  const [val, setVal] = useState(t.progress ?? 0);

  useEffect(() => { setVal(t.progress ?? 0); }, [t.progress]);

  const diff     = t.deadline ? daysDiff(t.deadline, today) : null;
  const barColor = progressColor(val);

  return (
    <div className="today-row">
      <Dot importance={t.importance} />
      <div className="today-row-text">
        <span className="today-title">{t.text}</span>
        <div className="today-meta-row">
          {t.start_time && (
            <span className="today-time-badge">{t.start_time}{t.end_time ? `–${t.end_time}` : ''}</span>
          )}
          {diff !== null && (
            <span className={`today-sub ${diff < 0 ? 'danger' : diff === 0 ? 'warning' : ''}`}>
              마감 {diff < 0 ? `${Math.abs(diff)}일 지남` : diff === 0 ? '오늘' : `D-${diff}`}
            </span>
          )}
        </div>

        <div className="today-progress-wrap">
          <input
            type="range" min="0" max="100" step="5"
            value={val}
            aria-label={`${t.text} 진행률`}
            onChange={e => setVal(Number(e.target.value))}
            onMouseUp={e  => onSaveProgress(t.id, Number(e.currentTarget.value))}
            onTouchEnd={e => onSaveProgress(t.id, Number(e.currentTarget.value))}
            className="today-progress-slider"
            style={{ '--fill': `${val}%`, '--bar-color': barColor }}
          />
          <span className="today-progress-pct" style={{ color: barColor }}>{val}%</span>
        </div>
      </div>
      <div className="today-row-actions">
        <button className="pill-btn success sm" onClick={() => onComplete(t.id, true)}>완료</button>
        {compact ? (
          <MoreMenu
            label={`${t.text} 항목 메뉴`}
            items={[{ label: '오늘 목록에서 제거', onSelect: () => onRemove(t.id) }]}
          />
        ) : (
          <button className="icon-btn-xs" title="오늘 목록에서 제거" onClick={() => onRemove(t.id)}>✕</button>
        )}
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ──────────────────────────────── */
export default function TodaySection({
  todayPerformTodos, todayReviews, today,
  isDragOver, compact,
  onCompleteTodo, onCompleteReview, onRemovePerformDate, onSaveProgress,
}) {
  const [view, setView] = useState('list'); // 'list' | 'timeline'

  const total = todayPerformTodos.length + todayReviews.length;

  return (
    <div className={`card section-card${isDragOver ? ' card-drag-over' : ''}`}>
      <div className="today-header-row">
        <h2 className="section-title">
          오늘 할 일
          {total > 0 && <span className="count-badge">{total}</span>}
        </h2>
        <div className="view-tabs">
          <button className={`view-tab${view === 'list'     ? ' active' : ''}`} onClick={() => setView('list')}>목록</button>
          <button className={`view-tab${view === 'timeline' ? ' active' : ''}`} onClick={() => setView('timeline')}>타임라인</button>
        </div>
      </div>

      {/* 드래그로 등록하는 안내. 터치에서는 동작하지 않으므로 CSS가 넓은 화면에서만 보여준다. */}
      <div className={`drop-zone${isDragOver ? ' drag-over' : ''}`}>
        <span>{isDragOver ? '여기에 놓으세요' : '할 일을 여기로 끌어다 놓으면 오늘 수행으로 등록됩니다'}</span>
      </div>

      {view === 'list' && (
        <div className="today-body">
          {total === 0 && (
            <div className="col-empty">
              <p>오늘 할 일이 없습니다</p>
            </div>
          )}

          {/* (a) 수행날짜가 오늘인 미완료 항목 */}
          {todayPerformTodos.length > 0 && (
            <div className="today-group">
              <p className="today-group-label primary">오늘 수행 ({todayPerformTodos.length})</p>
              {todayPerformTodos.map(t => (
                <TodayTodoRow
                  key={t.id} t={t} today={today} compact={compact}
                  onComplete={onCompleteTodo}
                  onRemove={onRemovePerformDate}
                  onSaveProgress={onSaveProgress}
                />
              ))}
            </div>
          )}

          {/* (b) 오늘이 복습일인 항목 */}
          {todayReviews.length > 0 && (
            <div className="today-group">
              <p className="today-group-label warning">오늘 복습 ({todayReviews.length})</p>
              {todayReviews.map(t => {
                const r = t.activeReview;
                const overdue = r.due_date < today;
                return (
                  <div key={t.id} className="today-row">
                    <Dot importance={t.importance} />
                    <div className="today-row-text">
                      <span className="today-title">{t.text}</span>
                      <span className={`today-sub ${overdue ? 'danger' : 'warning'}`}>
                        {STAGE_LABELS[r.stage]} 복습{overdue ? ` — ${Math.abs(daysDiff(r.due_date, today))}일 지남` : ' — 오늘'}
                      </span>
                    </div>
                    <div className="today-row-actions">
                      <button className="pill-btn primary sm" onClick={() => onCompleteReview(r.id)}>완료</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'timeline' && <Timeline items={todayPerformTodos} />}
    </div>
  );
}
