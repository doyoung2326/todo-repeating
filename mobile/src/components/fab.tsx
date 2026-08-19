import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet } from 'react-native';

import { useTabBarSpace } from './tab-bar';
import { colors } from '@/constants/tokens';

/**
 * 할 일 추가 버튼. 웹 `.fab`과 같이 화면 오른쪽 아래에 떠 있다.
 *
 * 탭바가 **떠 있으므로** 그 위로 올려야 한다. 좌우로 나란히 두면 좁은 폰에서 겹치므로
 * 웹처럼 탭바 바로 위에 둔다 — 높이 계산은 useTabBarSpace가 한 곳에서 쥔다.
 * 이모지 대신 선 아이콘을 쓴다(화면 규칙).
 */
export function Fab({ onPress }: { onPress: () => void }) {
  const { total } = useTabBarSpace();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="할 일 추가"
      style={({ pressed }) => [styles.fab, { bottom: total }, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Feather name="plus" size={26} color={colors.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    // 그림자는 두 플랫폼이 서로 다른 속성을 본다. 둘 다 적어야 양쪽에 뜬다.
    elevation: 6,
    shadowColor: '#2b322d',
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
