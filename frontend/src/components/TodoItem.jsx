const STAGE_LABELS = ['1일차', '3일차', '7일차', '16일차', '30일차'];
const IMP_COLOR    = { 1: '#3b82f6', 2: '#f59e0b', 3: '#ef4444' };
const IMP_LABEL    = { 1: '낮음', 2: '중간', 3: '높음' };

function daysDiff(dateStr, today) {
  return Math.round((new Date(dateStr + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
}

function ReviewBadge({ review, today, onCompleteReview }) {
  const diff  = daysDiff(review.due_date, today);
  const stage = STAGE_LABELS[review.stage];
  if (diff < 0) return (
    <div className="review-tag overdue">
      🔄 {stage} — {Math.abs(diff)}일 지남
      <button className="tag-btn" onClick={e => { e.stopPropagation(); onCompleteReview(review.id); }}>완료</button>
    </div>
  );
  if (diff === 0) return (
    <div className="review-tag today-review">
      🔄 {stage} — 오늘!
      <button className="tag-btn" onClick={e => { e.stopPropagation(); onCompleteReview(review.id); }}>완료</button>
    </div>
  );
  return <div className="review-tag upcoming">🔄 {stage} — D-{diff}</div>;
}

export default function TodoItem({ todo, today, onComplete, onEdit, onDelete, onCompleteReview, onAddToToday, onDragStart, onDragEnd }) {
  const done        = !!todo.completed;
  const needsReview = !!todo.needs_review;
  const c           = IMP_COLOR[todo.importance];

  // 마감일 태그
  let deadlineTag = null;
  if (todo.deadline && !done) {
    const diff = daysDiff(todo.deadline, today);
    if      (diff < 0)   deadlineTag = <span className="dl-tag dl-over">📅 {Math.abs(diff)}일 지남</span>;
    else if (diff === 0) deadlineTag = <span className="dl-tag dl-today">📅 오늘 마감</span>;
    else if (diff <= 3)  deadlineTag = <span className="dl-tag dl-soon">📅 D-{diff}</span>;
    else                 deadlineTag = <span className="dl-tag dl-normal">📅 D-{diff}</span>;
  }

  // 수행날짜 태그
  let performTag = null;
  if (todo.perform_date && !done) {
    const diff = daysDiff(todo.perform_date, today);
    if      (diff < 0)   performTag = <span className="dl-tag dl-over">🗓 {Math.abs(diff)}일 전 수행</span>;
    else if (diff === 0) performTag = <span className="dl-tag dl-today">🗓 오늘 수행</span>;
    else                 performTag = <span className="dl-tag dl-normal">🗓 D-{diff} 수행</span>;
  }

  const pct      = todo.progress ?? 0;
  const barColor = pct < 30 ? '#ef4444' : pct < 70 ? '#f59e0b' : '#10b981';

  const showReview = done && needsReview;
  const allDone    = showReview && !todo.activeReview;

  // 오늘 수행 미등록 여부
  const notPinnedToday = !done && todo.perform_date !== today;

  return (
    <div className={`todo-item${done ? ' done' : ''}`}>

      {/* 드래그 핸들 — 이 span만 draggable로 설정해 checkbox 충돌 방지 */}
      {!done && (
        <span
          className="drag-handle"
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('text/plain', String(todo.id));
            e.dataTransfer.effectAllowed = 'move';
            onDragStart && onDragStart(todo.id);
          }}
          onDragEnd={() => onDragEnd && onDragEnd()}
          title="드래그 → 오늘 할 일로 이동"
        >⠿</span>
      )}

      <input className="todo-check" type="checkbox"
        checked={done} onChange={e => onComplete(todo.id, e.target.checked)} />

      <div className="todo-body">
        <div className="todo-top">
          <span className={`todo-text${done ? ' struck' : ''}`}>{todo.text}</span>
          <span className="imp-tag" style={{ background: c + '22', color: c, borderColor: c + '55' }}>
            {IMP_LABEL[todo.importance]}
          </span>
          {needsReview && !done && <span className="review-pending-tag">복습 예정</span>}
          {todo.start_time && (
            <span className="time-tag">
              🕐 {todo.start_time}{todo.end_time ? `–${todo.end_time}` : ''}
            </span>
          )}
        </div>

        <div className="todo-meta">
          {deadlineTag}
          {performTag}
          {showReview && !allDone && (
            <ReviewBadge review={todo.activeReview} today={today} onCompleteReview={onCompleteReview} />
          )}
          {allDone && <span className="review-tag done-tag">🎓 전체 복습 완료</span>}
        </div>

        {!done && todo.progress !== null && (
          <div className="progress-bar-container" title={`진행률 ${pct}%`}>
            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
            <span className="progress-pct">{pct}%</span>
          </div>
        )}
      </div>

      <div className="todo-actions">
        {/* 오늘 할 일 등록 버튼 (수행날짜가 오늘이 아닌 미완료 항목에만 표시) */}
        {notPinnedToday && onAddToToday && (
          <button
            className="icon-btn pin"
            title="오늘 할 일로 등록"
            onClick={() => onAddToToday(todo.id)}
          >📌</button>
        )}
        {!done && (
          <button className="icon-btn" title="수정" onClick={() => onEdit(todo)}>✏️</button>
        )}
        <button className="icon-btn del" title="삭제" onClick={() => onDelete(todo.id)}>🗑️</button>
      </div>
    </div>
  );
}
