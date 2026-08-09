import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import { normalizeSession } from '@shared/session.js';
import { authenticate } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PRIVACY_URL } from '@/constants/links';
import { colors, radius, TAP, INPUT_FONT_SIZE } from '@/constants/tokens';

const MIN_PASSWORD_LENGTH = 8;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  function switchMode() {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
    setPassword('');
  }

  async function submit() {
    if (busy) return;

    if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const data = await authenticate(isRegister ? 'register' : 'login', email, password);

      // 200이어도 토큰·사용자가 빠져 있으면 그대로 넘기지 않는다.
      // 반쪽짜리 세션을 저장하면 다음 화면에서 터진다.
      const session = normalizeSession(data);
      if (!session) throw new Error('서버 응답을 이해할 수 없습니다.');
      await signIn(session);
    } catch (err) {
      // 네트워크가 끊긴 경우 fetch가 던지는 메시지는 사용자에게 의미가 없다
      setError(err instanceof TypeError ? '서버에 연결할 수 없습니다.' : (err as Error).message);
    } finally {
      // 성공하면 보통 이 화면이 사라지지만, 잠금 해제를 거기에 기대지는 않는다
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.brand}>
              <Text style={styles.brandTitle}>공부 할 일 관리</Text>
              <Text style={styles.brandSub}>망각곡선 복습으로 효율적인 학습을</Text>
            </View>

            <Text style={styles.heading}>{isRegister ? '회원가입' : '로그인'}</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.field}>
              <Text style={styles.label} nativeID="email-label">이메일</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                accessibilityLabelledBy="email-label"
                accessibilityLabel="이메일"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label} nativeID="password-label">비밀번호</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                accessibilityLabelledBy="password-label"
                accessibilityLabel="비밀번호"
                secureTextEntry
                autoCapitalize="none"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                textContentType={isRegister ? 'newPassword' : 'password'}
                placeholder={isRegister ? `${MIN_PASSWORD_LENGTH}자 이상` : ''}
                placeholderTextColor={colors.muted}
                onSubmitEditing={submit}
                returnKeyType="go"
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.submit, (busy || pressed) && styles.submitDim]}
              onPress={submit}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy
                ? <ActivityIndicator color={colors.onAccent} />
                : <Text style={styles.submitText}>{isRegister ? '가입하고 시작하기' : '로그인'}</Text>}
            </Pressable>

            <Pressable style={styles.switch} onPress={switchMode} accessibilityRole="button">
              <Text style={styles.switchText}>
                {isRegister ? '이미 계정이 있어요 · 로그인' : '처음이신가요? · 회원가입'}
              </Text>
            </Pressable>

            {/* 로그인하기 전에도 닿아야 하는 문서다. 스토어 심사도 이 자리를 본다.
                Linking이 아니라 WebBrowser를 쓴다 — 앱을 떠나지 않고 그 위에 열린다.
                (Expo 문서가 개인정보처리방침을 openBrowserAsync의 예로 든다.) */}
            <Pressable
              onPress={() => { void WebBrowser.openBrowserAsync(PRIVACY_URL); }}
              accessibilityRole="link"
            >
              <Text style={styles.foot}>개인정보처리방침</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 24,
    gap: 14,
  },
  brand: { alignItems: 'center', gap: 4, marginBottom: 4 },
  brandTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  brandSub: { fontSize: 13, color: colors.muted },
  heading: { fontSize: 17, fontWeight: '600', color: colors.text },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  field: { gap: 6 },
  label: { fontSize: 13, color: colors.muted },
  input: {
    // 16px 미만으로 두지 않는다 — iOS가 누를 때 화면을 확대한다.
    fontSize: INPUT_FONT_SIZE,
    color: colors.text,
    minHeight: TAP,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    backgroundColor: colors.bg,
  },
  submit: {
    minHeight: TAP,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitDim: { opacity: 0.7 },
  submitText: { color: colors.onAccent, fontSize: 16, fontWeight: '600' },
  switch: { minHeight: TAP, alignItems: 'center', justifyContent: 'center' },
  switchText: { color: colors.accent, fontSize: 14 },
  foot: { textAlign: 'center', color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
});
