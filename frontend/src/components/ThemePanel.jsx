import { useEffect, useLayoutEffect, useState } from 'react';
import './ThemePanel.css';

/**
 * 개발 모드 전용 화면 조정 패널.
 *
 * 여기서 만지는 값은 전부 App.css 맨 위 :root의 디자인 토큰이다.
 * 슬라이더·색상 선택기를 움직이면 :root에 인라인 스타일로 바로 얹혀서 화면이 즉시 바뀌고,
 * "확정"을 누르면 개발 서버가 App.css의 해당 값을 실제로 고쳐 쓴다(vite.config.js의 themeWriter).
 *
 * 운영 빌드에는 들어가지 않는다 — App.jsx가 import.meta.env.DEV일 때만 그린다.
 */

const STORAGE_KEY = 'study-todo:theme-draft';

const COLOR_GROUPS = [
  {
    legend: '기본',
    rows: [
      { name: '--accent', label: '강조' },
      { name: '--bg',     label: '바탕' },
      { name: '--card',   label: '카드' },
      { name: '--text',   label: '글자' },
      { name: '--muted',  label: '흐린 글자' },
      { name: '--line',   label: '테두리' },
    ],
  },
  {
    legend: '의미색',
    rows: [
      { name: '--danger', label: '지남·마감' },
      { name: '--warn',   label: '오늘·주의' },
    ],
  },
  {
    legend: '중요도',
    rows: [
      { name: '--imp-1', label: '낮음' },
      { name: '--imp-2', label: '중간' },
      { name: '--imp-3', label: '높음' },
    ],
  },
];

const NUMBER_ROWS = [
  { name: '--radius',      label: '모서리',    min: 0,  max: 28, step: 1,   unit: 'px' },
  { name: '--radius-sm',   label: '작은 모서리', min: 0,  max: 20, step: 1,   unit: 'px' },
  { name: '--space-scale', label: '간격 배율',  min: .7, max: 1.6, step: .05, unit: ''   },
  { name: '--type-scale',  label: '글자 배율',  min: .8, max: 1.4, step: .02, unit: ''   },
];

const COLOR_NAMES  = COLOR_GROUPS.flatMap(g => g.rows.map(r => r.name));
const NUMBER_NAMES = NUMBER_ROWS.map(r => r.name);
const ALL_NAMES    = [...COLOR_NAMES, ...NUMBER_NAMES];

/** :root에 얹힌 인라인 값을 걷어내고 App.css에 적힌 원래 값을 읽는다. */
function readDefaults() {
  const root = document.documentElement;
  const saved = ALL_NAMES.map(name => [name, root.style.getPropertyValue(name)]);
  ALL_NAMES.forEach(name => root.style.removeProperty(name));

  const computed = getComputedStyle(root);
  const defaults = {};
  ALL_NAMES.forEach(name => { defaults[name] = computed.getPropertyValue(name).trim(); });

  saved.forEach(([name, value]) => { if (value) root.style.setProperty(name, value); });
  return defaults;
}

const applyToken = (name, value) =>
  document.documentElement.style.setProperty(name, value);

const numeric = (value) => parseFloat(value) || 0;

export default function ThemePanel() {
  const [open, setOpen]         = useState(false);
  const [defaults, setDefaults] = useState(null);
  const [values, setValues]     = useState({});
  const [toast, setToast]       = useState(null);

  // 새로고침해도 조정하던 값이 남아 있도록 — 아직 확정하지 않은 초안이다
  useLayoutEffect(() => {
    const base = readDefaults();
    setDefaults(base);

    let draft = {};
    try {
      draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      draft = {};
    }

    const next = { ...base };
    Object.entries(draft).forEach(([name, value]) => {
      if (!ALL_NAMES.includes(name)) return;
      next[name] = value;
      applyToken(name, value);
    });
    setValues(next);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  if (!defaults) return null;

  const changed = ALL_NAMES.filter(name => values[name] !== defaults[name]);

  function update(name, value) {
    applyToken(name, value);
    const next = { ...values, [name]: value };
    setValues(next);

    const draft = {};
    ALL_NAMES.forEach(n => { if (next[n] !== defaults[n]) draft[n] = next[n]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }

  function reset() {
    ALL_NAMES.forEach(name => document.documentElement.style.removeProperty(name));
    localStorage.removeItem(STORAGE_KEY);
    setValues({ ...defaults });
    setToast('App.css의 값으로 되돌렸습니다');
  }

  function cssText() {
    if (changed.length === 0) return '';
    return `:root {\n${changed.map(n => `  ${n}: ${values[n]};`).join('\n')}\n}`;
  }

  async function copyCss() {
    const text = cssText();
    if (!text) { setToast('바뀐 값이 없습니다'); return; }
    try {
      await navigator.clipboard.writeText(text);
      setToast('CSS를 복사했습니다');
    } catch {
      // 클립보드 권한이 없을 때를 대비해 콘솔로도 남긴다
      console.log(text);
      setToast('클립보드를 못 써서 콘솔에 출력했습니다');
    }
  }

  /** 개발 서버에 부탁해 App.css를 실제로 고친다. */
  async function commit() {
    if (changed.length === 0) { setToast('바뀐 값이 없습니다'); return; }

    const tokens = {};
    changed.forEach(n => { tokens[n] = values[n]; });

    try {
      const res = await fetch('/__theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `${res.status}`);

      // App.css가 바뀌면 Vite가 새 CSS를 밀어넣는다. 인라인 덮어쓰기를 걷어내야
      // 파일에 적힌 값이 화면에 보인다.
      ALL_NAMES.forEach(name => document.documentElement.style.removeProperty(name));
      localStorage.removeItem(STORAGE_KEY);
      setDefaults({ ...values });
      setToast(`App.css에 ${body.written ?? changed.length}개 값을 적었습니다`);
    } catch (e) {
      setToast(`App.css를 못 고쳤습니다: ${e.message}`);
    }
  }

  if (!open) {
    return (
      <button type="button" className="theme-fab" aria-label="화면 조정 열기"
              onClick={() => setOpen(true)}>
        ◑
      </button>
    );
  }

  return (
    <>
      <aside className="theme-panel" aria-label="화면 조정">
        <div className="theme-panel-head">
          <h2>화면 조정</h2>
          <span className="spacer" />
          <button type="button" className="theme-panel-close" aria-label="닫기"
                  onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="theme-panel-body">
          {COLOR_GROUPS.map(group => (
            <fieldset className="theme-fieldset" key={group.legend}>
              <legend>{group.legend}</legend>
              {group.rows.map(({ name, label }) => (
                <div className="theme-row" key={name}>
                  <label htmlFor={`theme${name}`}>{label}</label>
                  <input
                    id={`theme${name}`}
                    type="color"
                    value={values[name] || '#000000'}
                    onChange={e => update(name, e.target.value)}
                  />
                  <output>{values[name]}</output>
                </div>
              ))}
            </fieldset>
          ))}

          <fieldset className="theme-fieldset">
            <legend>모양과 크기</legend>
            {NUMBER_ROWS.map(({ name, label, min, max, step, unit }) => (
              <div className="theme-row" key={name}>
                <label htmlFor={`theme${name}`}>{label}</label>
                <input
                  id={`theme${name}`}
                  type="range"
                  min={min} max={max} step={step}
                  value={numeric(values[name])}
                  onChange={e => update(name, `${e.target.value}${unit}`)}
                />
                <output>{values[name]}</output>
              </div>
            ))}
          </fieldset>

          <p style={{ fontSize: '.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            간격·글자는 화면 폭에 따라 기준값이 달라지므로 배율로 조정합니다.
            그래서 여기서 키운 값은 폰·태블릿·데스크탑에 모두 같이 반영됩니다.
          </p>
        </div>

        <div className="theme-panel-foot">
          <button type="button" onClick={reset}>되돌리기</button>
          <button type="button" onClick={copyCss}>CSS 복사</button>
          <button type="button" className="primary" onClick={commit}>
            확정{changed.length > 0 ? ` (${changed.length})` : ''}
          </button>
        </div>
      </aside>

      {toast && <div className="theme-toast" role="status">{toast}</div>}
    </>
  );
}
