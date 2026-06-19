import TodoItem from './TodoItem';

export default function TodoList({ incompleteTodos, completedTodos, today, onComplete, onEdit, onDelete, onCompleteReview, onAddToToday, onDragStart, onDragEnd }) {
  const hasAny = incompleteTodos.length + completedTodos.length > 0;

  if (!hasAny) {
    return (
      <div className="card empty-card">
        <span className="empty-icon">📝</span>
        <p>아직 할일이 없어요. 위에서 추가해보세요!</p>
      </div>
    );
  }

  return (
    <div>
      {incompleteTodos.length > 0 && (
        <div className="card list-card">
          <p className="section-title">📌 진행 중 <span className="count-sm">{incompleteTodos.length}</span></p>
          <div className="todo-list">
            {incompleteTodos.map(todo => (
              <TodoItem key={todo.id} todo={todo} today={today}
                onComplete={onComplete} onEdit={onEdit}
                onDelete={onDelete} onCompleteReview={onCompleteReview}
                onAddToToday={onAddToToday}
                onDragStart={onDragStart} onDragEnd={onDragEnd} />
            ))}
          </div>
        </div>
      )}

      {completedTodos.length > 0 && (
        <div className="card list-card">
          <p className="section-title muted">✅ 완료 <span className="count-sm">{completedTodos.length}</span></p>
          <div className="todo-list">
            {completedTodos.map(todo => (
              <TodoItem key={todo.id} todo={todo} today={today}
                onComplete={onComplete} onEdit={onEdit}
                onDelete={onDelete} onCompleteReview={onCompleteReview}
                onAddToToday={onAddToToday}
                onDragStart={onDragStart} onDragEnd={onDragEnd} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
