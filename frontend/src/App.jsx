import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import TodaySection from './components/TodaySection';
import TodoForm from './components/TodoForm';
import TodoList from './components/TodoList';
import ReviewSection from './components/ReviewSection';
import ProgressCheckModal from './components/ProgressCheckModal';
import AuthScreen from './components/AuthScreen';
import PasswordChangeModal from './components/PasswordChangeModal';
import NotificationSettings from './components/NotificationSettings';
import BottomTabBar from './components/BottomTabBar';
import BottomSheet from './components/BottomSheet';
import { PlusIcon } from './components/icons';
import useMediaQuery from './hooks/useMediaQuery';
import { formatKoreanDate } from './theme';
import { loadSession, saveSession, clearSession } from './auth/session';
import { createAuthFetch, SessionExpiredError } from './auth/authFetch';
import './App.css';

const API = import.meta.env.VITE_API_URL || '/api';

// 화면 조정 패널은 개발 중에만. 테스트에서는 화면에 없는 버튼이 늘어나지 않도록 뺀다.
const SHOW_THEME_PANEL = import.meta.env.DEV && import.meta.env.MODE !== 'test';

// 지연 로딩이라 운영 빌드에서는 이 갈래 전체가 사라진다 — 패널의 JS도 CSS도 딸려오지 않는다.
// (정적 import로 두면 컴포넌트는 걷어내도 CSS는 부작용으로 남는다.)
const ThemePanel = SHOW_THEME_PANEL
  ? lazy(() => import('./components/ThemePanel'))
  : null;

// 좁은 화면 기준. App.css의 첫 번째 브레이크포인트(700px)와 반드시 같아야 한다.
const COMPACT_QUERY = '(max-width: 699px)';

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
  const [changingPassword, setChangingPassword] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [isDraggingOverLeft, setDraggingOverLeft] = useState(false);
  const draggingTodoIdRef = useRef(null);
  const leftDragCount = useRef(0);

  // 좁은 화면에서만 달라지는 것들: 하단 탭, 추가 시트, 계정 메뉴, 항목의 ⋯ 메뉴.
  // 나머지 레이아웃은 전부 CSS가 처리한다.
  const isCompact = useMediaQuery(COMPACT_QUERY);
  const [tab, setTab] = useState('today');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const token = session?.token;
  // 목록을 다시 받아올지 판단하는 기준. 토큰은 비밀번호를 바꿔도 갈리므로
  // "누구인지"를 쓴다 — 같은 사람이면 토큰만 바뀌어도 다시 받을 이유가 없다.
  const account = session?.user?.email;

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setTodos([]);
    setEditingTodo(null);
    setProgressItems(null);
    setError(null);
    setSheetOpen(false);
    setAccountMenuOpen(false);
    setNotifyOpen(false);
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
    if (!account) { setLoading(false); return; }
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
  }, [account]);

  async function apiCall(url, options = {}) {
    const res = await authFetch(url, options);
    if (!res.ok) {
      // 서버는 { error: "..." } 형태로 답한다. 원문 JSON을 그대로 보여주지 않는다.
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `요청에 실패했습니다. (${res.status})`);
    }
    return res.json();
  }

  const changePassword = async (currentPassword, newPassword) => {
    const { token: fresh } = await apiCall(`${API}/auth/password`, {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    // 서버가 옛 토큰을 무효로 만들었으므로 새 토큰으로 갈아끼운다
    const next = { ...session, token: fresh };
    saveSession(next);
    setSession(next);
  };

  // 세션이 만료돼 로그인 화면으로 넘어간 경우에는 알림을 띄우지 않는다.
  function reportFailure(what, err) {
    if (err instanceof SessionExpiredError) return;
    alert(`${what}: ${err.message}`);
  }

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setEditingTodo(null);
  }, []);

  const closeNotify = useCallback(() => setNotifyOpen(false), []);

  const createTodo = async (data) => {
    try {
      await apiCall(`${API}/todos`, { method: 'POST', body: JSON.stringify(data) });
      setSheetOpen(false);
      fetchTodos();
    } catch (e) { reportFailure('추가 실패', e); }
  };

  const updateTodo = async (id, data) => {
    try {
      await apiCall(`${API}/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      setEditingTodo(null);
      setSheetOpen(false);
      fetchTodos();
    } catch (e) { reportFailure('수정 실패', e); }
  };

  const deleteTodo = async (id) => {
    if (!window.confirm('정말 삭제할까요?')) return;
    try { await apiCall(`${API}/todos/${id}`, { method: 'DELETE' }); fetchTodos(); }
    catch (e) { reportFailure('삭제 실패', e); }
  };

  const completeTodo = async (id, c) => {
    try { await apiCall(`${API}/todos/${id}/complete`, { method: 'PUT', body: JSON.stringify({ completed: c }) }); fetchTodos(); }
    catch (e) { reportFailure('완료 처리 실패', e); }
  };

  const completeReview = async (rid) => {
    try { await apiCall(`${API}/reviews/${rid}/complete`, { method: 'PUT' }); fetchTodos(); }
    catch (e) { reportFailure('복습 완료 실패', e); }
  };

  const setPerformDate = async (id, date) => {
    try {
      await apiCall(`${API}/todos/${id}/perform-date`, { method: 'PUT', body: JSON.stringify({ perform_date: date }) });
      fetchTodos();
    } catch (e) { reportFailure('오늘 등록 실패', e); }
  };

  const saveProgress = async (id, progress) => {
    try {
      await apiCall(`${API}/todos/${id}/progress`, { method: 'PUT', body: JSON.stringify({ progress }) });
      fetchTodos();
    } catch (e) { reportFailure('진행률 저장 실패', e); }
  };

  // 추가든 수정이든 폼은 겹침 창으로 띄운다. 목록 위에 상시 두면 어느 폭에서든
  // 자리를 크게 먹는다.
  const startEdit = (todo) => {
    setEditingTodo(todo);
    setSheetOpen(true);
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

  const email = session.user.email;

  const todoForm = (
    <TodoForm
      onSubmit={editingTodo ? (data) => updateTodo(editingTodo.id, data) : createTodo}
      initialValues={editingTodo}
      onCancel={closeSheet}
    />
  );

  return (
    <div className="app" data-tab={tab}>
      {progressItems && (
        <ProgressCheckModal
          items={progressItems}
          onSave={async (id, progress) => { await saveProgress(id, progress); }}
          onClose={() => { setProgressItems(null); fetchTodos(); }}
        />
      )}

      {changingPassword && (
        <PasswordChangeModal
          onSubmit={changePassword}
          onClose={() => setChangingPassword(false)}
        />
      )}

      <header className="app-header">
        <div className="app-brand">
          <span className="app-date">{formatKoreanDate(today)}</span>
          <span className="app-title">공부 할 일 관리</span>
          <span className="app-sub">망각곡선 복습으로 효율적인 학습을</span>
        </div>

        <div className="app-user">
          {isCompact ? (
            // 좁은 화면에서는 계정 관련 항목을 이니셜 버튼 하나로 접는다
            <div className="app-menu-wrap">
              <button
                type="button"
                className="app-avatar"
                aria-label="계정 메뉴"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen(o => !o)}
              >
                {email.trim().charAt(0).toUpperCase()}
              </button>
              {accountMenuOpen && (
                <>
                  {/* 바깥을 누르면 닫힌다 */}
                  <div className="menu-scrim" onClick={() => setAccountMenuOpen(false)} />
                  <div className="app-menu" role="menu">
                    <p className="app-menu-email" title={email}>{email}</p>
                    <button type="button" role="menuitem"
                      onClick={() => { setAccountMenuOpen(false); setNotifyOpen(true); }}>
                      알림 설정
                    </button>
                    <button type="button" role="menuitem"
                      onClick={() => { setAccountMenuOpen(false); setChangingPassword(true); }}>
                      비밀번호 변경
                    </button>
                    <button type="button" role="menuitem"
                      onClick={() => { setAccountMenuOpen(false); logout(); }}>
                      로그아웃
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <span className="app-user-email" title={email}>{email}</span>
              <button className="app-header-btn" type="button" onClick={() => setNotifyOpen(true)}>알림 설정</button>
              <button className="app-header-btn" type="button" onClick={() => setChangingPassword(true)}>비밀번호 변경</button>
              <button className="app-header-btn" type="button" onClick={logout}>로그아웃</button>
            </>
          )}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="app-grid">
        {/* 오늘 — 열 전체가 드롭 존 (overflow 컨테이너 밖에서 이벤트 처리) */}
        <div
          className="col col-today"
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
            compact={isCompact}
            onCompleteTodo={completeTodo}
            onCompleteReview={completeReview}
            onRemovePerformDate={(id) => setPerformDate(id, null)}
            onSaveProgress={saveProgress}
          />
        </div>

        {/* 목록 — 추가 폼은 + 버튼 뒤에 있으므로 여기엔 목록만 남는다 */}
        <div className="col col-list">
          <TodoList
            incompleteTodos={incompleteTodos}
            completedTodos={completedTodos}
            today={today}
            compact={isCompact}
            onComplete={completeTodo}
            onEdit={startEdit}
            onDelete={deleteTodo}
            onCompleteReview={completeReview}
            onAddToToday={(id) => setPerformDate(id, today)}
            onDragStart={(id) => { draggingTodoIdRef.current = id; }}
            onDragEnd={() => { draggingTodoIdRef.current = null; }}
          />
        </div>

        {/* 복습 예정 */}
        <div className="col col-review">
          <ReviewSection
            todos={todos}
            today={today}
            onCompleteReview={completeReview}
          />
        </div>
      </div>

      {/* + 버튼과 폼 창은 어느 폭에서나 쓴다 */}
      <button
        type="button"
        className="fab"
        aria-label="할 일 추가"
        onClick={() => { setEditingTodo(null); setSheetOpen(true); }}
      >
        <PlusIcon />
      </button>

      {notifyOpen && (
        <BottomSheet label="알림 설정" onClose={closeNotify}>
          <NotificationSettings api={API} apiCall={apiCall} />
        </BottomSheet>
      )}

      {sheetOpen && (
        <BottomSheet label={editingTodo ? '할 일 수정' : '할 일 추가'} onClose={closeSheet}>
          {todoForm}
        </BottomSheet>
      )}

      {/* 하단 탭은 한 번에 한 영역만 보이는 좁은 화면에서만 필요하다 */}
      {isCompact && (
        <BottomTabBar
          active={tab}
          onChange={setTab}
          alerts={{
            today: todayPerformTodos.length + todayReviews.length,
            review: todayReviews.length,
          }}
        />
      )}

      {ThemePanel && (
        <Suspense fallback={null}>
          <ThemePanel />
        </Suspense>
      )}
    </div>
  );
}
