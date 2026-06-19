import { useState, useEffect, useCallback, useRef } from 'react';
import TodaySection from './components/TodaySection';
import TodoForm from './components/TodoForm';
import TodoList from './components/TodoList';
import ReviewSection from './components/ReviewSection';
import ProgressCheckModal from './components/ProgressCheckModal';
import './App.css';

const API = import.meta.env.VITE_API_URL || '/api';

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App() {
  const [todos, setTodos]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [progressItems, setProgressItems] = useState(null);
  const [isDraggingOverLeft, setDraggingOverLeft] = useState(false);
  const draggingTodoIdRef = useRef(null);
  const leftDragCount = useRef(0);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch(`${API}/todos`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTodos(data);
      setError(null);
      return data;
    } catch {
      setError('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 앱 시작 시 1회: 진행률 미입력 항목 확인
  useEffect(() => {
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
  }, []);

  async function apiCall(url, options = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  const createTodo     = async (data)     => { try { await apiCall(`${API}/todos`,               { method: 'POST', body: JSON.stringify(data) }); fetchTodos(); } catch(e) { alert('추가 실패: ' + e.message); } };
  const updateTodo     = async (id, data) => { try { await apiCall(`${API}/todos/${id}`,          { method: 'PUT',  body: JSON.stringify(data) }); setEditingTodo(null); fetchTodos(); } catch(e) { alert('수정 실패: ' + e.message); } };
  const deleteTodo     = async (id)       => { if (!window.confirm('정말 삭제할까요?')) return; try { await apiCall(`${API}/todos/${id}`, { method: 'DELETE' }); fetchTodos(); } catch(e) { alert('삭제 실패: ' + e.message); } };
  const completeTodo   = async (id, c)    => { try { await apiCall(`${API}/todos/${id}/complete`, { method: 'PUT',  body: JSON.stringify({ completed: c }) }); fetchTodos(); } catch(e) { alert('완료 처리 실패: ' + e.message); } };
  const completeReview = async (rid)      => { try { await apiCall(`${API}/reviews/${rid}/complete`, { method: 'PUT' }); fetchTodos(); } catch(e) { alert('복습 완료 실패: ' + e.message); } };

  const setPerformDate = async (id, date) => {
    try {
      await apiCall(`${API}/todos/${id}/perform-date`, { method: 'PUT', body: JSON.stringify({ perform_date: date }) });
      fetchTodos();
    } catch(e) { alert('오늘 등록 실패: ' + e.message); }
  };

  const saveProgress = async (id, progress) => {
    try {
      await apiCall(`${API}/todos/${id}/progress`, { method: 'PUT', body: JSON.stringify({ progress }) });
      fetchTodos();
    } catch(e) { alert('진행률 저장 실패: ' + e.message); }
  };

  const today           = localToday();
  const incompleteTodos = todos.filter(t => !t.completed);
  const completedTodos  = todos.filter(t =>  t.completed);

  // 오늘 할 일: (a) 수행날짜=오늘인 미완료 + (b) 오늘 복습일인 완료 항목
  const todayPerformTodos = incompleteTodos.filter(t => t.perform_date === today);
  const todayReviews      = todos.filter(t => t.activeReview && t.activeReview.due_date <= today);

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
            const id = draggingTodoIdRef.current || Number(e.dataTransfer.getData('text/plain'));
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
