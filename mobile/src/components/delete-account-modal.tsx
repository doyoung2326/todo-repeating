import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { colors, fontFamily, INPUT_FONT_SIZE, radius, TAP } from '@/constants/tokens';

/**
 * 회원 탈퇴 확인 창.
 *
 * `Alert`로 처리하지 않는다 — 비밀번호를 받아야 하는데 `Alert.prompt`는 iOS에만 있다.
 * 성공하면 부른 쪽이 곧바로 로그아웃시키므로 여기에 "완료" 화면은 없다.
 * onSubmit이 던진 메시지는 창 안에 남겨 두고 닫지 않는다.
 */
export function DeleteAccountModal({ visible, onSubmit, onClose }: {
  visible: boolean;
  onSubmit: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setPassword('');
    setError(null);
    onClose();
  }

  async function submit() {
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof TypeError ? '서버에 연결할 수 없습니다.' : (err as Error).message);
      setBusy(false);
    }
    // 성공하면 잠금을 풀지 않는다 — 화면이 사라지는 중에 다시 누를 이유가 없다.
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}   // 안드로이드 뒤로가기
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>회원 탈퇴</Text>

          <Text style={styles.desc}>
            계정과 함께 할 일·복습 기록·알림 설정이 모두 삭제됩니다.
            삭제한 뒤에는 되돌릴 수 없습니다.
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}

          {/* 웹은 <label>로 감싸지만 RN에는 그런 연결이 없다. 낭독기에는
              accessibilityLabel이 대신 무슨 칸인지 알려준다. */}
          <Text style={styles.label}>비밀번호 확인</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            accessibilityLabel="비밀번호 확인"
            editable={!busy}
            onSubmitEditing={() => { void submit(); }}
            returnKeyType="done"
          />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
              onPress={close}
              disabled={busy}
            >
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, styles.btnDanger, (busy || pressed) && styles.pressed]}
              onPress={() => { void submit(); }}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator color={colors.onAccent} />
                : <Text style={styles.btnDangerText}>탈퇴하기</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  title: { fontFamily: fontFamily.display, fontSize: 18, color: colors.text },
  desc: { fontFamily: fontFamily.body, fontSize: 14, color: colors.muted, lineHeight: 21 },
  error: {
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 13,
    fontFamily: fontFamily.body,
  },
  label: { fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 4 },
  input: {
    minHeight: TAP,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: INPUT_FONT_SIZE,   // 16px 미만이면 iOS가 누를 때 화면을 확대한다
    fontFamily: fontFamily.body,
  },
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
  btnGhostText: { fontFamily: fontFamily.body, fontSize: 15, fontWeight: '600', color: colors.muted },
  btnDanger: { backgroundColor: colors.danger },
  btnDangerText: { fontFamily: fontFamily.body, fontSize: 15, fontWeight: '600', color: colors.onAccent },
});
