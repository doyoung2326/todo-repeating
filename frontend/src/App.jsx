import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import TodaySection from './components/TodaySection';
import TodoForm from './components/TodoForm';
import TodoList from './components/TodoList';
import ReviewSection from './components/ReviewSection';
import ProgressCheckModal from './components/ProgressCheckModal';
import AuthScreen from './components/AuthScreen';
import PasswordChangeModal from './components/PasswordChangeModal';
import DeleteAccountModal from './components/DeleteAccountModal';
import NotificationSettings from './components/NotificationSettings';
import CategoryManager from './components/CategoryManager';
import BottomTabBar from './components/BottomTabBar';
import BottomSheet from './components/BottomSheet';
import { PlusIcon } from './components/icons';
import useMediaQuery from './hooks/useMediaQuery';
import { PRIVACY_URL } from './config/links';
import { formatKoreanDate } from './theme';
import { loadSession, saveSession, clearSession } from './auth/session';
import { createAuthFetch, SessionExpiredError } from '../../shared/authFetch.js';
import { localToday, msUntilMidnight } from '../../shared/dates.js';
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

export default function App() {
  const [session, setSession]       = useState(loadSession);
  const [today, setToday]           = useState(localToday);
  const [todos, setTodos]           = useState([]);
  // null = 아직 못 받아왔다(모른다), 배열 = 받아왔다. 이 둘을 구분하지 않으면
  // 조회에 실패했을 때 "성격이 하나도 없다"로 읽혀서, 할 일을 수정할 때마다
  // 붙어 있던 성격이 조용히 지워진다.
  const [categories, setCategories] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [progressItems, setProgressItems] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [isDraggingOverLeft, setDraggingOverLeft] = useState(false);
  const draggingTodoIdRef = useRef(null);
  const leftDragCount = useRef(0);
  // 자정 감시가 "날짜가 실제로 바뀌었는지"를 판단할 기준. 상태와 달리 즉시 읽고 쓸 수 있다.
  const todayRef = useRef(today);

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
    setCategories(null);
    setEditingTodo(null);
    setProgressItems(null);
    setError(null);
    setSheetOpen(false);
    setAccountMenuOpen(false);
    setNotifyOpen(false);
    setCategoryOpen(false);
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

  // 실패해도 배너를 띄우지 않는다. 이 기능이 없는 옛 서버는 404를 주는데,
  // 곁다리 기능 하나 때문에 화면 전체에 "서버에 연결할 수 없습니다"가 뜨면 안 된다.
  //
  // 다만 **실패했다고 빈 배열로 덮지도 않는다.** 빈 배열은 "성격이 없다"는 사실이라,
  // 모르는 것을 사실로 바꿔 놓으면 할 일 수정 폼이 "성격 없음"을 보내 멀쩡한 성격을 지운다.
  const fetchCategories = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/categories`);
      if (!res.ok) throw new Error();
      setCategories(await res.json());
    } catch {
      // 모르는 채로 둔다
    }
  }, [authFetch]);

  // 로그인 직후(그리고 앱 시작 시) 1회: 목록을 받아오고 진행률 미입력 항목을 확인
  useEffect(() => {
    if (!account) { setLoading(false); return; }
    setLoading(true);
    fetchCategories();
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

  // 자정을 넘기면 "오늘"이 바뀐다. 갱신하는 장치가 없으면 화면은 어제에 머물러 있다가
  // 엉뚱한 리렌더가 일어나는 순간 갑자기 하루를 건너뛴다.
  //
  // 타이머 하나만으로는 부족하다 — 절전에 들어간 사이 setTimeout은 밀리거나 늦게 깬다.
  // 그래서 자정 타이머와 "화면이 다시 보일 때"를 함께 건다.
  useEffect(() => {
    let timer;

    const sync = () => {
      const now = localToday();
      if (now !== todayRef.current) {
        todayRef.current = now;
        setToday(now);
        // 날짜가 바뀌면 오늘 할 일·복습의 대상이 달라지므로 목록도 다시 받는다.
        // 진행률 모달은 일부러 띄우지 않는다 — 쓰고 있는 중에 튀어나오면 방해가 된다.
        if (account) fetchTodos();
      }
      schedule();
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(sync, msUntilMidnight());
    };

    const syncIfVisible = () => { if (document.visibilityState === 'visible') sync(); };

    schedule();
    document.addEventListener('visibilitychange', syncIfVisible);
    window.addEventListener('focus', sync);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', syncIfVisible);
      window.removeEventListener('focus', sync);
    };
  }, [account, fetchTodos]);

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

  // 서버가 계정과 데이터를 지우고 나면 남은 토큰은 이미 죽어 있다. 여기서는 이 기기의
  // 흔적만 지우면 된다 — 오류는 잡지 않고 모달이 보여주도록 그대로 던진다.
  const deleteAccount = async (password) => {
    await apiCall(`${API}/auth/me`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    logout();
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
  const closeCategory = useCallback(() => setCategoryOpen(false), []);

  // 열 때 한 번 더 받아온다. 처음에 조회가 실패해 목록을 모르는 채였다면
  // 여기서 스스로 회복한다 — 사용자가 다시 로그인할 이유가 없다.
  const openCategory = useCallback(() => {
    setCategoryOpen(true);
    fetchCategories();
  }, [fetchCategories]);

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

  // 추가·수정의 실패는 일부러 관리 화면까지 올려 보낸다 — 이름이 겹쳤다(409) 같은 말은
  // alert보다 폼 안에 붙어 있어야 고칠 수 있다.
  // 단 세션 만료는 실패가 아니다(이미 로그인 화면이다). 그것만 여기서 삼킨다.
  const saveCategory = async (url, method, data) => {
    try {
      await apiCall(url, { method, body: JSON.stringify(data) });
    } catch (e) {
      if (e instanceof SessionExpiredError) return;
      throw e;
    }
    fetchCategories();
  };

  const createCategory = (data) => saveCategory(`${API}/categories`, 'POST', data);
  const updateCategory = (id, data) => saveCategory(`${API}/categories/${id}`, 'PUT', data);

  const deleteCategory = async (id) => {
    if (!window.confirm('이 성격을 삭제할까요? 이 성격이 붙은 할 일에서는 표시만 사라집니다.')) return;
    try {
      await apiCall(`${API}/categories/${id}`, { method: 'DELETE' });
      // 할 일도 다시 받아온다. 칩은 성격 목록만 새로 받아도 사라지지만, 손에 든
      // todos가 죽은 id를 계속 들고 있으면 그 할 일을 수정할 때 폼이 그 id를 되돌려
      // 보내고 서버가 400을 준다. 서버는 이미 비웠으니 이쪽도 맞춘다.
      await Promise.all([fetchCategories(), fetchTodos()]);
    } catch (e) { reportFailure('성격 삭제 실패', e); }
  };

  // 추가든 수정이든 폼은 겹침 창으로 띄운다. 목록 위에 상시 두면 어느 폭에서든
  // 자리를 크게 먹는다.
  const startEdit = (todo) => {
    setEditingTodo(todo);
    setSheetOpen(true);
  };

  // 완료를 둘로 가른다. activeReview는 서버가 "복습 대상이고 완료된" 항목에만 채우므로,
  // 완료했는데 activeReview가 없다 = 복습을 다 끝냈거나 애초에 복습을 안 쓰는 항목이다.
  // (미완료도 activeReview가 없으니 completed 조건을 빼면 안 된다.)
  // 할 일이 든 것은 성격 id뿐이다. 이름과 색은 여기서 찾아 붙인다.
  // 할 일 객체 자체에 성격을 얹지는 않는다 — 그 객체는 수정 폼의 initialValues이기도 해서,
  // 필드가 늘면 폼이 그것까지 서버로 되돌려 보내게 된다.
  const categoryById = useMemo(
    () => new Map((categories ?? []).map(c => [String(c.id), c])),
    [categories]
  );

  const incompleteTodos = todos.filter(t => !t.completed);
  const completedTodos  = todos.filter(t =>  t.completed &&  t.activeReview);
  const archivedTodos   = todos.filter(t =>  t.completed && !t.activeReview);

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
      categories={categories}
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

      {deletingAccount && (
        <DeleteAccountModal
          onSubmit={deleteAccount}
          onClose={() => setDeletingAccount(false)}
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
                      onClick={() => { setAccountMenuOpen(false); openCategory(); }}>
                      성격 관리
                    </button>
                    <button type="button" role="menuitem"
                      onClick={() => { setAccountMenuOpen(false); setChangingPassword(true); }}>
                      비밀번호 변경
                    </button>
                    <button type="button" role="menuitem"
                      onClick={() => { setAccountMenuOpen(false); logout(); }}>
                      로그아웃
                    </button>
                    <a role="menuitem" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer"
                      onClick={() => setAccountMenuOpen(false)}>
                      개인정보처리방침
                    </a>
                    <button type="button" role="menuitem" className="danger"
                      onClick={() => { setAccountMenuOpen(false); setDeletingAccount(true); }}>
                      회원 탈퇴
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <span className="app-user-email" title={email}>{email}</span>
              <button className="app-header-btn" type="button" onClick={() => setNotifyOpen(true)}>알림 설정</button>
              <button className="app-header-btn" type="button" onClick={openCategory}>성격 관리</button>
              <button className="app-header-btn" type="button" onClick={() => setChangingPassword(true)}>비밀번호 변경</button>
              <button className="app-header-btn" type="button" onClick={logout}>로그아웃</button>
              <button className="app-header-btn danger" type="button" onClick={() => setDeletingAccount(true)}>회원 탈퇴</button>
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
            archivedTodos={archivedTodos}
            today={today}
            compact={isCompact}
            categoryById={categoryById}
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

      {categoryOpen && (
        <BottomSheet label="성격 관리" onClose={closeCategory}>
          <CategoryManager
            categories={categories ?? []}
            onCreate={createCategory}
            onUpdate={updateCategory}
            onDelete={deleteCategory}
          />
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
