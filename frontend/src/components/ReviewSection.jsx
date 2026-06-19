const STAGE_LABELS = ['1일차', '3일차', '7일차', '16일차', '30일차'];
const IMP_COLORS = { 1: '#3b82f6', 2: '#f59e0b', 3: '#ef4444' };

function daysDiff(dateStr, today) {
  const a = new Date(dateStr + 'T00:00:00');
  const b = new Date(today + 'T00:00:00');
  return Math.round((a - b) / 86400000);
}

export default function ReviewSection({ todos, today, onCompleteReview }) {
  const items = todos
    .filter(t => t.activeReview)
    .map(t => ({
      id: t.activeReview.id,
      stage: t.activeReview.stage,
      due_date: t.activeReview.due_date,
      todoText: t.text,
      importance: t.importance,
      diff: daysDiff(t.activeReview.due_date, today),
    }))
    .sort((a, b) => a.diff - b.diff);

  const overdue  = items.filter(r => r.diff < 0);
  const dueToday = items.filter(r => r.diff === 0);
  const upcoming = items.filter(r => r.diff > 0);

  return (
    <div className="card section-card">
      <p className="section-title">
        🔄 복습 예정
        {items.length > 0 && <span className="count-sm">{items.length}</span>}
      </p>

      {items.length === 0 && (
        <div className="col-empty">
          <span>🎓</span>
          <p>복습 일정이 없습니다</p>
        </div>
      )}

      {overdue.length > 0 && (
        <ReviewGroup label="⚠️ 지남" type="danger" items={overdue} onComplete={onCompleteReview} canComplete />
      )}
      {dueToday.length > 0 && (
        <ReviewGroup label="📅 오늘" type="warning" items={dueToday} onComplete={onCompleteReview} canComplete />
      )}
      {upcoming.length > 0 && (
        <ReviewGroup label="📆 예정" type="primary" items={upcoming} onComplete={onCompleteReview} />
      )}
    </div>
  );
}

function ReviewGroup({ label, type, items, onComplete, canComplete }) {
  return (
    <div className="rev-group">
      <p className={`rev-group-label ${type}`}>{label}</p>
      {items.map(item => (
        <div key={item.id} className={`rev-item ${type}`}>
          <span
            className="imp-dot"
            style={{ background: IMP_COLORS[item.importance] }}
          />
          <div className="rev-item-body">
            <span className="rev-item-text">{item.todoText}</span>
            <span className="rev-item-meta">
              {STAGE_LABELS[item.stage]}
              {item.diff < 0
                ? ` · ${Math.abs(item.diff)}일 지남`
                : item.diff === 0
                ? ' · 오늘'
                : ` · D-${item.diff}`}
            </span>
          </div>
          {canComplete && (
            <button className="pill-btn primary sm" onClick={() => onComplete(item.id)}>
              완료
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
