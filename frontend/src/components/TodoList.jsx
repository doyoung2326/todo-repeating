import { useState } from 'react';
import TodoItem from './TodoItem';
import { ChevronIcon } from './icons';

export default function TodoList({
  incompleteTodos, completedTodos, archivedTodos = [], today, compact, categoryById,
  onComplete, onEdit, onDelete, onCompleteReview, onAddToToday, onDragStart, onDragEnd,
}) {
  // 보관됨은 항상 접힌 채로 시작한다. 기억해 두면 "다 끝난 것"이 다시 목록을 덮는다.
  const [showArchived, setShowArchived] = useState(false);

  const hasAny = incompleteTodos.length + completedTodos.length + archivedTodos.length > 0;

  if (!hasAny) {
    return (
      <div className="card empty-card">
        <p>아직 할 일이 없어요. 새 할 일을 추가해보세요!</p>
      </div>
    );
  }

  const itemProps = {
    today, compact, categoryById,
    onComplete, onEdit, onDelete, onCompleteReview, onAddToToday, onDragStart, onDragEnd,
  };

  return (
    <>
      {incompleteTodos.length > 0 && (
        <div className="card list-card">
          <h2 className="section-title">진행 중 <span className="count-sm">{incompleteTodos.length}</span></h2>
          <div className="todo-list">
            {incompleteTodos.map(todo => (
              <TodoItem key={todo.id} todo={todo} {...itemProps} />
            ))}
          </div>
        </div>
      )}

      {completedTodos.length > 0 && (
        <div className="card list-card">
          <h2 className="section-title muted">완료 <span className="count-sm">{completedTodos.length}</span></h2>
          <div className="todo-list">
            {completedTodos.map(todo => (
              <TodoItem key={todo.id} todo={todo} {...itemProps} />
            ))}
          </div>
        </div>
      )}

      {/* 더 할 것이 남지 않은 항목(복습까지 끝났거나 복습을 안 쓰는 완료).
          접힌 동안은 아예 그리지 않는다 — 수백 개가 쌓여도 DOM에 들어오지 않는다. */}
      {archivedTodos.length > 0 && (
        <div className="card list-card">
          <button
            type="button"
            className="section-title muted archive-toggle"
            aria-expanded={showArchived}
            onClick={() => setShowArchived(o => !o)}
          >
            <ChevronIcon />
            보관됨 <span className="count-sm">{archivedTodos.length}</span>
          </button>
          {showArchived && (
            <div className="todo-list">
              {archivedTodos.map(todo => (
                <TodoItem key={todo.id} todo={todo} {...itemProps} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
