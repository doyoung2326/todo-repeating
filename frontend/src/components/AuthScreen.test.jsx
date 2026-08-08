import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AuthScreen from './AuthScreen';

const SESSION = { token: 'tok.en.abc', user: { id: '1', email: 'a@example.com' } };

/** fetch가 준 것처럼 보이는 응답 객체 */
const res = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function mockFetch(impl) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** 아직 끝나지 않은 요청을 흉내내기 위해 밖에서 resolve할 수 있는 약속 */
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const onAuth = vi.fn();
  render(<AuthScreen api="/api" onAuth={onAuth} />);
  return { onAuth, user: userEvent.setup() };
}

const emailBox  = () => screen.getByLabelText('이메일');
const pwBox     = () => screen.getByLabelText('비밀번호');
const submitBtn = () => screen.getByRole('button', { name: /^(로그인|가입하고 시작하기|처리 중\.\.\.)$/ });
const switchBtn = () => screen.getByRole('button', { name: /처음이신가요|이미 계정이 있어요/ });

/** 유효한 값을 채우고 제출한다 */
async function submitWith(user, { email = 'a@example.com', password = 'password1' } = {}) {
  await user.clear(emailBox());
  await user.type(emailBox(), email);
  await user.clear(pwBox());
  await user.type(pwBox(), password);
  await user.click(submitBtn());
}

describe('AuthScreen — 모드 전환', () => {
  it('처음에는 로그인 모드로 열린다', () => {
    setup();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('전환 버튼을 누르면 회원가입 모드가 되고 다시 누르면 로그인으로 돌아온다', async () => {
    const { user } = setup();

    await user.click(switchBtn());
    expect(screen.getByRole('button', { name: '가입하고 시작하기' })).toBeInTheDocument();

    await user.click(switchBtn());
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('모드를 전환하면 에러 메시지와 입력한 비밀번호가 지워지고 이메일은 남는다', async () => {
    mockFetch(async () => res(401, { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }));
    const { user } = setup();

    await submitWith(user);
    await screen.findByText(/이메일 또는 비밀번호가 올바르지 않습니다/);

    await user.click(switchBtn());

    expect(screen.queryByText(/이메일 또는 비밀번호가 올바르지 않습니다/)).not.toBeInTheDocument();
    expect(pwBox()).toHaveValue('');
    expect(emailBox()).toHaveValue('a@example.com');
  });
});

describe('AuthScreen — 제출', () => {
  it('로그인 모드에서는 /auth/login으로 보낸다', async () => {
    const fetchMock = mockFetch(async () => res(200, SESSION));
    const { user } = setup();

    await submitWith(user);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ email: 'a@example.com', password: 'password1' });
  });

  it('회원가입 모드에서는 /auth/register로 보낸다', async () => {
    const fetchMock = mockFetch(async () => res(200, SESSION));
    const { user } = setup();

    await user.click(switchBtn());
    await submitWith(user);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/register');
  });

  it('성공하면 서버가 준 세션을 그대로 onAuth에 넘긴다', async () => {
    mockFetch(async () => res(200, SESSION));
    const { user, onAuth } = setup();

    await submitWith(user);

    await waitFor(() => expect(onAuth).toHaveBeenCalledWith(SESSION));
  });
});

describe('AuthScreen — 입력 검증', () => {
  it('회원가입 모드에서 비밀번호가 8자 미만이면 서버에 요청하지 않는다', async () => {
    const fetchMock = mockFetch(async () => res(200, SESSION));
    const { user } = setup();

    await user.click(switchBtn());
    await submitWith(user, { password: '1234567' });

    expect(await screen.findByText(/8자 이상/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('로그인 모드에서는 8자 미만이어도 그대로 서버로 보낸다', async () => {
    const fetchMock = mockFetch(async () => res(401, { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }));
    const { user } = setup();

    await submitWith(user, { password: 'short' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

describe('AuthScreen — 실패 처리', () => {
  it('서버가 준 에러 문구를 그대로 보여주고 onAuth는 부르지 않는다', async () => {
    mockFetch(async () => res(409, { error: '이미 가입된 이메일입니다.' }));
    const { user, onAuth } = setup();

    await user.click(switchBtn());
    await submitWith(user);

    expect(await screen.findByText(/이미 가입된 이메일입니다/)).toBeInTheDocument();
    expect(onAuth).not.toHaveBeenCalled();
  });

  it('응답이 JSON이 아니면 기본 문구로 대체한다', async () => {
    mockFetch(async () => ({
      ok: false, status: 500,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    }));
    const { user } = setup();

    await submitWith(user);

    expect(await screen.findByText(/요청에 실패했습니다/)).toBeInTheDocument();
  });

  it('200이어도 세션 형태가 아닌 응답은 받아들이지 않는다', async () => {
    mockFetch(async () => res(200, { user: { email: 'a@example.com' } })); // 토큰이 없다
    const { user, onAuth } = setup();

    await submitWith(user);

    expect(await screen.findByText(/응답/)).toBeInTheDocument();
    expect(onAuth).not.toHaveBeenCalled();
  });

  it('사용자 정보가 빠진 응답도 받아들이지 않는다', async () => {
    mockFetch(async () => res(200, { token: 'tok.en.abc' }));
    const { user, onAuth } = setup();

    await submitWith(user);

    expect(onAuth).not.toHaveBeenCalled();
  });

  it('서버에 닿지 못하면 연결 실패 안내를 보여준다', async () => {
    mockFetch(async () => { throw new TypeError('Failed to fetch'); });
    const { user } = setup();

    await submitWith(user);

    expect(await screen.findByText(/서버에 연결할 수 없습니다/)).toBeInTheDocument();
  });
});

describe('AuthScreen — 중복 제출 방지', () => {
  it('요청이 끝나기 전에는 버튼이 잠기고 두 번 눌러도 한 번만 보낸다', async () => {
    const pending = deferred();
    const fetchMock = mockFetch(() => pending.promise);
    const { user } = setup();

    await submitWith(user);

    expect(submitBtn()).toBeDisabled();
    expect(submitBtn()).toHaveTextContent('처리 중...');

    await user.click(submitBtn());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    pending.resolve(res(200, SESSION));
  });

  it('실패한 뒤에는 버튼이 다시 눌린다', async () => {
    mockFetch(async () => res(401, { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }));
    const { user } = setup();

    await submitWith(user);
    await screen.findByText(/이메일 또는 비밀번호가 올바르지 않습니다/);

    expect(submitBtn()).toBeEnabled();
  });

  it('성공한 뒤에도 화면이 남아 있으면 버튼 잠금이 풀린다', async () => {
    mockFetch(async () => res(200, SESSION));
    const { user, onAuth } = setup();

    await submitWith(user);
    await waitFor(() => expect(onAuth).toHaveBeenCalled());

    // 잠금 해제를 "화면이 곧 사라지니까"에 맡기면, 화면이 남는 순간 영영 잠긴다.
    await waitFor(() => expect(submitBtn()).toBeEnabled());
  });
});
