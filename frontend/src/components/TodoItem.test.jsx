import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TodoItem from './TodoItem';

const TODAY = '2026-06-01';

const base = {
  id: 't1', text: '수학 문제집', importance: 1, deadline: null, perform_date: null,
  needs_review: 0, progress: null, start_time: null, end_time: null,
  completed: 0, completed_at: null, created_at: TODAY, activeReview: null,
};

const noop = () => {};

/** 이 컴포넌트는 시계를 읽지 않고 today를 prop으로 받는다 — 날짜를 그냥 넘겨주면 된다. */
function renderItem(todo, categoryById) {
  return render(
    <TodoItem
      todo={{ ...base, ...todo }}
      today={TODAY}
      categoryById={categoryById}
      onComplete={noop} onEdit={noop} onDelete={noop} onCompleteReview={noop}
    />
  );
}

describe('TodoItem — 마감 표시', () => {
  it('마감이 지나면 며칠 지났는지 알려준다', () => {
    renderItem({ deadline: '2026-05-30' });
    expect(screen.getByText('마감 2일 지남')).toHaveClass('dl-over');
  });

  it('오늘이 마감이면 오늘 마감이라고 알려준다', () => {
    renderItem({ deadline: TODAY });
    expect(screen.getByText('오늘 마감')).toHaveClass('dl-today');
  });

  // 임박 경계는 3일이다. D-3과 D-4는 화면 글자가 "마감 D-3" / "마감 D-4"로 똑같고
  // 다른 것은 색(클래스)뿐이라, 글자만 확인하면 경계를 전혀 검증하지 못한다.
  it('마감 3일 전은 임박으로 표시한다', () => {
    renderItem({ deadline: '2026-06-04' });
    expect(screen.getByText('마감 D-3')).toHaveClass('dl-soon');
  });

  it('마감 4일 전은 아직 임박이 아니다', () => {
    renderItem({ deadline: '2026-06-05' });
    expect(screen.getByText('마감 D-4')).not.toHaveClass('dl-soon');
  });

  it('완료한 할 일에는 마감 표시를 붙이지 않는다', () => {
    renderItem({ deadline: '2026-05-30', completed: 1 });
    expect(screen.queryByText(/마감/)).not.toBeInTheDocument();
  });
});

describe('TodoItem — 복습 뱃지', () => {
  const reviewed = (due_date) => ({
    completed: 1, needs_review: 1,
    activeReview: { id: 'r1', stage: 0, due_date },
  });

  it('복습일이 지나면 며칠 지났는지 알려준다', () => {
    renderItem(reviewed('2026-05-29'));
    expect(screen.getByText(/3일 지남/)).toBeInTheDocument();
  });

  it('오늘이 복습일이면 오늘이라고 알려준다', () => {
    renderItem(reviewed(TODAY));
    expect(screen.getByText(/복습 — 오늘/)).toBeInTheDocument();
  });

  it('아직 남았으면 며칠 남았는지 알려준다', () => {
    renderItem(reviewed('2026-06-06'));
    expect(screen.getByText(/D-5/)).toBeInTheDocument();
  });

  it('복습이 전부 끝나면 끝났다고 알려준다', () => {
    renderItem({ completed: 1, needs_review: 1, activeReview: null });
    expect(screen.getByText('복습 전부 완료')).toBeInTheDocument();
  });
});

describe('TodoItem — 성격 칩', () => {
  const categories = new Map([['c1', { id: 'c1', name: '영어', color: 3 }]]);

  it('성격이 붙은 할 일에는 성격 이름을 보여준다', () => {
    renderItem({ category_id: 'c1' }, categories);
    expect(screen.getByText('영어')).toBeInTheDocument();
  });

  it('성격이 없으면 칩을 그리지 않는다', () => {
    renderItem({ category_id: null }, categories);
    expect(screen.queryByText('영어')).not.toBeInTheDocument();
  });

  // 성격을 막 지운 순간. 서버도 할 일을 비우지만 트랜잭션이 없어 그 사이가 있다.
  it('가리키는 성격이 목록에 없으면 칩을 그리지 않는다', () => {
    renderItem({ category_id: '이미-지운-성격' }, categories);
    expect(screen.queryByText('영어')).not.toBeInTheDocument();
  });

  // 목록을 아직 못 받아온 화면에서도 줄은 그려져야 한다
  it('성격 목록을 넘겨주지 않아도 할 일은 그대로 그린다', () => {
    renderItem({ category_id: 'c1' }, undefined);
    expect(screen.getByText('수학 문제집')).toBeInTheDocument();
  });
});
