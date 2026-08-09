import { useState, useEffect } from 'react';
import { STAGE_LABELS, IMP_COLORS, progressColor } from '../theme';
import { daysDiff } from '../../../shared/dates.js';
import { layoutTimed, buildTimeAxis, MIN_BLOCK_PX } from '../../../shared/timeline.js';
import MoreMenu from './MoreMenu';

function Dot({ importance }) {
  return <span className="imp-dot" style={{ background: IMP_COLORS[importance] }} />;
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
