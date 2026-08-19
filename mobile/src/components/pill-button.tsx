import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/constants/tokens';

/**
 * 알약 버튼. 웹 `.pill-btn.sm`과 같은 모양이다 — 테두리만 있는 강조색 버튼이고,
 * **완료든 등록이든 색으로 구분하지 않는다**(웹 App.css에 그렇게 적혀 있다).
 *
 * 높이 36은 웹과 맞춘 값이라 44보다 낮다. 보이는 크기는 그대로 두고
 * hitSlop으로 누를 자리만 넓힌다.
 */
export function PillButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  pressed: { backgroundColor: colors.accentSoft },
  text: { fontSize: 12.5, fontWeight: '600', color: colors.accent },
});
