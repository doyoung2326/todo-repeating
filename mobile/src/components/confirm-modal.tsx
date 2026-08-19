import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, TAP } from '@/constants/tokens';

/**
 * 예·아니오만 묻는 확인 창.
 *
 * **`Alert.alert`을 쓰지 않는다** — react-native-web의 `Alert`는 본문이 빈 함수라
 * 웹에서는 창이 뜨지 않고, 확인을 기다리던 동작이 영영 일어나지 않는다.
 * 앱에서는 멀쩡히 뜨므로 웹으로 개발하는 동안에만 드러나는 차이다.
 * (같은 이유로 `Alert.prompt`도 쓰지 않는다 — 그쪽은 iOS 전용이다.)
 *
 * 값을 받아야 하는 창은 여기에 얹지 않고 DeleteAccountModal처럼 따로 만든다.
 */
export function ConfirmModal({
  visible, title, message, confirmLabel, tone = 'normal', onConfirm, onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'normal' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
}) {
  // 창을 먼저 닫는다. 확인이 화면을 갈아끼우는 동작(로그아웃 등)일 때
  // 사라지는 트리 위에서 닫기를 부르지 않게 된다.
  function confirm() {
    onClose();
    onConfirm();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}   // 안드로이드 뒤로가기
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.btn,
                tone === 'danger' ? styles.btnDanger : styles.btnAccent,
                pressed && styles.pressed,
              ]}
              onPress={confirm}
            >
              <Text style={styles.btnFilledText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(35,41,31,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 20,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  desc: { fontSize: 14, color: colors.muted, lineHeight: 21 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: {
    flex: 1,
    minHeight: TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  pressed: { opacity: 0.6 },
  btnGhost: { borderWidth: 1, borderColor: colors.line },
  btnGhostText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  btnAccent: { backgroundColor: colors.accent },
  btnDanger: { backgroundColor: colors.danger },
  btnFilledText: { fontSize: 15, fontWeight: '600', color: colors.onAccent },
});
