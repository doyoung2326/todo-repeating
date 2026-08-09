import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DeleteAccountModal from './DeleteAccountModal';

/** 밖에서 끝낼 수 있는 약속 — 아직 끝나지 않은 요청을 흉내낸다 */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  render(<DeleteAccountModal onSubmit={onSubmit} onClose={onClose} />);
  return { onSubmit, onClose, user: userEvent.setup() };
}

const passwordBox = () => screen.getByLabelText('비밀번호 확인');
const deleteBtn   = () => screen.getByRole('button', { name: /^(탈퇴하기|탈퇴 처리 중\.\.\.)$/ });

async function fillAndDelete(user, password = 'password1') {
  await user.clear(passwordBox());
  await user.type(passwordBox(), password);
  await user.click(deleteBtn());
}

describe('DeleteAccountModal — 기본', () => {
  it('무엇이 지워지는지와 되돌릴 수 없다는 것을 미리 알려준다', () => {
    setup();

    expect(screen.getByText(/모두 삭제/)).toBeInTheDocument();
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument();
  });

  it('비밀번호를 받아 onSubmit에 넘긴다', async () => {
    const { user, onSubmit } = setup();

    await fillAndDelete(user);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('password1'));
  });

  it('취소를 누르면 onClose를 부르고 탈퇴하지 않는다', async () => {
    const { user, onClose, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('DeleteAccountModal — 실패', () => {
  it('서버가 준 에러 문구를 그대로 보여주고 모달을 닫지 않는다', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('비밀번호가 올바르지 않습니다.'));
    const { user, onClose } = setup(onSubmit);

    await fillAndDelete(user, 'wrongpassword');

    expect(await screen.findByText(/비밀번호가 올바르지 않습니다/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('실패한 뒤에는 다시 시도할 수 있다', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('비밀번호가 올바르지 않습니다.'));
    const { user } = setup(onSubmit);

    await fillAndDelete(user, 'wrongpassword');
    await screen.findByText(/비밀번호가 올바르지 않습니다/);

    expect(deleteBtn()).toBeEnabled();
  });
});

describe('DeleteAccountModal — 중복 제출 방지', () => {
  // 계정을 두 번 지우려는 요청이 나가면 두 번째는 401을 받아 엉뚱한 화면이 뜬다
  it('보내는 중에는 버튼이 잠기고 두 번 눌러도 한 번만 보낸다', async () => {
    const pending = deferred();
    const onSubmit = vi.fn().mockReturnValue(pending.promise);
    const { user } = setup(onSubmit);

    await fillAndDelete(user);

    expect(deleteBtn()).toBeDisabled();
    await user.click(deleteBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);

    pending.resolve();
  });
});
