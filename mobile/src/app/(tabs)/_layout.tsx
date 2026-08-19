import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/tab-bar';
import { TodosProvider } from '@/lib/todos-context';
import { colors } from '@/constants/tokens';

/**
 * 하단 탭 — 웹의 좁은 화면(BottomTabBar)과 같은 구성이다.
 *
 * **기본 탭바를 쓰지 않고 `FloatingTabBar`로 갈아 끼운다.** react-navigation의 기본은
 * 화면 밑변에 붙은 띠인데 웹은 아래에 떠 있는 알약이라, 같은 서비스인데 아래쪽이
 * 전혀 다르게 보였다. 아이콘은 여기서 정하고 탭바가 그것을 그대로 부른다 —
 * 같은 지식을 두 곳에 두지 않는다.
 *
 * 이모지를 쓰지 않는다. 선 아이콘을 쓰고 뜻은 라벨이 전달한다.
 */
export default function TabsLayout() {
  return (
    <TodosProvider>
      <Tabs
        tabBar={props => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '오늘',
            tabBarIcon: ({ color, size }) => <Feather name="calendar" color={color} size={size} />,
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
            tabBarIcon: ({ color, size }) => <Feather name="rotate-cw" color={color} size={size} />,
          }}
        />
        {/* 설정을 메뉴 안에 접지 않고 탭으로 둔다 — 심사자가 계정 삭제를 직접 찾아
            눌러봐야 통과한다(App Store 5.1.1(v)). 웹은 계정 메뉴 안에 있다. */}
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
