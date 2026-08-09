import { createAuthFetch, SessionExpiredError } from '@shared/authFetch.js';

import { API_URL } from './config';

export { SessionExpiredError };

/** 서버가 주는 할 일. backend/app.js의 Todo 모델과 맞춰 둔다. */
export type Todo = {
  id: string;
  text: string;
  importance: 1 | 2 | 3;
  category: number | null;
  completed: boolean;
  needs_review: boolean;
  deadline: string | null;
  perform_date: string | null;
  start_time: string | null;
  end_time: string | null;
  progress: number | null;
  activeReview: Review | null;
};

export type Review = {
  id: string;
  stage: number;
  due_date: string;
  completed: boolean;
};

export type Api = ReturnType<typeof createApi>;

/**
 * 서버와 이야기하는 창구. 토큰을 붙이고 401을 처리하는 부분은 웹과 같은 파일을 쓴다.
 *
 * 여기서 한 겹 더 감싸는 이유는 **오류 문구** 때문이다. 서버는 실패를 `{ error: "..." }`로
 * 주는데, 화면에 원문 JSON을 보여줄 수는 없다. 실패는 전부 Error로 바꿔서 던진다.
 * 단 SessionExpiredError는 그대로 통과시킨다 — 이건 실패가 아니라 로그인 화면으로
 * 돌아가는 예정된 흐름이라 화면에 알리지 않는다.
 */
export function createApi({ token, onUnauthorized }: {
  token: string | null;
  onUnauthorized: () => void;
}) {
  const authFetch = createAuthFetch({ token, onUnauthorized });

  async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await authFetch(`${API_URL}${path}`, options);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `요청에 실패했습니다. (${res.status})`);
    }
    return res.json();
  }

  const body = (data: unknown) => JSON.stringify(data);

  return {
    listTodos: () => call<Todo[]>('/todos'),
    createTodo: (data: Partial<Todo>) => call<Todo>('/todos', { method: 'POST', body: body(data) }),
    updateTodo: (id: string, data: Partial<Todo>) => call<Todo>(`/todos/${id}`, { method: 'PUT', body: body(data) }),
    deleteTodo: (id: string) => call<unknown>(`/todos/${id}`, { method: 'DELETE' }),
    completeTodo: (id: string, completed: boolean) =>
      call<Todo>(`/todos/${id}/complete`, { method: 'PUT', body: body({ completed }) }),
    saveProgress: (id: string, progress: number) =>
      call<Todo>(`/todos/${id}/progress`, { method: 'PUT', body: body({ progress }) }),
    setPerformDate: (id: string, perform_date: string | null) =>
      call<Todo>(`/todos/${id}/perform-date`, { method: 'PUT', body: body({ perform_date }) }),
    completeReview: (id: string) => call<unknown>(`/reviews/${id}/complete`, { method: 'PUT' }),

    /**
     * 회원 탈퇴. 계정과 할 일·복습·알림 구독이 그 자리에서 전부 지워진다.
     *
     * 비밀번호가 틀리면 서버가 **403**을 준다(401이 아니다) — 401이면 위의 authFetch가
     * 세션 만료로 보고 로그아웃시켜, 오타 한 번에 화면째로 튕겨나간다.
     * 성공한 뒤에는 부른 쪽에서 signOut을 불러 이 기기의 세션도 지워야 한다.
     */
    deleteAccount: (password: string) =>
      call<{ ok: true }>('/auth/me', { method: 'DELETE', body: body({ password }) }),
  };
}

/** 로그인·회원가입은 토큰이 없을 때 부르므로 창구 바깥에 둔다. */
export async function authenticate(kind: 'login' | 'register', email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `요청에 실패했습니다. (${res.status})`);
  return data as { token: string; user: { id?: string; email: string } };
}
