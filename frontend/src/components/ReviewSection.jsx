import { STAGE_LABELS, IMP_COLORS } from '../theme';
import { daysDiff } from '../../../shared/dates.js';

const STAGE_COUNT = STAGE_LABELS.length;


/**
 * 1·3·7·16·30일 중 몇 번째까지 왔는지 보여주는 다섯 칸.
 *
 * 예전에는 이걸 카드 하나로 따로 두고 가장 급한 항목 하나만 그렸다.
 * 나머지가 안 보여서 누락처럼 읽히길래, 항목마다 제자리에 붙였다.
 */
function StageBar({ stage }) {
  return (
    <span
      className="rev-stages"
      role="img"
      aria-label={`복습 ${STAGE_COUNT}단계 중 ${stage + 1}번째`}
    >
      {Array.from({ length: STAGE_COUNT }, (_, i) => (
        <i key={i} className={i < stage ? 'done' : i === stage ? 'now' : ''} />
      ))}
    </span>
  );
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
      <h2 className="section-title">
        복습 예정
        {items.length > 0 && <span className="count-sm">{items.length}</span>}
      </h2>

      {items.length === 0 && (
        <div className="col-empty">
          <p>복습 일정이 없습니다</p>
        </div>
      )}

      {overdue.length > 0 && (
        <ReviewGroup label="지남" type="danger" items={overdue} onComplete={onCompleteReview} canComplete />
      )}
      {dueToday.length > 0 && (
        <ReviewGroup label="오늘" type="warning" items={dueToday} onComplete={onCompleteReview} canComplete />
      )}
      {upcoming.length > 0 && (
        <ReviewGroup label="예정" type="primary" items={upcoming} onComplete={onCompleteReview} />
      )}
    </div>
  );
}

function ReviewGroup({ label, type, items, onComplete, canComplete }) {
  return (
    <div className="rev-group">
      <p className={`rev-group-label ${type}`}>{label} ({items.length})</p>
      {items.map(item => (
        <div key={item.id} className={`rev-item ${type}`}>
          <span className="imp-dot" style={{ background: IMP_COLORS[item.importance] }} />
          <div className="rev-item-body">
            <span className="rev-item-text">{item.todoText}</span>
            <span className="rev-item-meta">
              <span>
                {STAGE_LABELS[item.stage]}
                {item.diff < 0
                  ? ` · ${Math.abs(item.diff)}일 지남`
                  : item.diff === 0
                  ? ' · 오늘'
                  : ` · D-${item.diff}`}
              </span>
              <StageBar stage={item.stage} />
            </span>
          </div>
          {canComplete && (
            <button className="pill-btn primary sm" onClick={() => onComplete(item.id)}>완료</button>
          )}
        </div>
      ))}
    </div>
  );
}
