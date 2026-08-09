import { STAGE_LABELS, IMP_LABELS, progressColor } from '../theme';
import { daysDiff } from '../../../shared/dates.js';
import MoreMenu from './MoreMenu';
import { PinIcon, EditIcon, TrashIcon } from './icons';


function ReviewBadge({ review, today, onCompleteReview }) {
  const diff  = daysDiff(review.due_date, today);
  const stage = STAGE_LABELS[review.stage];

  if (diff < 0) return (
    <span className="review-tag overdue">
      {stage} 복습 — {Math.abs(diff)}일 지남
      <button className="tag-btn" onClick={e => { e.stopPropagation(); onCompleteReview(review.id); }}>완료</button>
    </span>
  );
  if (diff === 0) return (
    <span className="review-tag today-review">
      {stage} 복습 — 오늘
      <button className="tag-btn" onClick={e => { e.stopPropagation(); onCompleteReview(review.id); }}>완료</button>
    </span>
  );
  return <span className="review-tag upcoming">{stage} 복습 — D-{diff}</span>;
}

export default function TodoItem({
  todo, today, compact,
  onComplete, onEdit, onDelete, onCompleteReview, onAddToToday, onDragStart, onDragEnd,
}) {
  const done        = !!todo.completed;
  const needsReview = !!todo.needs_review;

  // 마감일 태그
  let deadlineTag = null;
  if (todo.deadline && !done) {
    const diff = daysDiff(todo.deadline, today);
    if      (diff < 0)   deadlineTag = <span className="dl-tag dl-over">마감 {Math.abs(diff)}일 지남</span>;
    else if (diff === 0) deadlineTag = <span className="dl-tag dl-today">오늘 마감</span>;
    else if (diff <= 3)  deadlineTag = <span className="dl-tag dl-soon">마감 D-{diff}</span>;
    else                 deadlineTag = <span className="dl-tag dl-normal">마감 D-{diff}</span>;
  }

  // 수행날짜 태그
  let performTag = null;
  if (todo.perform_date && !done) {
    const diff = daysDiff(todo.perform_date, today);
    if      (diff < 0)   performTag = <span className="dl-tag dl-over">{Math.abs(diff)}일 전 수행</span>;
    else if (diff === 0) performTag = <span className="dl-tag dl-today">오늘 수행</span>;
    else                 performTag = <span className="dl-tag dl-normal">D-{diff} 수행</span>;
  }

  const pct      = todo.progress ?? 0;
  const barColor = progressColor(pct);

  const showReview = done && needsReview;
  const allDone    = showReview && !todo.activeReview;

  // 오늘 수행으로 아직 안 올린 항목에만 등록 버튼을 준다
  const notPinnedToday = !done && todo.perform_date !== today;
  const canPin         = notPinnedToday && !!onAddToToday;

  return (
    <div className={`todo-item${done ? ' done' : ''}`}>

      {/* 드래그 핸들 — 이 span만 draggable로 두어 체크박스와 충돌하지 않게 한다.
          터치에서는 draggable이 동작하지 않으므로 CSS가 넓은 화면에서만 보여준다. */}
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
          <span
            className="imp-tag"
            style={{ background: `var(--imp-${todo.importance}-bg)`, color: `var(--imp-${todo.importance}-fg)` }}
          >
            {IMP_LABELS[todo.importance]}
          </span>
          {needsReview && !done && <span className="review-pending-tag">복습 예정</span>}
          {todo.start_time && (
            <span className="time-tag">
              {todo.start_time}{todo.end_time ? `–${todo.end_time}` : ''}
            </span>
          )}
        </div>

        <div className="todo-meta">
          {deadlineTag}
          {performTag}
          {showReview && !allDone && (
            <ReviewBadge review={todo.activeReview} today={today} onCompleteReview={onCompleteReview} />
          )}
          {allDone && <span className="review-tag done-tag">복습 전부 완료</span>}
        </div>

        {!done && todo.progress !== null && (
          <div className="progress-bar-container" title={`진행률 ${pct}%`}>
            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
            <span className="progress-pct">{pct}%</span>
          </div>
        )}
      </div>

      <div className="todo-actions">
        {/* 좁은 화면: 주된 행동만 버튼으로 남기고 나머지는 ⋯ 안으로.
            넓은 화면: 아이콘 버튼 세 개를 그대로 보여준다. */}
        {compact ? (
          <>
            {canPin && (
              <button className="pill-btn sm" title="오늘 할 일로 등록"
                onClick={() => onAddToToday(todo.id)}>오늘로</button>
            )}
            <MoreMenu
              label={`${todo.text} 항목 메뉴`}
              items={[
                ...(done ? [] : [{ label: '수정', onSelect: () => onEdit(todo) }]),
                { label: '삭제', danger: true, onSelect: () => onDelete(todo.id) },
              ]}
            />
          </>
        ) : (
          <>
            {canPin && (
              <button className="icon-btn pin" title="오늘 할 일로 등록"
                onClick={() => onAddToToday(todo.id)}><PinIcon /></button>
            )}
            {!done && (
              <button className="icon-btn" title="수정" onClick={() => onEdit(todo)}><EditIcon /></button>
            )}
            <button className="icon-btn del" title="삭제" onClick={() => onDelete(todo.id)}><TrashIcon /></button>
          </>
        )}
      </div>
    </div>
  );
}
