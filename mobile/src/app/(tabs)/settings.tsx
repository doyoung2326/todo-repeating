import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import { ConfirmModal } from '@/components/confirm-modal';
import { DeleteAccountModal } from '@/components/delete-account-modal';
import { useTabBarSpace } from '@/components/tab-bar';
import { useAuth } from '@/lib/auth-context';
import { PRIVACY_URL } from '@/constants/links';
import { colors, fontFamily, radius, TAP } from '@/constants/tokens';

/**
 * 설정 — 계정에 관한 것만 모여 있다.
 *
 * 탭으로 둔 이유는 **찾을 수 있어야 하기 때문**이다. 앱스토어 심사자는 계정 삭제를
 * 직접 눌러보고 통과 여부를 정한다(App Store 5.1.1(v)). 메뉴 안에 접어 두면
 * 못 찾았다는 이유로 반려된다.
 */
export default function SettingsScreen() {
  const { session, api, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const tabBar = useTabBarSpace();

  // 서버가 계정을 지우고 나면 남은 토큰은 이미 죽어 있다. 이 기기의 세션만 지우면 된다.
  // 오류는 잡지 않고 그대로 던진다 — 창이 받아서 그 안에 보여준다.
  async function deleteAccount(password: string) {
    await api.deleteAccount(password);
    await signOut();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>설정</Text>
      </View>

      <View style={[styles.body, { paddingBottom: tabBar.total }]}>
        <View style={styles.group}>
          <Text style={styles.groupLabel}>계정</Text>
          <View style={styles.card}>
            <Text style={styles.email} numberOfLines={1}>{session?.user.email}</Text>
          </View>
        </View>

        <View style={styles.group}>
          <Row label="개인정보처리방침" onPress={() => { void WebBrowser.openBrowserAsync(PRIVACY_URL); }} />
        </View>

        <View style={styles.group}>
          <Row label="로그아웃" onPress={() => setSigningOut(true)} />
          <Row label="회원 탈퇴" tone="danger" onPress={() => setDeleting(true)} />
        </View>

        <Text style={styles.note}>
          탈퇴하면 할 일·복습 기록·알림 설정이 모두 삭제되며 되돌릴 수 없습니다.
        </Text>
      </View>

      <ConfirmModal
        visible={signingOut}
        title="로그아웃"
        message="이 기기에서 로그아웃할까요?"
        confirmLabel="로그아웃"
        tone="danger"
        onConfirm={() => { void signOut(); }}
        onClose={() => setSigningOut(false)}
      />

      <DeleteAccountModal
        visible={deleting}
        onSubmit={deleteAccount}
        onClose={() => setDeleting(false)}
      />
    </SafeAreaView>
  );
}

function Row({ label, onPress, tone = 'normal' }: {
  label: string;
  onPress: () => void;
  tone?: 'normal' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <Text style={[styles.rowText, tone === 'danger' && styles.rowTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontFamily: fontFamily.body, fontSize: 20, fontWeight: '700', color: colors.text },
  body: { paddingHorizontal: 16, gap: 20 },

  group: { gap: 6 },
  groupLabel: { fontFamily: fontFamily.body, fontSize: 12, fontWeight: '600', color: colors.muted, paddingHorizontal: 2 },

  card: {
    minHeight: TAP,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  email: { fontFamily: fontFamily.body, fontSize: 15, color: colors.text },

  row: {
    minHeight: TAP,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  rowPressed: { opacity: 0.6 },
  rowText: { fontFamily: fontFamily.body, fontSize: 15, color: colors.text },
  rowTextDanger: { color: colors.danger, fontWeight: '600' },

  note: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, lineHeight: 18, paddingHorizontal: 2 },
});
