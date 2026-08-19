import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily, INPUT_FONT_SIZE, radius, TAP, WEIGHT_SEMI } from '@/constants/tokens';

/**
 * 폼의 입력칸 한 칸. 웹 `.field` + `.field-label`이다.
 *
 * 웹은 `<label>`로 칸을 감싸 낭독기에 이름을 붙이지만 RN에는 그런 연결이 없다.
 * 대신 칸마다 `accessibilityLabel`을 직접 준다 — 이름 없는 칸은 낭독기에서
 * "편집 상자"로만 읽힌다.
 *
 * 날짜·시각처럼 **비울 수 있는 칸**에는 지우기를 준다. 웹은 브라우저가 그 자리를
 * 만들어 주지만 앱에는 없어서, 한 번 고르면 되돌릴 방법이 사라진다.
 */
export function Field({ label, optional, onClear, children }: {
  label: string;
  /** 괄호로 덧붙일 말. 예: '선택', '언제까지' */
  optional?: string;
  onClear?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {optional ? <Text style={styles.optional}> ({optional})</Text> : null}
        </Text>
        {onClear && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} 지우기`}
            hitSlop={10}
            onPress={onClear}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.clear}>지우기</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

/** 두 칸을 나란히. 좁으면 알아서 쌓이도록 최소 너비를 준다(웹 `.field-row`와 같은 뜻). */
export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

/** 저장을 막은 이유. 웹 `.field-error`. */
export function FieldError({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

/**
 * 입력칸의 테두리·여백. TextInput과 "눌러서 고르는 칸"이 같은 모양이어야 해서
 * 스타일만 따로 내보낸다(웹의 `.field-input`).
 */
export const inputBox = {
  minHeight: TAP,
  justifyContent: 'center' as const,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.sm,
  backgroundColor: colors.card,
  // 16px 미만이면 iOS가 입력할 때 화면을 확대한다.
  fontSize: INPUT_FONT_SIZE,
  fontFamily: fontFamily.body,
  color: colors.text,
};

const styles = StyleSheet.create({
  field: { flex: 1, minWidth: 150, gap: 5 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontFamily: fontFamily.body, fontSize: 13, fontWeight: WEIGHT_SEMI, color: colors.muted },
  optional: { fontWeight: '400', opacity: 0.8 },
  clear: { fontFamily: fontFamily.body, fontSize: 12, fontWeight: '600', color: colors.muted },
  pressed: { opacity: 0.5 },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  error: {
    padding: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 13,
    fontFamily: fontFamily.body,
    fontWeight: '600',
  },
});
