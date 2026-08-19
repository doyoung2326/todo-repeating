import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { colors } from '@/constants/tokens';

/**
 * 로그인 관문.
 *
 * 화면을 라우터로 가르지 않고 여기서 통째로 갈라 끼운다. 로그인하지 않은 사람에게는
 * 탭 자체가 존재하지 않아야 뒤로가기나 딥링크로 새어 들어갈 구멍이 없다.
 *
 * **`Stack.Protected`로 가른다. 조건부 `<Stack.Screen>`으로는 갈리지 않는다** —
 * `<Stack.Screen>`은 "이 화면을 보여줘라"가 아니라 "이 경로의 설정은 이렇다"는
 * 선언이라, 빼도 그 경로는 그대로 열린다. 그렇게 두면 로그아웃 상태로 `/`에 들어와도
 * 탭이 뜨고, 로그인에 성공해도 화면이 넘어가지 않는다(로그인 화면은 스스로
 * 이동하지 않고 이 갈래가 바꿔주기를 기다린다).
 *
 * `guard`가 거짓인 화면은 네비게이터에서 아예 빠지고, 지금 그 화면에 있었다면
 * 남아 있는 쪽으로 옮겨진다. 그래서 로그인·로그아웃 양방향이 모두 이 한 곳에서 끝난다.
 */
function RootNavigator() {
  const { session, restoring } = useAuth();

  // 저장된 세션을 읽는 사이에 로그인 화면을 보여주면, 이미 로그인한 사람에게도
  // 화면이 한 번 번쩍인다. 짧은 순간이라도 기다린다.
  if (restoring) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
