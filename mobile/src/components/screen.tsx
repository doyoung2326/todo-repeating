import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTodos } from '@/lib/todos-context';
import { colors, radius } from '@/constants/tokens';

/**
 * 세 탭이 공유하는 껍데기 — 제목줄, 당겨서 새로고침, 오류 띠, 첫 로딩 표시.
 *
 * 목록 자체는 ScrollView다. 항목이 수백 개가 되면 FlatList로 바꿔야 하지만,
 * 지금 규모에서 미리 나누면 화면 코드만 복잡해진다.
 */
export function Screen({ title, count, children }: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  const { loading, error, notice, reload } = useTodos();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {count !== undefined && count > 0 && (
          <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* 목록은 멀쩡한데 방금 누른 동작만 실패한 경우. 둘은 함께 뜰 수 있다 —
          서버가 죽으면 목록도 못 받고 동작도 실패하므로 각각이 사실이다. */}
      {notice && <Text style={styles.error}>{notice}</Text>}

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.accent} />}
      >
        {loading ? <ActivityIndicator color={colors.accent} style={styles.loading} /> : children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  badge: {
    minWidth: 22, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  error: {
    marginHorizontal: 16, marginBottom: 8, padding: 10,
    borderRadius: radius.sm, backgroundColor: colors.dangerSoft, color: colors.danger, fontSize: 13,
  },
  body: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  loading: { marginTop: 32 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 40 },
});
