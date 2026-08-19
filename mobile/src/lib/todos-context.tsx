import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { localToday, msUntilMidnight } from '@shared/dates.js';
import { SessionExpiredError, type Category, type Todo } from './api';
import { useAuth } from './auth-context';

type TodosValue = {
  todos: Todo[];
  /** 성격을 id로 찾는 표. 할 일에는 `category_id`만 들어 있다. */
  categoryById: Map<string, Category>;
  today: string;
  loading: boolean;
  error: string | null;
  /**
   * 방금 누른 동작이 실패했다는 알림.
   * 목록 자체는 멀쩡하다는 점에서 error(목록을 못 받아왔다)와 다르다.
   */
  notice: string | null;
  notify: (message: string) => void;
  /** 당겨서 새로고침 — 할 일과 성격을 함께 다시 받는다. */
  refresh: () => Promise<void>;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [today, setToday] = useState(localToday);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const account = session?.user?.email;

  const reload = useCallback(async () => {
    try {
      setTodos(await api.listTodos());
      setError(null);
      // 다시 받아오는 데 성공했으면 앞서 실패한 동작의 문구도 함께 걷는다.
      setNotice(null);
    } catch (e) {
      // 세션 만료는 실패가 아니다 — 이미 로그인 화면으로 넘어가 있다.
      if (!(e instanceof SessionExpiredError)) {
        setError('서버에 연결할 수 없습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  // 성격은 못 받아와도 화면이 선다 — 칩만 안 그려질 뿐이다. 그래서 오류를 알리지 않는다.
  const reloadCategories = useCallback(async () => {
    try {
      setCategories(await api.listCategories());
    } catch { /* 무시 */ }
  }, [api]);

  const refresh = useCallback(async () => {
    await Promise.all([reload(), reloadCategories()]);
  }, [reload, reloadCategories]);

  useEffect(() => {
    // 로그아웃 상태에서는 받아올 것이 없다. 여기서 그냥 돌아가면 loading이 처음 값인
    // true로 남아 화면이 영영 스피너만 돈다.
    // 앞 사용자의 것도 함께 비운다 — 남겨 두면 다음 사람이 잠깐 남의 할 일을 본다.
    if (!account) {
      setTodos([]);
      setCategories([]);
      setError(null);
      setNotice(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void reload();
    void reloadCategories();
  }, [account, reload, reloadCategories]);

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

  const notify = useCallback((message: string) => setNotice(message), []);

  const categoryById = useMemo(
    () => new Map(categories.map(c => [String(c.id), c])),
    [categories]
  );

  const value = useMemo(
    () => ({ todos, categoryById, today, loading, error, notice, notify, refresh, mutate }),
    [todos, categoryById, today, loading, error, notice, notify, refresh, mutate]
  );

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}

export function useTodos(): TodosValue {
  const value = useContext(TodosContext);
  if (!value) throw new Error('useTodos는 TodosProvider 안에서만 쓸 수 있습니다.');
  return value;
}

/**
 * 서버를 고치고, 실패하면 사용자에게 알린다. 성공은 목록이 바뀌는 것으로 이미 보인다.
 *
 * **`Alert.alert`으로 알리지 않는다** — react-native-web의 Alert는 본문이 빈 함수라
 * 웹에서 개발할 때 실패가 조용히 묻힌다(눌렀는데 아무 일도 안 일어나는 것처럼 보인다).
 * 화면 위쪽 띠에 남기면 웹·앱 양쪽에서 보이고, 항목을 누를 때마다 창이 뜨지 않아
 * 덜 거슬린다. 띠는 다음에 목록을 다시 받아오는 데 성공하면 걷힌다.
 */
export function useReportedMutate() {
  const { mutate, notify } = useTodos();
  return (what: string, fn: () => Promise<unknown>) => {
    void mutate(fn).then(message => {
      if (message) notify(`${what}: ${message}`);
    });
  };
}
