import TodoItem from './TodoItem';

export default function TodoList({
  incompleteTodos, completedTodos, today, compact,
  onComplete, onEdit, onDelete, onCompleteReview, onAddToToday, onDragStart, onDragEnd,
}) {
  const hasAny = incompleteTodos.length + completedTodos.length > 0;

  if (!hasAny) {
    return (
      <div className="card empty-card">
        <p>아직 할 일이 없어요. 새 할 일을 추가해보세요!</p>
      </div>
    );
  }

  const itemProps = {
    today, compact,
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
    </>
  );
}
