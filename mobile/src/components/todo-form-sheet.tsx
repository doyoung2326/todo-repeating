import { useCallback, useState } from 'react';

import { BottomSheet } from './bottom-sheet';
import { TodoForm } from './todo-form';
import type { Todo, TodoInput } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useReportedMutate, useTodos } from '@/lib/todos-context';

/**
 * 추가·수정 폼을 여닫는 장치. 두 화면(오늘·목록)이 같은 폼을 쓰므로 한 곳에 모은다.
 *
 * 화면은 이렇게 쓴다:
 *
 *     const form = useTodoFormSheet();
 *     ...
 *     <TodoItem onEdit={form.openEdit} ... />
 *     <Fab onPress={form.openCreate} />
 *     {form.sheet}
 *
 * 저장하면 **창을 먼저 닫는다.** 성공은 목록이 바뀌는 것으로 이미 보이고, 실패하면
 * 화면 위쪽 띠가 알린다(useReportedMutate). 창을 붙잡아 두면 그 띠가 창 뒤에 가린다.
 */
export function useTodoFormSheet() {
  const { api } = useAuth();
  const { categories } = useTodos();
  const run = useReportedMutate();

  // null이면 닫힌 것. { editing: null }은 새로 만드는 중.
  const [state, setState] = useState<{ editing: Todo | null } | null>(null);

  const close = useCallback(() => setState(null), []);
  const openCreate = useCallback(() => setState({ editing: null }), []);
  const openEdit = useCallback((todo: Todo) => setState({ editing: todo }), []);

  function submit(data: TodoInput) {
    const editing = state?.editing;
    close();
    if (editing) run('수정 실패', () => api.updateTodo(editing.id, data));
    else run('추가 실패', () => api.createTodo(data));
  }

  return {
    openCreate,
    openEdit,
    sheet: state && (
      <BottomSheet label={state.editing ? '할 일 수정' : '할 일 추가'} onClose={close}>
        <TodoForm
          initialValues={state.editing}
          categories={categories}
          onSubmit={submit}
          onCancel={close}
        />
      </BottomSheet>
    ),
  };
}
