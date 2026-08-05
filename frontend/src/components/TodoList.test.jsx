import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TodoList from './TodoList';

const todo = (id, text) => ({
  id, text, importance: 1, deadline: null, perform_date: null,
  needs_review: 0, progress: null, start_time: null, end_time: null,
  completed: 0, completed_at: null, created_at: '2026-06-01', activeReview: null,
});

const renderList = (incomplete = [], completed = []) =>
  render(
    <TodoList
      incompleteTodos={incomplete}
      completedTodos={completed}
      today="2026-06-01"
      onComplete={() => {}} onEdit={() => {}} onDelete={() => {}}
      onCompleteReview={() => {}} onAddToToday={() => {}}
      onDragStart={() => {}} onDragEnd={() => {}}
    />
  );

describe('TodoList', () => {
  it('할일이 하나도 없으면 빈 상태 안내를 보여준다', () => {
    renderList();
    expect(screen.getByText(/아직 할일이 없어요/)).toBeInTheDocument();
  });

  it('진행 중 할일을 개수와 함께 보여준다', () => {
    renderList([todo('1', '수학 문제집'), todo('2', '영어 단어')]);
    expect(screen.getByText('수학 문제집')).toBeInTheDocument();
    expect(screen.getByText('영어 단어')).toBeInTheDocument();
    expect(screen.getByText(/진행 중/)).toBeInTheDocument();
  });

  it('완료 목록이 비어 있으면 완료 섹션을 그리지 않는다', () => {
    renderList([todo('1', '수학 문제집')]);
    expect(screen.queryByText(/✅ 완료/)).not.toBeInTheDocument();
  });
});
