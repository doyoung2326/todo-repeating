import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import TodoList from './TodoList';

const todo = (id, text) => ({
  id, text, importance: 1, deadline: null, perform_date: null,
  needs_review: 0, progress: null, start_time: null, end_time: null,
  completed: 0, completed_at: null, created_at: '2026-06-01', activeReview: null,
});

// 복습이 아직 남은 완료 항목 — 서버가 activeReview를 채워서 준다
const reviewing = (id, text) => ({
  ...todo(id, text), needs_review: 1, completed: 1, completed_at: '2026-06-01',
  activeReview: { id: `r${id}`, stage: 1, due_date: '2026-06-05' },
});

// 더 할 것이 남지 않은 항목 — 복습을 다 끝냈거나 애초에 복습을 안 쓰는 완료
const archived = (id, text) => ({ ...todo(id, text), completed: 1, completed_at: '2026-06-01' });

const renderList = (incomplete = [], completed = [], archivedList = []) =>
  render(
    <TodoList
      incompleteTodos={incomplete}
      completedTodos={completed}
      archivedTodos={archivedList}
      today="2026-06-01"
      onComplete={() => {}} onEdit={() => {}} onDelete={() => {}}
      onCompleteReview={() => {}} onAddToToday={() => {}}
      onDragStart={() => {}} onDragEnd={() => {}}
    />
  );

const archiveToggle = () => screen.queryByRole('button', { name: /보관됨/ });

describe('TodoList', () => {
  it('할 일이 하나도 없으면 빈 상태 안내를 보여준다', () => {
    renderList();
    expect(screen.getByText(/아직 할 일이 없어요/)).toBeInTheDocument();
  });

  it('진행 중 할 일을 개수와 함께 보여준다', () => {
    renderList([todo('1', '수학 문제집'), todo('2', '영어 단어')]);
    expect(screen.getByText('수학 문제집')).toBeInTheDocument();
    expect(screen.getByText('영어 단어')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /진행 중/ })).toHaveTextContent('2');
  });

  it('완료한 할 일은 완료 섹션에 개수와 함께 보여준다', () => {
    renderList([todo('1', '수학 문제집')], [reviewing('2', '영어 단어')]);
    expect(screen.getByRole('heading', { name: /완료/ })).toHaveTextContent('1');
  });

  it('완료 목록이 비어 있으면 완료 섹션을 그리지 않는다', () => {
    renderList([todo('1', '수학 문제집')]);
    expect(screen.queryByRole('heading', { name: /완료/ })).not.toBeInTheDocument();
  });

  it('복습이 남은 완료 항목은 완료 섹션에, 다 끝난 항목은 보관됨으로 나뉜다', () => {
    renderList([], [reviewing('1', '영어 단어')], [archived('2', '수학 문제집')]);
    expect(screen.getByText('영어 단어')).toBeInTheDocument();       // 완료 섹션에 그대로
    expect(screen.getByRole('heading', { name: /완료/ })).toHaveTextContent('1');
    expect(archiveToggle()).toHaveTextContent('1');
  });

  it('보관됨은 기본으로 접혀 있어 개수만 보이고 항목은 그리지 않는다', () => {
    renderList([], [], [archived('1', '수학 문제집'), archived('2', '영어 단어')]);
    expect(archiveToggle()).toHaveTextContent('2');
    expect(archiveToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('수학 문제집')).not.toBeInTheDocument();
  });

  it('보관됨을 누르면 펼쳐지고 다시 누르면 접힌다', async () => {
    const user = userEvent.setup();
    renderList([], [], [archived('1', '수학 문제집')]);

    await user.click(archiveToggle());
    expect(archiveToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('수학 문제집')).toBeInTheDocument();

    await user.click(archiveToggle());
    expect(archiveToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('수학 문제집')).not.toBeInTheDocument();
  });

  it('보관된 항목만 있어도 빈 상태 안내를 보여주지 않는다', () => {
    renderList([], [], [archived('1', '수학 문제집')]);
    expect(screen.queryByText(/아직 할 일이 없어요/)).not.toBeInTheDocument();
    expect(archiveToggle()).toBeInTheDocument();
  });

  it('보관 목록이 비어 있으면 보관됨 섹션을 그리지 않는다', () => {
    renderList([todo('1', '수학 문제집')]);
    expect(archiveToggle()).not.toBeInTheDocument();
  });
});
