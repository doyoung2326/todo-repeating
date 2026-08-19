import { useState, useRef } from 'react';
import MoreMenu from './MoreMenu';
import { CAT_SLOTS, CAT_COLORS, CAT_BG, CAT_FG, CAT_COLOR_LABELS } from '../theme';

/**
 * 할 일 성격 관리. 계정 메뉴에서 열리고 BottomSheet 안에 들어간다.
 * (role="dialog"는 시트가 씌워 주므로 여기서 또 붙이지 않는다)
 *
 * 목록 아래에 폼 하나를 두고 추가와 수정이 그 폼을 같이 쓴다. 줄마다 펼치는 편집은
 * 두지 않았다 — 색 고르는 칸이 여덟 개 × 44px이라 폰에서는 이름 옆에 못 들어가고
 * 어차피 줄 아래로 내려가는데, 그러면 폼을 더 나쁜 자리에 항목 수만큼 그린 셈이 된다.
 *
 * 이름이 겹쳤다는 판단은 서버만 한다. 여기서 한 번 더 검사하면 규칙이 두 곳이 된다.
 */
/* 개수와 이름 길이의 진짜 기준은 서버(backend/lib/categories.js의 MAX_CATEGORIES,
   MAX_NAME_LENGTH)다. 여기 값은 서버까지 갔다 오지 않고 먼저 막아 주는 사본이라,
   서버 쪽을 바꾸면 여기도 같이 고친다. 어긋나도 서버가 400으로 막고 그 말이 폼에 뜬다. */
const MAX_CATEGORIES = 12;
const MAX_NAME_LENGTH = 12;

export default function CategoryManager({
  categories, max = MAX_CATEGORIES, onCreate, onUpdate, onDelete,
}) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName]   = useState('');
  const [color, setColor] = useState(1);
  const [error, setError] = useState(null);
  const [busy, setBusy]   = useState(false);
  // 보내는 사이에 대상이 바뀌었는지 보려고 든다. 상태와 달리 즉시 읽힌다.
  const editingIdRef = useRef(null);

  // 고치던 성격이 목록에서 사라졌다면(방금 지웠다면) 추가하는 폼으로 돌아간다.
  // editingId만 믿으면 없는 것을 계속 고치다가 저장할 때 서버의 영어 404 문구가 뜬다.
  const editingTarget = editingId === null
    ? null
    : categories.find(c => c.id === editingId) ?? null;
  const isEditing = editingTarget !== null;
  const isFull = !isEditing && categories.length >= max;

  const resetForm = () => {
    setEditingId(null); editingIdRef.current = null;
    setName(''); setColor(1); setError(null);
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    editingIdRef.current = category.id;
    setName(category.name);
    setColor(category.color);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError('성격 이름을 입력해 주세요.');
      return;
    }

    setBusy(true);
    setError(null);
    const sentFor = isEditing ? editingId : null;
    try {
      const data = { name: name.trim(), color };
      if (isEditing) await onUpdate(editingId, data);
      else await onCreate(data);

      // 보내는 동안 사용자가 취소하고 다른 성격을 고치기 시작했을 수 있다.
      // 그때 비우면 방금 적던 것이 이유 없이 날아간다.
      if (editingIdRef.current === sentFor) resetForm();
    } catch (err) {
      // 이름이 겹쳤다(409)처럼 고칠 수 있는 말은 폼 안에 붙어 있어야 한다
      if (editingIdRef.current === sentFor) setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-card">
      <h2 className="form-title">성격 관리</h2>

      {categories.length === 0 ? (
        <p className="notify-desc">아직 만든 성격이 없습니다. 아래에서 하나 추가해 보세요.</p>
      ) : (
        <div className="cat-list">
          {categories.map(category => (
            <div className="cat-row" key={category.id}>
              <span
                className="cat-tag"
                style={{ background: CAT_BG[category.color], color: CAT_FG[category.color] }}
              >
                {category.name}
              </span>
              {/* 넓은 화면에서도 ⋯로 둔다 — 이 시트는 어느 폭에서나 좁다 */}
              <MoreMenu
                label={`${category.name} 성격 메뉴`}
                items={[
                  { label: '수정', onSelect: () => startEdit(category) },
                  { label: '삭제', danger: true, onSelect: () => onDelete(category.id) },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">{isEditing ? '이름 수정' : '새 성격 이름'}</span>
          <input
            className="field-input" type="text" maxLength={MAX_NAME_LENGTH} value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            placeholder="예: 영어, 과제, 시험"
            disabled={isFull}
          />
        </label>

        {/* 여덟 칸 중 하나를 고르는 것이라 role은 radiogroup이다.
            (중요도는 짧은 글자가 있는 버튼 묶음이라 group + aria-pressed를 쓴다)

            엄밀한 radiogroup은 화살표로 옮겨 다니는 roving tabindex까지 요구하지만,
            여기서는 여덟 개를 모두 탭으로 지날 수 있게 두고 화살표는 만들지 않았다.
            반만 구현한 roving tabindex는 아무것도 안 한 것보다 나쁘다. */}
        <div className="field" role="radiogroup" aria-labelledby="category-form-color">
          <span className="field-label" id="category-form-color">색</span>
          <div className="cat-swatches">
            {CAT_SLOTS.map(n => (
              <button
                key={n} type="button"
                className={`cat-swatch${color === n ? ' active' : ''}`}
                style={{ background: CAT_COLORS[n] }}
                role="radio" aria-checked={color === n}
                // 색은 낭독기에 보이지 않고 색각 이상에도 모호하다. 이름을 같이 싣는다.
                aria-label={`색 ${n}번 ${CAT_COLOR_LABELS[n]}`}
                disabled={isFull}
                onClick={() => setColor(n)}
              />
            ))}
          </div>
        </div>

        {error && <p className="field-error" role="alert">{error}</p>}

        {isFull && (
          <p className="notify-desc">
            성격은 최대 {max}개까지 만들 수 있습니다. 새로 만들려면 쓰지 않는 성격을 먼저 지워 주세요.
          </p>
        )}

        <div className="form-actions">
          {isEditing && (
            <button type="button" className="btn btn-ghost" onClick={resetForm}>취소</button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || isFull}>
            {isEditing ? '수정 완료' : '추가하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
