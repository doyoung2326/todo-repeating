import { useState, useEffect } from 'react';

const STAGE_LABELS = ['1일차', '3일차', '7일차', '16일차', '30일차'];
const IMP_COLORS   = { 1: '#3b82f6', 2: '#f59e0b', 3: '#ef4444' };
const IMP_LABELS   = { 1: '낮음', 2: '중간', 3: '높음' };

function daysDiff(dateStr, today) {
  return Math.round((new Date(dateStr + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
}

function Dot({ importance }) {
  return <span className="imp-dot" style={{ background: IMP_COLORS[importance] }} />;
}

/* ── 타임라인 뷰 ────────────────────────────────── */
const START_HOUR  = 6;
const END_HOUR    = 24;
const HOUR_PX     = 52;

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function Timeline({ items }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const timed = items.filter(t => t.start_time);
  const untimed = items.filter(t => !t.start_time);

  return (
    <div className="timeline-wrap">
      {timed.length === 0 && untimed.length === 0 && (
        <p className="tl-empty">오늘 할 일이 없습니다</p>
      )}

      {/* 시간 없는 항목 */}
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

      {/* 시간 있는 항목 */}
      {timed.length > 0 && (
        <div className="tl-grid" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
          {/* 시간 레일 */}
          {hours.map(h => (
            <div
              key={h}
              className="tl-hour-line"
              style={{ top: (h - START_HOUR) * HOUR_PX }}
            >
              <span className="tl-hour-label">{String(h).padStart(2,'0')}:00</span>
            </div>
          ))}

          {/* 항목 블록 */}
          {timed.map(t => {
            const startMin = timeToMin(t.start_time) - START_HOUR * 60;
            const endMin   = t.end_time
              ? timeToMin(t.end_time) - START_HOUR * 60
              : startMin + 60;
            const top    = (startMin / 60) * HOUR_PX;
            const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, 28);
            return (
              <div
                key={t.id}
                className="tl-block"
                style={{
                  top, height,
                  borderLeftColor: IMP_COLORS[t.importance],
                  background: IMP_COLORS[t.importance] + '18',
                }}
              >
                <span className="tl-block-time">
                  {t.start_time}{t.end_time ? ` – ${t.end_time}` : ''}
                </span>
                <span className="tl-block-text">{t.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── 오늘 수행 항목 행 (슬라이더 포함) ──────────── */
function TodayTodoRow({ t, today, onComplete, onRemove, onSaveProgress }) {
  const [val, setVal] = useState(t.progress ?? 0);

  useEffect(() => { setVal(t.progress ?? 0); }, [t.progress]);

  const diff = t.deadline ? daysDiff(t.deadline, today) : null;

  const barColor = val < 30 ? '#ef4444' : val < 70 ? '#f59e0b' : '#10b981';

  return (
    <div className="today-row">
      <Dot importance={t.importance} />
      <div className="today-row-text">
        <span className="today-title">{t.text}</span>
        <div className="today-meta-row">
          {t.start_time && (
            <span className="today-time-badge">🕐 {t.start_time}{t.end_time ? `–${t.end_time}` : ''}</span>
          )}
          {diff !== null && (
            <span className={`today-sub ${diff < 0 ? 'danger' : diff === 0 ? 'warning' : ''}`}>
              마감 {diff < 0 ? `${Math.abs(diff)}일 지남` : diff === 0 ? '오늘' : `D-${diff}`}
            </span>
          )}
        </div>

        {/* 인라인 진행률 슬라이더 */}
        <div className="today-progress-wrap">
          <input
            type="range" min="0" max="100" step="5"
            value={val}
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
        <button className="icon-btn-xs" title="오늘 목록에서 제거" onClick={() => onRemove(t.id)}>✕</button>
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ──────────────────────────────── */
export default function TodaySection({
  todayPerformTodos, todayReviews, today,
  isDragOver,
  onCompleteTodo, onCompleteReview, onRemovePerformDate, onSaveProgress,
}) {
  const [view, setView] = useState('list'); // 'list' | 'timeline'

  const total = todayPerformTodos.length + todayReviews.length;

  return (
    <div className={`card section-card${isDragOver ? ' card-drag-over' : ''}`}>
      {/* 헤더 */}
      <div className="today-header-row">
        <p className="section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          📋 오늘 할 일
          {total > 0 && <span className="count-badge">{total}</span>}
        </p>
        <div className="view-tabs">
          <button className={`view-tab${view === 'list'     ? ' active' : ''}`} onClick={() => setView('list')}>목록</button>
          <button className={`view-tab${view === 'timeline' ? ' active' : ''}`} onClick={() => setView('timeline')}>타임라인</button>
        </div>
      </div>

      {/* 드롭 존 표시 영역 (이벤트는 카드 전체에서 처리) */}
      <div className={`drop-zone${isDragOver ? ' drag-over' : ''}`}>
        <span>{isDragOver ? '📌 여기에 놓으세요!' : '← 할일을 여기로 드래그 → 오늘 수행 항목 등록'}</span>
      </div>

      {/* 목록 뷰 */}
      {view === 'list' && (
        <div className="today-body">
          {total === 0 && (
            <div className="col-empty">
              <span>🎉</span>
              <p>오늘 할 일이 없습니다!</p>
            </div>
          )}

          {/* (a) 수행날짜=오늘인 미완료 항목 */}
          {todayPerformTodos.length > 0 && (
            <div className="today-group">
              <p className="today-group-label primary">📌 오늘 수행 ({todayPerformTodos.length})</p>
              {todayPerformTodos.map(t => (
                <TodayTodoRow
                  key={t.id} t={t} today={today}
                  onComplete={onCompleteTodo}
                  onRemove={onRemovePerformDate}
                  onSaveProgress={onSaveProgress}
                />
              ))}
            </div>
          )}

          {/* (b) 오늘 복습 항목 */}
          {todayReviews.length > 0 && (
            <div className="today-group">
              <p className="today-group-label warning">🔄 오늘 복습 ({todayReviews.length})</p>
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
                    <button className="pill-btn primary sm" onClick={() => onCompleteReview(r.id)}>완료</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 타임라인 뷰 */}
      {view === 'timeline' && (
        <Timeline items={todayPerformTodos} />
      )}
    </div>
  );
}
