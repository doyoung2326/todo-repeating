import { useState } from 'react';

export default function ProgressCheckModal({ items, onSave, onClose }) {
  const [index, setIndex]       = useState(0);
  const [progress, setProgress] = useState(0);

  const current = items[index];
  const isLast  = index === items.length - 1;

  const advance = () => {
    if (isLast) onClose();
    else { setIndex(i => i + 1); setProgress(0); }
  };

  const handleSave = () => { onSave(current.id, progress); advance(); };
  const handleSkip = () => advance();

  const pct = progress;
  const barColor = pct < 30 ? '#ef4444' : pct < 70 ? '#f59e0b' : '#10b981';

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-head">
          <h2 className="modal-title">📊 진행률 확인</h2>
          {items.length > 1 && (
            <span className="modal-counter">{index + 1} / {items.length}</span>
          )}
        </div>

        <p className="modal-desc">
          수행 예정이었던 항목의 진행률을 입력해주세요.
        </p>

        <div className="modal-perform-date">📅 수행날짜: <strong>{current.perform_date}</strong></div>
        <div className="modal-item-text">{current.text}</div>

        <div className="slider-wrap">
          <div className="slider-value-row">
            <span className="slider-value" style={{ color: barColor }}>{pct}%</span>
            {pct === 100 && <span className="auto-complete-hint">✅ 자동 완료 처리됩니다</span>}
          </div>
          <input
            type="range" min="0" max="100" step="5"
            value={pct}
            onChange={e => setProgress(Number(e.target.value))}
            className="progress-slider"
          />
          <div className="slider-track-preview">
            <div className="slider-fill-preview" style={{ width: `${pct}%`, background: barColor }} />
          </div>
          <div className="slider-edge-labels">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={handleSkip}>건너뛰기</button>
          <button className="btn btn-primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
