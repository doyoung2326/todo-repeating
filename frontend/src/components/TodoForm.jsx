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
  const [timeError,   setTimeError]  = useState(null);

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
    setTimeError(null);
  }, [initialValues]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    // 종료가 시작보다 빠르면 타임라인에서 길이가 음수가 된다. 저장 전에 막는다.
    // ("09:30" 같은 형식이라 문자열 비교로 충분하다)
    if (startTime && endTime && endTime <= startTime) {
      setTimeError('종료 시간은 시작 시간보다 뒤여야 합니다.');
      return;
    }
    setTimeError(null);

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
      <h2 className="form-title">{isEditing ? '할 일 수정' : '할 일 추가'}</h2>

      {/* 입력칸은 label로 감싼다 — for/id 없이 나란히만 두면 라벨이 칸에 붙지 않아서
          화면 낭독기가 무슨 칸인지 읽어주지 못한다. */}
      <label className="field">
        <span className="field-label">내용</span>
        <input className="field-input" type="text" value={text}
          onChange={e => setText(e.target.value)} placeholder="무엇을 공부할 건가요?" required />
      </label>

      {/* 중요도 — 입력칸이 아니라 버튼 묶음이라 label로 감싸지 않는다 */}
      <div className="field" role="group" aria-labelledby="todo-form-importance">
        <span className="field-label" id="todo-form-importance">중요도</span>
        <div className="imp-btns">
          {[1, 2, 3].map(v => (
            <button key={v} type="button"
              className={`imp-btn imp-${v}${importance === v ? ' active' : ''}`}
              aria-pressed={importance === v}
              onClick={() => setImportance(v)}>{IMP_LABELS[v]}</button>
          ))}
        </div>
      </div>

      {/* 마감일 + 수행날짜 */}
      <div className="field-row">
        <label className="field">
          <span className="field-label">마감일 <span className="optional">(언제까지)</span></span>
          <input className="field-input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">수행날짜 <span className="optional">(언제 할지)</span></span>
          <input className="field-input" type="date" value={performDate} onChange={e => setPerformDate(e.target.value)} />
        </label>
      </div>

      {/* 시작/종료 시간 */}
      <div className="field-row">
        <label className="field">
          <span className="field-label">시작 시간 <span className="optional">(선택)</span></span>
          <input className="field-input" type="time" value={startTime}
            onChange={e => { setStartTime(e.target.value); setTimeError(null); }} />
        </label>
        <label className="field">
          <span className="field-label">종료 시간 <span className="optional">(선택)</span></span>
          <input className="field-input" type="time" value={endTime}
            onChange={e => { setEndTime(e.target.value); setTimeError(null); }} />
        </label>
      </div>

      {timeError && <p className="field-error" role="alert">{timeError}</p>}

      {/* 복습 필요 */}
      <label className="review-toggle">
        <input type="checkbox" checked={needsReview} onChange={e => setNeedsReview(e.target.checked)} />
        <span className="review-toggle-label">
          복습 필요
          <span className="review-toggle-hint"> — 완료 시 망각곡선 일정 자동 생성 (1·3·7·16·30일)</span>
        </span>
      </label>

      {/* 진행률 (수정 시에만 표시) */}
      {isEditing && (
        <div className="field">
          <label className="field-label" htmlFor="todo-form-progress">진행률: <strong>{progress}%</strong></label>
          <input id="todo-form-progress" type="range" min="0" max="100" step="5" value={progress}
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
