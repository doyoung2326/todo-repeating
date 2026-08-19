import { Tabs } from 'expo-router';
import { useMemo, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTodos } from '@/lib/todos-context';
import {
  colors, fontFamily, TABBAR_GAP, TABBAR_H, WEIGHT_SEMI,
} from '@/constants/tokens';

/**
 * 화면 아래에 **떠 있는 알약** 탭바. 웹 `.tabbar`와 같은 모양이다.
 *
 * react-navigation의 기본 탭바는 화면 밑변에 붙은 띠라서 웹과 달랐다. 여기서는
 * `Tabs`의 `tabBar`를 통째로 갈아 끼워 직접 그린다. 고른 탭은 알약 안에서 다시
 * 작은 알약이 된다(웹 `.tabbar-btn.active`).
 *
 * **떠 있으므로 목록 위를 덮는다.** 아래 여백은 `useTabBarSpace()`가 알려주는 만큼
 * 화면들이 스스로 비워야 한다 — 안 그러면 마지막 항목이 탭바에 가린다.
 *
 * 웹은 배경에 blur를 걸지만 여기서는 반투명만 쓴다. RN에서 blur를 쓰려면
 * `expo-blur`를 따로 들여야 하는데, 웹도 blur를 못 쓰는 브라우저에서는
 * 그냥 불투명으로 떨어뜨린다(App.css의 `@supports not`).
 */

/**
 * 탭바가 받는 것. expo-router 57은 react-navigation을 **안에 품고 있어서**
 * `@react-navigation/bottom-tabs`를 직접 가리킬 수 없다. 깊은 경로를 파는 대신
 * Tabs가 실제로 넘기는 값에서 끌어낸다 — 라이브러리가 바뀌어도 따라온다.
 */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** 탭바가 가리는 높이. 화면들이 아래 여백으로 이만큼 비워 둔다. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(TABBAR_GAP, insets.bottom);
  return { bottom, total: bottom + TABBAR_H + TABBAR_GAP };
}

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { bottom } = useTabBarSpace();
  const { todos, today } = useTodos();

  // 처리할 게 남은 탭에만 점을 찍는다(웹 `.tabbar-dot`과 같은 계산).
  const alerts = useMemo(() => {
    const perform = todos.filter(t => !t.completed && t.perform_date === today).length;
    const reviews = todos.filter(t => t.activeReview && t.activeReview.due_date <= today).length;
    return { index: perform + reviews, review: reviews } as Record<string, number>;
  }, [todos, today]);

  return (
    <View style={[styles.bar, { bottom }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === i;

        function onPress() {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          // 이미 그 탭에 있으면 아무 일도 하지 않는다 — 다시 눌러 스택을 되감는 동작은 없다.
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.btn, focused && styles.btnOn, pressed && styles.pressed]}
            onPress={onPress}
          >
            {alerts[route.name] > 0 && <View style={styles.dot} />}
            {options.tabBarIcon?.({
              focused,
              color: focused ? colors.accent : colors.muted,
              size: 22,
            })}
            <Text style={[styles.label, focused && styles.labelOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 3,
    padding: 6,
    height: TABBAR_H,
    borderRadius: 999,
    // 웹의 color-mix(card 78%, transparent)와 같은 값.
    backgroundColor: 'rgba(251,251,249,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(224,228,221,0.7)',
    // 그림자는 두 플랫폼이 서로 다른 속성을 본다. 둘 다 적어야 양쪽에 뜬다.
    elevation: 8,
    shadowColor: '#2b322d',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    ...Platform.select({ web: { backdropFilter: 'blur(20px) saturate(180%)' } as object, default: {} }),
  },
  btn: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  btnOn: { backgroundColor: colors.accentSoft },
  pressed: { opacity: 0.7 },

  label: { fontFamily: fontFamily.body, fontSize: 11.5, fontWeight: WEIGHT_SEMI, color: colors.muted },
  labelOn: { color: colors.accent },

  // 처리할 게 있는 탭에만. 아이콘 오른쪽 위에 찍힌다.
  dot: {
    position: 'absolute',
    top: 8,
    marginLeft: 23,
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.warn,
  },
});
