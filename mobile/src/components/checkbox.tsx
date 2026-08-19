import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, TAP } from '@/constants/tokens';

/**
 * 완료 체크박스. React Native에는 기본 체크박스가 없어 직접 그린다.
 *
 * 보이는 크기는 웹(1.35rem ≈ 22px)과 같게 두고, **누를 수 있는 자리만**
 * hitSlop으로 44px까지 넓힌다 — 보이는 것을 44px로 키우면 항목 줄이 웹과 달라진다.
 */
const BOX = 22;

export function Checkbox({ checked, onChange, label }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 낭독기가 읽을 이름. 체크박스만으로는 무엇의 완료인지 알 수 없다. */
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={(TAP - BOX) / 2}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Feather name="check" size={15} color={colors.onAccent} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: BOX,
    height: BOX,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.6 },
});
