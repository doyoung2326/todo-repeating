import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { daysDiff } from '@shared/dates.js';
import { Empty, Screen } from '@/components/screen';
import { CardButton, TodoCard, useReportedMutate } from '@/components/todo-card';
import { useAuth } from '@/lib/auth-context';
import { useTodos } from '@/lib/todos-context';
import { colors } from '@/constants/tokens';

/**
 * 복습 화면 — 1·3·7·16·30일 중 아직 남은 복습이 있는 항목.
 *
 * 급한 것이 위로 온다(지난 것 → 오늘 → 앞으로). 날짜순으로만 두면
 * 이미 지난 복습이 목록 한가운데 묻힌다.
 */
export default function ReviewScreen() {
  const { todos, today } = useTodos();
  const { api } = useAuth();
  const run = useReportedMutate();

  const pending = useMemo(
    () => todos
      .filter(t => t.activeReview)
      .sort((a, b) => a.activeReview!.due_date.localeCompare(b.activeReview!.due_date)),
    [todos]
  );

  const overdue = pending.filter(t => daysDiff(t.activeReview!.due_date, today) < 0).length;

  return (
    <Screen title="복습" count={pending.length}>
      {pending.length === 0 && <Empty>예정된 복습이 없습니다</Empty>}

      {overdue > 0 && <Text style={styles.notice}>지난 복습 {overdue}건</Text>}

      {pending.map(t => (
        <TodoCard
          key={t.id}
          todo={t}
          actions={
            <CardButton
              label="복습 완료"
              onPress={() => run('복습 완료 실패', () => api.completeReview(t.activeReview!.id))}
            />
          }
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { fontSize: 13, color: colors.danger },
});
