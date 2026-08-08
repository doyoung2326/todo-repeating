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

function renderForm() {
  const onSubmit = vi.fn();
  render(<TodoForm onSubmit={onSubmit} initialValues={null} onCancel={null} />);
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
