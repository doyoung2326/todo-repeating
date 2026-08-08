import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ReviewSection from './ReviewSection';

const TODAY = '2026-06-10';

/** 복습 대기 중인(완료됐고 복습이 켜진) 할 일 */
const withReview = (id, text, stage, due_date) => ({
  id, text, importance: 1, completed: 1, needs_review: 1,
  activeReview: { id: `${id}-r`, stage, due_date },
});

const renderSection = (todos) =>
  render(<ReviewSection todos={todos} today={TODAY} onCompleteReview={() => {}} />);

describe('ReviewSection', () => {
  it('복습 대기 중인 항목을 하나도 빠뜨리지 않는다', () => {
    renderSection([
      withReview('a', '자료구조 3주차', 1, '2026-06-08'),
      withReview('b', '영단어 Day 8', 2, '2026-06-10'),
      withReview('c', '운영체제 정리', 3, '2026-06-14'),
    ]);

    expect(screen.getByText('자료구조 3주차')).toBeInTheDocument();
    expect(screen.getByText('영단어 Day 8')).toBeInTheDocument();
    expect(screen.getByText('운영체제 정리')).toBeInTheDocument();
  });

  it('항목마다 자기 단계를 표시한다', () => {
    renderSection([
      withReview('a', '자료구조 3주차', 1, '2026-06-08'),
      withReview('c', '운영체제 정리', 3, '2026-06-14'),
    ]);

    // stage는 0부터 세므로 1 → 5단계 중 2번째
    expect(screen.getByLabelText('복습 5단계 중 2번째')).toBeInTheDocument();
    expect(screen.getByLabelText('복습 5단계 중 4번째')).toBeInTheDocument();
  });

  it('지남 · 오늘 · 예정으로 나눠 담는다', () => {
    renderSection([
      withReview('a', '지난 것', 0, '2026-06-08'),
      withReview('b', '오늘 것', 0, TODAY),
      withReview('c', '나중 것', 0, '2026-06-14'),
    ]);

    expect(screen.getByText('지남 (1)')).toBeInTheDocument();
    expect(screen.getByText('오늘 (1)')).toBeInTheDocument();
    expect(screen.getByText('예정 (1)')).toBeInTheDocument();
  });

  it('복습 예정이 없으면 빈 상태만 보여준다', () => {
    renderSection([{ id: 'x', text: '복습 없는 할 일', importance: 1, activeReview: null }]);

    expect(screen.getByText('복습 일정이 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('복습 없는 할 일')).not.toBeInTheDocument();
  });

  it('아직 오지 않은 복습에는 완료 버튼을 주지 않는다', () => {
    renderSection([withReview('c', '나중 것', 0, '2026-06-14')]);

    expect(screen.queryByRole('button', { name: '완료' })).not.toBeInTheDocument();
  });

  it('지났거나 오늘인 복습은 바로 완료할 수 있다', () => {
    renderSection([
      withReview('a', '지난 것', 0, '2026-06-08'),
      withReview('b', '오늘 것', 0, TODAY),
    ]);

    expect(screen.getAllByRole('button', { name: '완료' })).toHaveLength(2);
  });
});
