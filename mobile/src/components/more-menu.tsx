import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, TAP } from '@/constants/tokens';

/**
 * 항목 오른쪽의 ⋯ 메뉴. 좁은 화면에서 아이콘 버튼 여러 개 대신 쓴다 —
 * 손가락으로 누르기엔 버튼 셋이 한 줄에 붙어 있으면 오조작이 난다(웹과 같은 판단).
 *
 * 웹은 절대 위치로 버튼 아래에 붙이지만, 앱에는 그런 겹침이 없어 **Modal**로 띄우고
 * 버튼 자리를 재서 그 옆에 놓는다. 아래로 펼칠 자리가 모자라면 위로 뒤집는다 —
 * 목록 아래쪽 항목에서 열면 메뉴가 화면 밖으로 잘린다.
 */
const MENU_W = 144;
const MENU_ROOM = 140;

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean };

export function MoreMenu({ label = '더보기', items }: { label?: string; items: MenuItem[] }) {
  const ref = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  function open() {
    // 자리를 먼저 재고 연다. 열고 나서 재면 한 프레임 동안 엉뚱한 곳에 그려진다.
    ref.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  }

  const win = Dimensions.get('window');
  const dropUp = anchor ? win.height - (anchor.y + anchor.h) < MENU_ROOM : false;

  return (
    <View ref={ref} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        onPress={open}
      >
        <Text style={styles.triggerText}>⋯</Text>
      </Pressable>

      <Modal visible={!!anchor} transparent animationType="fade" onRequestClose={() => setAnchor(null)}>
        {/* 바깥을 누르면 닫힌다. 안드로이드 뒤로가기는 onRequestClose가 받는다. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} />

        {anchor && (
          <View
            style={[
              styles.menu,
              { right: Math.max(8, win.width - (anchor.x + anchor.w)) },
              dropUp
                ? { bottom: win.height - anchor.y + 2 }
                : { top: anchor.y + anchor.h - 2 },
            ]}
          >
            {items.map(item => (
              <Pressable
                key={item.label}
                accessibilityRole="menuitem"
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                onPress={() => { setAnchor(null); item.onSelect(); }}
              >
                <Text style={[styles.itemText, item.danger && styles.itemTextDanger]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: TAP,
    height: TAP,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerPressed: { backgroundColor: colors.lineSoft },
  triggerText: { fontSize: 19, letterSpacing: 1.5, color: colors.muted, lineHeight: 22 },

  menu: {
    position: 'absolute',
    minWidth: MENU_W,
    padding: 5,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    // 그림자는 두 플랫폼이 서로 다른 속성을 본다. 둘 다 적어야 양쪽에 뜬다.
    elevation: 6,
    shadowColor: '#2b322d',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  item: {
    minHeight: TAP,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  itemPressed: { backgroundColor: colors.lineSoft },
  itemText: { fontSize: fontSize.title - 1, color: colors.text },
  itemTextDanger: { color: colors.danger, fontWeight: '600' },
});
