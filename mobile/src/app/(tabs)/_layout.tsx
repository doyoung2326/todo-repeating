import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';

import { TodosProvider } from '@/lib/todos-context';
import { colors } from '@/constants/tokens';

/**
 * 하단 탭 셋 — 웹의 좁은 화면(BottomTabBar)과 같은 구성이다.
 *
 * 이모지를 쓰지 않는다. 선 아이콘을 쓰고 뜻은 라벨이 전달한다.
 */
export default function TabsLayout() {
  return (
    <TodosProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '오늘',
            tabBarIcon: ({ color, size }) => <Feather name="sun" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="list"
          options={{
            title: '목록',
            tabBarIcon: ({ color, size }) => <Feather name="list" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="review"
          options={{
            title: '복습',
            tabBarIcon: ({ color, size }) => <Feather name="repeat" color={color} size={size} />,
          }}
        />
        {/* 설정을 메뉴 안에 접지 않고 탭으로 둔다 — 심사자가 계정 삭제를 직접 찾아
            눌러봐야 통과한다(App Store 5.1.1(v)). */}
        <Tabs.Screen
          name="settings"
          options={{
            title: '설정',
            tabBarIcon: ({ color, size }) => <Feather name="settings" color={color} size={size} />,
          }}
        />
      </Tabs>
    </TodosProvider>
  );
}
