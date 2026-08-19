import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { formatKoreanDate, localToday } from '@shared/dates.js';
import { Field, inputBox } from './field';
import { colors, fontFamily, INPUT_FONT_SIZE, radius, TAP } from '@/constants/tokens';

/**
 * 날짜·시각 입력 (아이폰·안드로이드).
 *
 * 브라우저에서는 이 파일이 아니라 `datetime-field.web.tsx`가 쓰인다 —
 * Metro가 웹으로 묶을 때 `.web.tsx`를 먼저 고른다. 그래서 웹 번들에는
 * `@react-native-community/datetimepicker`가 아예 들어가지 않는다(웹 지원이 없다).
 * 저장소를 갈랐던 `lib/session.ts`와 같은 방식이다: 플랫폼이 더 잘하는 것을 쓰고
 * 경계를 한 곳에 모은다.
 *
 * 서버가 주고받는 값은 날짜 `'YYYY-MM-DD'`, 시각 `'HH:MM'` 문자열이다.
 */

const isIOS = Platform.OS === 'ios';

/** `'2026-08-19'` → 로컬 자정의 Date. `new Date('2026-08-19')`는 UTC라 하루 밀린다. */
function parseDate(value: string | null): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** `'09:30'` → 오늘 그 시각의 Date. 날짜 부분은 쓰지 않는다. */
function parseTime(value: string | null): Date {
  const now = new Date();
  if (!value) return now;
  const [h, min] = value.split(':').map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
}

function toHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Props = {
  label: string;
  optional?: string;
  value: string | null;
  onChange: (next: string | null) => void;
};

export function DateField({ label, optional, value, onChange }: Props) {
  return (
    <PickerField
      label={label}
      optional={optional}
      value={value}
      onChange={onChange}
      mode="date"
      display={value ? formatKoreanDate(value) : '선택 안 함'}
      toDate={parseDate}
      fromDate={localToday}
    />
  );
}

export function TimeField({ label, optional, value, onChange }: Props) {
  return (
    <PickerField
      label={label}
      optional={optional}
      value={value}
      onChange={onChange}
      mode="time"
      display={value ?? '선택 안 함'}
      toDate={parseTime}
      fromDate={toHM}
    />
  );
}

/**
 * 두 플랫폼의 선택기 동작이 달라서 한 곳에 모아 둔다.
 *
 *   안드로이드 — 시스템 대화상자가 뜨고 **고르는 순간 스스로 닫힌다.**
 *   iOS        — 선택기를 화면에 얹기만 하고 닫지 않는다. 시트로 감싸 확인 버튼을 준다.
 *
 * iOS에서 고른 값을 바로 반영하지 않고 임시로 들고 있다가 "완료"에서 넘기는 이유도
 * 이것이다 — 휠을 굴리는 동안 값이 계속 바뀌면 취소할 수가 없다.
 */
function PickerField({ label, optional, value, onChange, mode, display, toDate, fromDate }: Props & {
  mode: 'date' | 'time';
  display: string;
  toDate: (v: string | null) => Date;
  fromDate: (d: Date) => string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);

  function start() {
    setDraft(toDate(value));
    setOpen(true);
  }

  function onPick(event: DateTimePickerEvent, picked?: Date) {
    if (isIOS) {
      if (picked) setDraft(picked);
      return;
    }
    setOpen(false);
    if (event.type === 'set' && picked) onChange(fromDate(picked));
  }

  const picker = (
    <DateTimePicker
      value={draft ?? toDate(value)}
      mode={mode}
      display={isIOS ? 'spinner' : 'default'}
      onChange={onPick}
    />
  );

  return (
    <Field label={label} optional={optional} onClear={value ? () => onChange(null) : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
        style={({ pressed }) => [styles.box, pressed && styles.pressed]}
        onPress={start}
      >
        <Text style={value ? styles.value : styles.placeholder}>{display}</Text>
      </Pressable>

      {open && !isIOS && picker}

      {isIOS && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            {picker}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                onPress={() => setOpen(false)}
              >
                <Text style={styles.actionGhost}>취소</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && styles.pressed]}
                onPress={() => {
                  setOpen(false);
                  if (draft) onChange(fromDate(draft));
                }}
              >
                <Text style={styles.actionPrimaryText}>완료</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </Field>
  );
}

const styles = StyleSheet.create({
  box: inputBox,
  value: { fontFamily: fontFamily.body, fontSize: INPUT_FONT_SIZE, color: colors.text },
  placeholder: { fontFamily: fontFamily.body, fontSize: INPUT_FONT_SIZE, color: colors.muted },
  pressed: { opacity: 0.6 },

  scrim: { flex: 1, backgroundColor: 'rgba(35,41,31,0.42)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    padding: 16,
    gap: 10,
  },
  actions: { flexDirection: 'row', gap: 10 },
  action: {
    flex: 1,
    minHeight: TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionGhost: { fontFamily: fontFamily.body, fontSize: 15, fontWeight: '600', color: colors.muted },
  actionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionPrimaryText: { fontFamily: fontFamily.body, fontSize: 15, fontWeight: '600', color: colors.onAccent },
});
