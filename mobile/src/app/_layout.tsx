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
      {session
        ? <Stack.Screen name="(tabs)" />
        : <Stack.Screen name="login" />}
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
