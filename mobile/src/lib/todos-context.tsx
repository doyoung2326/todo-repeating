import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { localToday, msUntilMidnight } from '@shared/dates.js';
import { SessionExpiredError, type Todo } from './api';
import { useAuth } from './auth-context';

type TodosValue = {
  todos: Todo[];
  today: string;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** 서버를 고치고 목록을 다시 받아온다. 실패하면 문구를 돌려준다(화면이 알린다). */
  mutate: (fn: () => Promise<unknown>) => Promise<string | null>;
};

const TodosContext = createContext<TodosValue | null>(null);

/**
 * 세 탭이 같은 목록을 본다. 탭마다 따로 받아오면 같은 데이터를 세 번 부르고,
 * 한 탭에서 완료 처리한 것이 다른 탭에 반영되지 않는다.
 */
export function TodosProvider({ children }: { children: ReactNode }) {
  const { api, session } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [today, setToday] = useState(localToday);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const account = session?.user?.email;

  const reload = useCallback(async () => {
    try {
      setTodos(await api.listTodos());
      setError(null);
    } catch (e) {
      // 세션 만료는 실패가 아니다 — 이미 로그인 화면으로 넘어가 있다.
      if (!(e instanceof SessionExpiredError)) {
        setError('서버에 연결할 수 없습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    void reload();
  }, [account, reload]);

  // 자정을 넘기면 "오늘"이 바뀐다. 갱신하는 장치가 없으면 화면은 어제에 머물러 있다가
  // 엉뚱한 리렌더가 일어나는 순간 갑자기 하루를 건너뛴다.
  // 앱은 절전에 자주 들어가므로 타이머 하나에만 기대지 않는다 — 웹의 visibilitychange에
  // 해당하는 AppState 감시는 화면을 붙일 때 함께 넣는다.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(() => {
        const now = localToday();
        setToday(prev => (prev === now ? prev : now));
        if (account) void reload();
        schedule();
      }, msUntilMidnight());
    };

    schedule();
    return () => clearTimeout(timer);
  }, [account, reload]);

  const mutate = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
      return null;
    } catch (e) {
      if (e instanceof SessionExpiredError) return null;
      return (e as Error).message;
    }
  }, [reload]);

  const value = useMemo(
    () => ({ todos, today, loading, error, reload, mutate }),
    [todos, today, loading, error, reload, mutate]
  );

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}

export function useTodos(): TodosValue {
  const value = useContext(TodosContext);
  if (!value) throw new Error('useTodos는 TodosProvider 안에서만 쓸 수 있습니다.');
  return value;
}
