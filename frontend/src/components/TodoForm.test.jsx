import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TodoForm from './TodoForm';

/** 시간 입력은 브라우저 기본 위젯이라 값으로 직접 넣는다. */
const setTime = async (user, label, value) => {
  const box = screen.getByLabelText(new RegExp(label));
  await user.clear(box);
  await user.type(box, value);
};

function renderForm({ initialValues = null, categories } = {}) {
  const onSubmit = vi.fn();
  render(
    <TodoForm
      onSubmit={onSubmit} initialValues={initialValues}
      categories={categories} onCancel={null}
    />
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('TodoForm — 시간 검증', () => {
  it('종료가 시작보다 빠르면 저장하지 않고 이유를 알려준다', async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText(/내용/), '테스트');
    await setTime(user, '시작 시간', '21:51');
    await setTime(user, '종료 시간', '12:51');
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('종료 시간은 시작 시간보다 뒤여야 합니다');
  });

  it('시작과 종료가 같아도 막는다 — 길이가 0인 일정은 그릴 수 없다', async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText(/내용/), '테스트');
    await setTime(user, '시작 시간', '09:00');
    await setTime(user, '종료 시간', '09:00');
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('시간을 바로잡으면 안내가 사라지고 저장된다', async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText(/내용/), '테스트');
    await setTime(user, '시작 시간', '21:51');
    await setTime(user, '종료 시간', '12:51');
    await user.click(screen.getByRole('button', { name: '추가하기' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await setTime(user, '종료 시간', '23:51');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ start_time: '21:51', end_time: '23:51' })
    );
  });

  it('시작만 있고 종료가 없으면 막지 않는다', async () => {
    const { onSubmit, user } = renderForm();

    await user.type(screen.getByLabelText(/내용/), '테스트');
    await setTime(user, '시작 시간', '21:51');
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ start_time: '21:51', end_time: null })
    );
  });
});

describe('TodoForm — 성격 고르기', () => {
  const CATEGORIES = [
    { id: 'c1', name: '영어', color: 3 },
    { id: 'c2', name: '과제', color: 7 },
  ];

  const editing = (category_id) => ({
    id: 't1', text: '수학 문제집', importance: 1, category_id,
    deadline: null, perform_date: null, needs_review: 0, progress: 40,
    start_time: null, end_time: null, completed: 0,
  });

  it('고른 성격의 id를 함께 보낸다', async () => {
    const { onSubmit, user } = renderForm({ categories: CATEGORIES });

    await user.type(screen.getByLabelText(/내용/), '단어 외우기');
    await user.selectOptions(screen.getByLabelText(/성격/), 'c2');
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category_id: 'c2' }));
  });

  it('성격을 고르지 않으면 성격 없이 보낸다', async () => {
    const { onSubmit, user } = renderForm({ categories: CATEGORIES });

    await user.type(screen.getByLabelText(/내용/), '그냥 할 일');
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category_id: null }));
  });

  it('수정할 때는 원래 성격이 골라져 있다', () => {
    renderForm({ initialValues: editing('c1'), categories: CATEGORIES });

    expect(screen.getByLabelText(/성격/)).toHaveValue('c1');
  });

  it('수정에서 성격 없음으로 바꾸면 비우라고 보낸다', async () => {
    const { onSubmit, user } = renderForm({ initialValues: editing('c1'), categories: CATEGORIES });

    await user.selectOptions(screen.getByLabelText(/성격/), '');
    await user.click(screen.getByRole('button', { name: '수정 완료' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category_id: null }));
  });

  // 성격을 지운 직후. 그 id를 그대로 되돌려 보내면 서버가 400을 준다.
  it('없는 성격을 가리키던 할 일은 성격 없음으로 연다', () => {
    renderForm({ initialValues: editing('이미-지운-성격'), categories: CATEGORIES });

    expect(screen.getByLabelText(/성격/)).toHaveValue('');
  });

  it('추가한 뒤에는 고른 성격이 다음 할 일에 남지 않는다', async () => {
    const { user } = renderForm({ categories: CATEGORIES });

    await user.type(screen.getByLabelText(/내용/), '첫 번째');
    await user.selectOptions(screen.getByLabelText(/성격/), 'c1');
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(screen.getByLabelText(/성격/)).toHaveValue('');
  });

  it('성격을 하나도 만들지 않았으면 선택칸 대신 어디서 만드는지 알려준다', () => {
    renderForm({ categories: [] });

    expect(screen.queryByLabelText(/성격/)).not.toBeInTheDocument();
    expect(screen.getByText(/성격 관리/)).toBeInTheDocument();
  });
});

/**
 * "성격이 하나도 없다"와 "성격 목록을 아직 모른다"는 다르다.
 * 뭉뚱그리면 조회에 실패한 화면에서 할 일을 고칠 때마다 멀쩡한 성격이 지워진다 —
 * 서버가 `category_id !== undefined` 가드로 막아 둔 바로 그 사고를 화면이 되살리는 셈이다.
 */
describe('TodoForm — 성격 목록을 아직 모를 때', () => {
  const editing = {
    id: 't1', text: '수학 문제집', importance: 1, category_id: 'c1',
    deadline: null, perform_date: null, needs_review: 0, progress: 40,
    start_time: null, end_time: null, completed: 0,
  };

  it('성격을 아예 보내지 않아 서버에 있던 성격이 살아남는다', async () => {
    const { onSubmit, user } = renderForm({ initialValues: editing, categories: null });

    await user.click(screen.getByRole('button', { name: '수정 완료' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('category_id');
  });

  it('만들지 않았다고 단정하지 않는다', () => {
    renderForm({ categories: null });

    expect(screen.queryByLabelText(/성격/)).not.toBeInTheDocument();
    expect(screen.queryByText(/아직 만들지 않았습니다/)).not.toBeInTheDocument();
  });

  // 반대쪽 경계: 정말로 하나도 없는 것을 아는 경우에는 보내야 한다
  it('성격이 없다는 것을 아는 경우에는 성격 없음을 보낸다', async () => {
    const { onSubmit, user } = renderForm({ initialValues: editing, categories: [] });

    await user.click(screen.getByRole('button', { name: '수정 완료' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category_id: null }));
  });
});
