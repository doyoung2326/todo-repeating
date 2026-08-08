import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PasswordChangeModal from './PasswordChangeModal';

/** 밖에서 끝낼 수 있는 약속 — 아직 끝나지 않은 요청을 흉내낸다 */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  render(<PasswordChangeModal onSubmit={onSubmit} onClose={onClose} />);
  return { onSubmit, onClose, user: userEvent.setup() };
}

const currentBox = () => screen.getByLabelText('현재 비밀번호');
const newBox     = () => screen.getByLabelText('새 비밀번호');
const saveBtn    = () => screen.getByRole('button', { name: /^(변경|변경 중\.\.\.)$/ });

async function fillAndSave(user, { current = 'password1', next = 'newpassword1' } = {}) {
  await user.clear(currentBox());
  await user.type(currentBox(), current);
  await user.clear(newBox());
  await user.type(newBox(), next);
  await user.click(saveBtn());
}

describe('PasswordChangeModal — 기본', () => {
  it('현재·새 비밀번호를 받아 onSubmit에 넘긴다', async () => {
    const { user, onSubmit } = setup();

    await fillAndSave(user);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('password1', 'newpassword1'));
  });

  it('성공하면 성공 안내를 보여준다', async () => {
    const { user } = setup();

    await fillAndSave(user);

    expect(await screen.findByText(/변경되었습니다/)).toBeInTheDocument();
  });

  it('다른 기기가 로그아웃된다는 것을 미리 알려준다', () => {
    setup();
    expect(screen.getByText(/다른 기기/)).toBeInTheDocument();
  });

  it('닫기를 누르면 onClose를 부른다', async () => {
    const { user, onClose } = setup();

    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('PasswordChangeModal — 검증과 실패', () => {
  it('새 비밀번호가 8자 미만이면 보내지 않는다', async () => {
    const { user, onSubmit } = setup();

    await fillAndSave(user, { next: '1234567' });

    expect(await screen.findByText(/8자 이상/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('새 비밀번호가 현재와 같으면 보내지 않는다', async () => {
    const { user, onSubmit } = setup();

    await fillAndSave(user, { current: 'password1', next: 'password1' });

    // "다른 기기" 안내문과 겹치지 않도록 에러 문구를 정확히 짚는다
    expect(await screen.findByText(/현재와 다른/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('서버가 준 에러 문구를 그대로 보여준다', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('현재 비밀번호가 올바르지 않습니다.'));
    const { user } = setup(onSubmit);

    await fillAndSave(user);

    expect(await screen.findByText(/현재 비밀번호가 올바르지 않습니다/)).toBeInTheDocument();
  });

  it('실패한 뒤에는 다시 시도할 수 있다', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('현재 비밀번호가 올바르지 않습니다.'));
    const { user } = setup(onSubmit);

    await fillAndSave(user);
    await screen.findByText(/현재 비밀번호가 올바르지 않습니다/);

    expect(saveBtn()).toBeEnabled();
  });
});

describe('PasswordChangeModal — 중복 제출 방지', () => {
  it('보내는 중에는 버튼이 잠기고 두 번 눌러도 한 번만 보낸다', async () => {
    const pending = deferred();
    const onSubmit = vi.fn().mockReturnValue(pending.promise);
    const { user } = setup(onSubmit);

    await fillAndSave(user);

    expect(saveBtn()).toBeDisabled();
    await user.click(saveBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);

    pending.resolve();
  });
});
