import { Field } from './field';
import { colors, INPUT_FONT_SIZE, radius, TAP } from '@/constants/tokens';

/**
 * 날짜·시각 입력 (브라우저).
 *
 * Metro는 웹으로 묶을 때 `.web.tsx`를 먼저 고르므로, 이 파일이 같은 이름의
 * `datetime-field.tsx`를 대신한다. 라이브러리(`@react-native-community/datetimepicker`)는
 * 웹을 지원하지 않아 웹 번들에는 아예 들어가지 않는다.
 *
 * 여기서는 **브라우저의 `<input type=date|time>`을 그대로 쓴다.** react-native-web은
 * DOM으로 그려지므로 이렇게 섞어 쓸 수 있고, 달력·시계는 브라우저가 이미 잘 만들어 둔
 * 것이 있다. 웹(frontend)의 폼도 같은 것을 쓴다.
 *
 * 값의 모양은 네이티브 쪽과 같다 — 날짜 'YYYY-MM-DD', 시각 'HH:MM'.
 */

type Props = {
  label: string;
  optional?: string;
  value: string | null;
  onChange: (next: string | null) => void;
};

/** 앱의 입력칸과 같은 모양. StyleSheet가 아니라 CSS라서 값을 직접 적는다. */
const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: TAP,
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: `1px solid ${colors.line}`,
  borderRadius: radius.sm,
  backgroundColor: colors.card,
  color: colors.text,
  // 16px 미만이면 iOS Safari가 입력할 때 화면을 확대한다.
  fontSize: INPUT_FONT_SIZE,
  fontFamily: 'inherit',
  // 기본 모양을 끄지 않으면 날짜 칸이 제 최소 너비를 고집해 폼 밖으로 삐져나간다.
  WebkitAppearance: 'none',
  appearance: 'none',
};

function NativeInput({ type, label, optional, value, onChange }: Props & { type: 'date' | 'time' }) {
  return (
    <Field label={label} optional={optional} onClear={value ? () => onChange(null) : undefined}>
      <input
        type={type}
        value={value ?? ''}
        aria-label={label}
        onChange={e => onChange(e.target.value || null)}
        style={inputStyle}
      />
    </Field>
  );
}

export function DateField(props: Props) {
  return <NativeInput type="date" {...props} />;
}

export function TimeField(props: Props) {
  return <NativeInput type="time" {...props} />;
}
