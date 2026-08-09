import { useMemo } from 'react';

import { Empty, Screen } from '@/components/screen';
import { CardButton, TodoCard, useReportedMutate } from '@/components/todo-card';
import { useAuth } from '@/lib/auth-context';
import { useTodos } from '@/lib/todos-context';

/**
 * 오늘 화면 — 수행날짜가 오늘인 항목과 오늘이 복습일인 항목.
 *
 * 웹에는 여기에 타임라인 보기가 함께 있다(shared/timeline.js의 layoutTimed·buildTimeAxis).
 * 계산은 이미 공유하고 있으므로, 앱에 붙일 때 다시 만들 것은 그리는 부분뿐이다.
 */
export default function TodayScreen() {
  const { todos, today } = useTodos();
  const { api } = useAuth();
  const run = useReportedMutate();

  const { perform, reviews } = useMemo(() => ({
    perform: todos.filter(t => !t.completed && t.perform_date === today),
    reviews: todos.filter(t => t.activeReview && t.activeReview.due_date <= today),
  }), [todos, today]);

  const total = perform.length + reviews.length;

  return (
    <Screen title="오늘 할 일" count={total}>
      {total === 0 && <Empty>오늘 할 일이 없습니다</Empty>}

      {perform.map(t => (
        <TodoCard
          key={t.id}
          todo={t}
          actions={
            <>
              <CardButton label="완료" onPress={() => run('완료 처리 실패', () => api.completeTodo(t.id, true))} />
              <CardButton
                label="오늘에서 빼기"
                onPress={() => run('변경 실패', () => api.setPerformDate(t.id, null))}
              />
            </>
          }
        />
      ))}

      {reviews.map(t => (
        <TodoCard
          key={`r-${t.id}`}
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
