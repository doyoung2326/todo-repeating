import { useMemo, useState } from 'react';

import { Fab } from '@/components/fab';
import { Screen } from '@/components/screen';
import { CollapsibleSection, EmptyCard, Section } from '@/components/section';
import { TodoItem } from '@/components/todo-item';
import { useTodoFormSheet } from '@/components/todo-form-sheet';
import type { Todo } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useReportedMutate, useTodos } from '@/lib/todos-context';

/**
 * 전체 목록. 웹 `TodoList.jsx`와 같이 세 묶음으로 나눈다.
 *
 *   진행 중  아직 안 끝난 것
 *   완료     끝냈지만 **복습이 남은 것** — 목록에서 지우면 복습이 사라진 것처럼 보인다
 *   보관됨   복습까지 끝났거나 복습을 안 쓰는 완료. 접힌 채로 시작한다
 *
 * 보관됨을 늘 펼쳐 두면 "다 끝난 것"이 목록을 덮는다. 접힌 동안에는 아예 그리지 않아
 * 수백 개가 쌓여도 화면에 올라오지 않는다.
 */
export default function ListScreen() {
  const { todos, today } = useTodos();
  const { api } = useAuth();
  const run = useReportedMutate();
  const form = useTodoFormSheet();
  const [showArchived, setShowArchived] = useState(false);

  const { incomplete, completed, archived } = useMemo(() => ({
    incomplete: todos.filter(t => !t.completed),
    completed: todos.filter(t => t.completed && t.activeReview),
    archived: todos.filter(t => t.completed && !t.activeReview),
  }), [todos]);

  const handlers = {
    onComplete: (id: string, done: boolean) =>
      run('완료 처리 실패', () => api.completeTodo(id, done)),
    onDelete: (id: string) =>
      run('삭제 실패', () => api.deleteTodo(id)),
    onCompleteReview: (reviewId: string) =>
      run('복습 완료 실패', () => api.completeReview(reviewId)),
    onAddToToday: (id: string) =>
      run('등록 실패', () => api.setPerformDate(id, today)),
    onEdit: form.openEdit,
  };

  const rows = (list: Todo[]) =>
    list.map((t, i) => <TodoItem key={t.id} todo={t} first={i === 0} {...handlers} />);

  return (
    <>
      <Screen>
        {todos.length === 0 && (
          <EmptyCard>아직 할 일이 없어요. 새 할 일을 추가해보세요!</EmptyCard>
        )}

        {incomplete.length > 0 && (
          <Section title="진행 중" count={incomplete.length}>{rows(incomplete)}</Section>
        )}

        {completed.length > 0 && (
          <Section title="완료" count={completed.length} muted>{rows(completed)}</Section>
        )}

        {archived.length > 0 && (
          <CollapsibleSection
            title="보관됨"
            count={archived.length}
            open={showArchived}
            onToggle={() => setShowArchived(o => !o)}
          >
            {rows(archived)}
          </CollapsibleSection>
        )}
      </Screen>

      <Fab onPress={form.openCreate} />
      {form.sheet}
    </>
  );
}
