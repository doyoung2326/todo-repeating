import { useState, useEffect } from 'react';

const IMP_LABELS = { 1: '낮음', 2: '중간', 3: '높음' };

export default function TodoForm({ onSubmit, initialValues, onCancel }) {
  const [text,        setText]       = useState('');
  const [importance,  setImportance] = useState(1);
  const [deadline,    setDeadline]   = useState('');
  const [performDate, setPerformDate]= useState('');
  const [needsReview, setNeedsReview]= useState(false);
  const [startTime,   setStartTime]  = useState('');
  const [endTime,     setEndTime]    = useState('');
  const [progress,    setProgress]   = useState(0);

  useEffect(() => {
    if (initialValues) {
      setText(initialValues.text || '');
      setImportance(initialValues.importance || 1);
      setDeadline(initialValues.deadline || '');
      setPerformDate(initialValues.perform_date || '');
      setNeedsReview(!!initialValues.needs_review);
      setStartTime(initialValues.start_time || '');
      setEndTime(initialValues.end_time || '');
      setProgress(initialValues.progress ?? 0);
    } else {
      setText(''); setImportance(1); setDeadline(''); setPerformDate('');
      setNeedsReview(false); setStartTime(''); setEndTime(''); setProgress(0);
    }
  }, [initialValues]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit({
      text: text.trim(),
      importance: Number(importance),
      deadline:     deadline     || null,
      perform_date: performDate  || null,
      needs_review: needsReview,
      start_time:   startTime    || null,
      end_time:     endTime      || null,
      ...(initialValues ? { progress } : {}),
    });
    if (!initialValues) {
      setText(''); setImportance(1); setDeadline(''); setPerformDate('');
      setNeedsReview(false); setStartTime(''); setEndTime('');
    }
  };

  const isEditing = !!initialValues;

  return (
    <form onSubmit={handleSubmit} className="card form-card">
      <h2 className="form-title">{isEditing ? '✏️ 할일 수정' : '➕ 할일 추가'}</h2>

      {/* 내용 */}
      <div className="field">
        <label className="field-label">내용</label>
        <input className="field-input" type="text" value={text}
          onChange={e => setText(e.target.value)} placeholder="무엇을 공부할 건가요?" required />
      </div>

      {/* 중요도 */}
      <div className="field">
        <label className="field-label">중요도</label>
        <div className="imp-btns">
          {[1, 2, 3].map(v => (
            <button key={v} type="button"
              className={`imp-btn imp-${v}${importance === v ? ' active' : ''}`}
              onClick={() => setImportance(v)}>{IMP_LABELS[v]}</button>
          ))}
        </div>
      </div>

      {/* 마감일 + 수행날짜 */}
      <div className="field-row">
        <div className="field">
          <label className="field-label">마감일 <span className="optional">(언제까지)</span></label>
          <input className="field-input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">수행날짜 <span className="optional">(언제 할지)</span></label>
          <input className="field-input" type="date" value={performDate} onChange={e => setPerformDate(e.target.value)} />
        </div>
      </div>

      {/* 시작/종료 시간 */}
      <div className="field-row">
        <div className="field">
          <label className="field-label">시작 시간 <span className="optional">(선택)</span></label>
          <input className="field-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">종료 시간 <span className="optional">(선택)</span></label>
          <input className="field-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
      </div>

      {/* 복습 필요 */}
      <label className="review-toggle">
        <input type="checkbox" checked={needsReview} onChange={e => setNeedsReview(e.target.checked)} />
        <span className="review-toggle-label">
          🔄 복습 필요
          <span className="review-toggle-hint"> — 완료 시 망각곡선 일정 자동 생성 (1·3·7·16·30일)</span>
        </span>
      </label>

      {/* 진행률 (수정 시에만 표시) */}
      {isEditing && (
        <div className="field" style={{ marginTop: '.7rem' }}>
          <label className="field-label">진행률: <strong>{progress}%</strong></label>
          <input type="range" min="0" max="100" step="5" value={progress}
            onChange={e => setProgress(Number(e.target.value))} className="progress-slider inline" />
          <div className="progress-bar-container" style={{ marginTop: '.4rem' }}>
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="form-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>}
        <button type="submit" className="btn btn-primary">{isEditing ? '수정 완료' : '추가하기'}</button>
      </div>
    </form>
  );
}
