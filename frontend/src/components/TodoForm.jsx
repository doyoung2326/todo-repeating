import { useState, useEffect } from 'react';
import { IMP_LABELS } from '../theme';

// categories: 배열이면 "이것이 전부", null/undefined면 "아직 모른다".
// 이 둘을 뭉뚱그리면 조회에 실패했을 때 멀쩡한 성격을 지운다(아래 knowsCategories).
export default function TodoForm({ onSubmit, initialValues, onCancel, categories = [] }) {
  const [text,        setText]       = useState('');
  const [importance,  setImportance] = useState(1);
  // <select>의 값은 문자열이다. ''가 "성격 없음".
  const [categoryId,  setCategoryId] = useState('');
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
      setCategoryId(String(initialValues.category_id ?? ''));
      setDeadline(initialValues.deadline || '');
      setPerformDate(initialValues.perform_date || '');
      setNeedsReview(!!initialValues.needs_review);
      setStartTime(initialValues.start_time || '');
      setEndTime(initialValues.end_time || '');
      setProgress(initialValues.progress ?? 0);
    } else {
      setText(''); setImportance(1); setCategoryId(''); setDeadline(''); setPerformDate('');
      setNeedsReview(false); setStartTime(''); setEndTime(''); setProgress(0);
    }
    setTimeError(null);
  }, [initialValues]);

  const knowsCategories = Array.isArray(categories);
  const categoryList = knowsCategories ? categories : [];

  // 목록에 없는 성격을 가리키고 있으면(방금 지웠다면) 고르지 않은 것으로 본다.
  // 그대로 보내면 서버가 "알 수 없는 성격"이라며 거절한다.
  // 성격 목록이 할 일보다 늦게 도착해도 맞도록, 저장해 둔 값이 아니라 그릴 때 따진다.
  const selectedCategoryId =
    categoryList.some(c => String(c.id) === categoryId) ? categoryId : '';

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
      // 성격을 아는 경우에만 넣는다. 추가·수정 양쪽 모두 넣어야 한다 —
      // 수정에서 빼면 서버의 가드 때문에 값이 남아 성격을 해제할 수가 없다.
      //
      // 모를 때 아예 빼는 것이 핵심이다. 서버는 이 필드가 없으면 있던 성격을
      // 그대로 두므로(app.js의 `category_id !== undefined`), 성격 목록을 못 받아온
      // 화면에서 할 일을 고쳐도 붙어 있던 성격이 살아남는다.
      ...(knowsCategories ? { category_id: selectedCategoryId || null } : {}),
      deadline:     deadline     || null,
      perform_date: performDate  || null,
      needs_review: needsReview,
      start_time:   startTime    || null,
      end_time:     endTime      || null,
      ...(initialValues ? { progress } : {}),
    });
    if (!initialValues) {
      setText(''); setImportance(1); setCategoryId(''); setDeadline(''); setPerformDate('');
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

      {/* 성격 — 중요도와 달리 버튼 묶음이 아니라 <select>다.
          중요도는 짧은 라벨 세 개로 고정이지만 성격은 사용자가 열둘까지 만들 수 있어서,
          버튼으로 깔면 폰 시트를 통째로 먹는다. iOS는 <select>를 시스템 휠로 띄운다. */}
      {categoryList.length > 0 && (
        <label className="field">
          <span className="field-label">성격 <span className="optional">(선택)</span></span>
          <select className="field-input" value={selectedCategoryId}
            onChange={e => setCategoryId(e.target.value)}>
            <option value="">성격 없음</option>
            {categoryList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}

      {/* 고를 것이 "성격 없음" 하나뿐인 칸은 고장으로 읽히므로 안내로 바꾼다.
          안내가 이 기능이 어디 있는지도 알려준다.
          목록을 아직 모를 때는 이 말도 하지 않는다 — 없는지 못 받아온 것인지 모르면서
          "만들지 않았다"고 하면 거짓말이 된다. */}
      {knowsCategories && categoryList.length === 0 && (
        <p className="notify-desc">
          성격을 아직 만들지 않았습니다. 계정 메뉴의 &ldquo;성격 관리&rdquo;에서 추가할 수 있습니다.
        </p>
      )}

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
