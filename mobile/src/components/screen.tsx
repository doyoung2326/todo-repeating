import { useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatKoreanDate } from '@shared/dates.js';
import { useTodos } from '@/lib/todos-context';
import { colors, fontSize, radius } from '@/constants/tokens';

/**
 * 할 일을 보는 세 탭이 공유하는 껍데기 — 날짜 머리글, 오류 띠, 당겨서 새로고침, 첫 로딩 표시.
 *
 * **제목은 여기에 두지 않는다.** 웹처럼 묶음마다 카드가 제 제목을 들고 있어서
 * (`Section`), 화면 위에도 같은 말을 적으면 두 번 읽힌다.
 * 대신 웹 헤더의 날짜(`.app-date`)를 남긴다 — 마감·복습이 전부 "오늘"을 기준으로
 * 읽히는 화면이라, 그 오늘이 언제인지 보이는 편이 낫다.
 *
 * 목록 자체는 ScrollView다. 항목이 수백 개가 되면 FlatList로 바꿔야 하지만,
 * 지금 규모에서 미리 나누면 화면 코드만 복잡해진다.
 */
export function Screen({ children }: { children: ReactNode }) {
  const { loading, error, notice, refresh, today } = useTodos();
  const [refreshing, setRefreshing] = useState(false);

  async function pull() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatKoreanDate(today)}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* 목록은 멀쩡한데 방금 누른 동작만 실패한 경우. 둘은 함께 뜰 수 있다 —
          서버가 죽으면 목록도 못 받고 동작도 실패하므로 각각이 사실이다. */}
      {notice && <Text style={styles.error}>{notice}</Text>}

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.accent} />
        }
      >
        {loading ? <ActivityIndicator color={colors.accent} style={styles.loading} /> : children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  date: { fontSize: fontSize.meta, fontWeight: '600', color: colors.muted, letterSpacing: 0.2 },

  error: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 13,
  },

  body: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  loading: { marginTop: 32 },
});
