import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TodaySection from './components/TodaySection';
import TodoForm from './components/TodoForm';
import TodoList from './components/TodoList';
import ReviewSection from './components/ReviewSection';
import ProgressCheckModal from './components/ProgressCheckModal';
import AuthScreen from './components/AuthScreen';
import { loadSession, saveSession, clearSession } from './auth/session';
import { createAuthFetch, SessionExpiredError } from './auth/authFetch';
import './App.css';

const API = import.meta.env.VITE_API_URL || '/api';

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App() {
  const [session, setSession]       = useState(loadSession);
  const [todos, setTodos]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [progressItems, setProgressItems] = useState(null);
  const [isDraggingOverLeft, setDraggingOverLeft] = useState(false);
  const draggingTodoIdRef = useRef(null);
  const leftDragCount = useRef(0);

  const token = session?.token;

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setTodos([]);
    setEditingTodo(null);
    setProgressItems(null);
    setError(null);
  }, []);

  const authFetch = useMemo(
    () => createAuthFetch({ token, onUnauthorized: logout }),
    [token, logout]
  );

  const fetchTodos = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/todos`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTodos(data);
      setError(null);
      return data;
    } catch (e) {
      if (!(e instanceof SessionExpiredError)) {
        setError('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // 로그인 직후(그리고 앱 시작 시) 1회: 목록을 받아오고 진행률 미입력 항목을 확인
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    fetchTodos().then(data => {
      if (!data) return;
      const today = localToday();
      const pending = data.filter(t =>
        !t.completed &&
        t.perform_date &&
        t.perform_date < today &&
        t.progress === null
      );
      if (pending.length > 0) setProgressItems(pending);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function apiCall(url, options = {}) {
    const res = await authFetch(url, options);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // 세션이 만료돼 로그인 화면으로 넘어간 경우에는 알림을 띄우지 않는다.
  function reportFailure(what, err) {
    if (err instanceof SessionExpiredError) return;
    alert(`${what}: ${err.message}`);
  }

  const createTodo     = async (data)     => { try { await apiCall(`${API}/todos`,               { method: 'POST', body: JSON.stringify(data) }); fetchTodos(); } catch(e) { reportFailure('추가 실패', e); } };
  const updateTodo     = async (id, data) => { try { await apiCall(`${API}/todos/${id}`,          { method: 'PUT',  body: JSON.stringify(data) }); setEditingTodo(null); fetchTodos(); } catch(e) { reportFailure('수정 실패', e); } };
  const deleteTodo     = async (id)       => { if (!window.confirm('정말 삭제할까요?')) return; try { await apiCall(`${API}/todos/${id}`, { method: 'DELETE' }); fetchTodos(); } catch(e) { reportFailure('삭제 실패', e); } };
  const completeTodo   = async (id, c)    => { try { await apiCall(`${API}/todos/${id}/complete`, { method: 'PUT',  body: JSON.stringify({ completed: c }) }); fetchTodos(); } catch(e) { reportFailure('완료 처리 실패', e); } };
  const completeReview = async (rid)      => { try { await apiCall(`${API}/reviews/${rid}/complete`, { method: 'PUT' }); fetchTodos(); } catch(e) { reportFailure('복습 완료 실패', e); } };

  const setPerformDate = async (id, date) => {
    try {
      await apiCall(`${API}/todos/${id}/perform-date`, { method: 'PUT', body: JSON.stringify({ perform_date: date }) });
      fetchTodos();
    } catch(e) { reportFailure('오늘 등록 실패', e); }
  };

  const saveProgress = async (id, progress) => {
    try {
      await apiCall(`${API}/todos/${id}/progress`, { method: 'PUT', body: JSON.stringify({ progress }) });
      fetchTodos();
    } catch(e) { reportFailure('진행률 저장 실패', e); }
  };

  const today           = localToday();
  const incompleteTodos = todos.filter(t => !t.completed);
  const completedTodos  = todos.filter(t =>  t.completed);

  // 오늘 할 일: (a) 수행날짜=오늘인 미완료 + (b) 오늘 복습일인 완료 항목
  const todayPerformTodos = incompleteTodos.filter(t => t.perform_date === today);
  const todayReviews      = todos.filter(t => t.activeReview && t.activeReview.due_date <= today);

  if (!session) return (
    <AuthScreen
      api={API}
      onAuth={data => { saveSession(data); setSession(data); }}
    />
  );

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>로딩 중...</p>
    </div>
  );

  return (
    <div className="app">
      {/* 진행률 확인 모달 */}
      {progressItems && (
        <ProgressCheckModal
          items={progressItems}
          onSave={async (id, progress) => { await saveProgress(id, progress); }}
          onClose={() => { setProgressItems(null); fetchTodos(); }}
        />
      )}

      <header className="app-header">
        <span className="app-title">📚 공부 할일 관리</span>
        <span className="app-sub">망각곡선 복습으로 효율적인 학습을</span>
        <div className="app-user">
          <span className="app-user-email" title={session.user.email}>{session.user.email}</span>
          <button className="app-logout" type="button" onClick={logout}>로그아웃</button>
        </div>
      </header>

      {error && <div className="error-banner">⚠️ {error}</div>}

      <div className="app-grid">
        {/* 왼쪽: 오늘 할 일 — 열 전체가 드롭 존 (overflow 컨테이너 밖에서 이벤트 처리) */}
        <div
          className="col"
          onDragEnter={e => { e.preventDefault(); leftDragCount.current += 1; setDraggingOverLeft(true); }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDragLeave={() => { leftDragCount.current -= 1; if (leftDragCount.current === 0) setDraggingOverLeft(false); }}
          onDrop={e => {
            e.preventDefault();
            leftDragCount.current = 0;
            setDraggingOverLeft(false);
            const id = draggingTodoIdRef.current || e.dataTransfer.getData('text/plain');
            if (id) setPerformDate(id, today);
            draggingTodoIdRef.current = null;
          }}
        >
          <TodaySection
            todayPerformTodos={todayPerformTodos}
            todayReviews={todayReviews}
            today={today}
            isDragOver={isDraggingOverLeft}
            onCompleteTodo={completeTodo}
            onCompleteReview={completeReview}
            onRemovePerformDate={(id) => setPerformDate(id, null)}
            onSaveProgress={saveProgress}
          />
        </div>

        {/* 가운데: 할일 추가 + 목록 */}
        <div className="col">
          <TodoForm
            onSubmit={editingTodo ? (data) => updateTodo(editingTodo.id, data) : createTodo}
            initialValues={editingTodo}
            onCancel={editingTodo ? () => setEditingTodo(null) : null}
          />
          <TodoList
            incompleteTodos={incompleteTodos}
            completedTodos={completedTodos}
            today={today}
            onComplete={completeTodo}
            onEdit={setEditingTodo}
            onDelete={deleteTodo}
            onCompleteReview={completeReview}
            onAddToToday={(id) => setPerformDate(id, today)}
            onDragStart={(id) => { draggingTodoIdRef.current = id; }}
            onDragEnd={() => { draggingTodoIdRef.current = null; }}
          />
        </div>

        {/* 오른쪽: 복습 예정 */}
        <div className="col">
          <ReviewSection
            todos={todos}
            today={today}
            onCompleteReview={completeReview}
          />
        </div>
      </div>
    </div>
  );
}
