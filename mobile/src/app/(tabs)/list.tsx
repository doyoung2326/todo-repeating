import { useMemo } from 'react';

import { Empty, Screen } from '@/components/screen';
import { CardButton, TodoCard, useReportedMutate } from '@/components/todo-card';
import { useAuth } from '@/lib/auth-context';
import { useTodos } from '@/lib/todos-context';

/**
 * 전체 목록.
 *
 * 웹에는 여기에 추가·수정 폼(BottomSheet)이 붙어 있다. 앱에서도 + 버튼 뒤에 두어야 한다 —
 * 목록 위에 상시로 두면 좁은 화면에서 자리를 크게 먹는다. 아직 만들지 않았다.
 */
export default function ListScreen() {
  const { todos, today } = useTodos();
  const { api } = useAuth();
  const run = useReportedMutate();

  // 미완료가 위, 완료는 아래. 완료한 것도 복습이 남아 있어 지우지는 않는다.
  const sorted = useMemo(
    () => [...todos].sort((a, b) => Number(a.completed) - Number(b.completed)),
    [todos]
  );

  return (
    <Screen title="전체 목록" count={todos.filter(t => !t.completed).length}>
      {sorted.length === 0 && <Empty>아직 등록한 할 일이 없습니다</Empty>}

      {sorted.map(t => (
        <TodoCard
          key={t.id}
          todo={t}
          actions={
            <>
              <CardButton
                label={t.completed ? '완료 취소' : '완료'}
                onPress={() => run('완료 처리 실패', () => api.completeTodo(t.id, !t.completed))}
              />
              {!t.completed && t.perform_date !== today && (
                <CardButton
                  label="오늘로"
                  onPress={() => run('등록 실패', () => api.setPerformDate(t.id, today))}
                />
              )}
              <CardButton
                label="삭제"
                tone="danger"
                onPress={() => run('삭제 실패', () => api.deleteTodo(t.id))}
              />
            </>
          }
        />
      ))}
    </Screen>
  );
}
