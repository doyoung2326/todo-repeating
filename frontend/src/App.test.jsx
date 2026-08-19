import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { saveSession, loadSession } from './auth/session';

const SESSION = { token: 'tok.en.abc', user: { id: '1', email: 'a@example.com' } };

const TODO = {
  id: 't1', text: '수학 문제집', importance: 1, deadline: null, perform_date: null,
  needs_review: 0, progress: null, start_time: null, end_time: null,
  completed: 0, completed_at: null, created_at: '2026-06-01', activeReview: null,
};

const res = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/**
 * "METHOD 경로끝" → 응답 함수 로 이루어진 표로 fetch를 가로챈다.
 * 경로는 뒤에서부터 맞춰보므로 API 주소가 무엇이든 상관없다.
 */
function mockApi(routes) {
  const fn = vi.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    for (const [key, handler] of Object.entries(routes)) {
      const [m, suffix] = key.split(' ');
      if (m === method && String(url).endsWith(suffix)) return handler(options);
    }
    // 성격 목록은 App이 뜰 때마다 부르지만 대부분의 테스트와는 상관이 없다.
    // 표마다 적게 하면 표 열여섯 개가 곁다리 기능 하나 때문에 늘어난다.
    // 성격을 실제로 보는 테스트는 표에 넣어 이 기본값을 덮으면 된다.
    if (method === 'GET' && String(url).endsWith('/categories')) return res(200, []);
    throw new Error(`테스트가 예상하지 못한 요청: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

let alertMock;

beforeEach(() => {
  localStorage.clear();
  alertMock = vi.fn();
  vi.stubGlobal('alert', alertMock);
});

afterEach(() => vi.unstubAllGlobals());

const loginScreen = () => screen.findByRole('button', { name: '로그인' });

describe('App — 로그인하지 않은 상태', () => {
  it('저장된 세션이 없으면 로그인 화면을 보여준다', async () => {
    mockApi({});
    render(<App />);

    expect(await loginScreen()).toBeInTheDocument();
  });

  it('로그인 화면에서는 할 일 목록을 요청하지 않는다', async () => {
    const fetchMock = mockApi({});
    render(<App />);

    await loginScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('App — 자정을 넘길 때', () => {
  // 실제로 자정을 기다릴 수는 없으니 시계를 자정 직전에 세워두고 넘긴다.
  afterEach(() => vi.useRealTimers());

  it('앱을 켜둔 채 자정을 넘기면 헤더의 날짜가 다음 날로 바뀐다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 9, 23, 59, 50));   // 8월 9일 23:59:50
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, [TODO]) });

    render(<App />);
    expect(await screen.findByText('8월 9일 일요일')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(15_000);            // 자정 통과

    expect(await screen.findByText('8월 10일 월요일')).toBeInTheDocument();
  });

  it('절전에서 깨어난 것처럼 창이 다시 보이면 날짜를 다시 맞춘다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 9, 23, 59, 50));
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, [TODO]) });

    render(<App />);
    await screen.findByText('8월 9일 일요일');

    // 타이머가 밀린 상황: 시계만 앞으로 가고 setTimeout은 발화하지 않았다
    vi.setSystemTime(new Date(2026, 7, 10, 7, 0, 0));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(await screen.findByText('8월 10일 월요일')).toBeInTheDocument();
  });
});

describe('App — 넓은 화면에서도 할 일 추가는 + 버튼으로', () => {
  it('추가 폼이 목록 위 자리를 상시 차지하지 않는다', async () => {
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, [TODO]) });
    render(<App />);
    await screen.findByText('수학 문제집');

    expect(screen.queryByRole('heading', { name: '할 일 추가' })).not.toBeInTheDocument();
  });

  it('+ 버튼을 누르면 폼이 겹침 창으로 열린다', async () => {
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, [TODO]) });
    render(<App />);
    await screen.findByText('수학 문제집');

    await userEvent.setup().click(screen.getByRole('button', { name: '할 일 추가' }));

    expect(screen.getByRole('dialog', { name: '할 일 추가' })).toBeInTheDocument();
    expect(screen.getByLabelText(/내용/)).toBeInTheDocument();
  });

  it('수정도 같은 창에서 한다', async () => {
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, [TODO]) });
    render(<App />);
    await screen.findByText('수학 문제집');

    await userEvent.setup().click(screen.getByTitle('수정'));

    expect(screen.getByRole('dialog', { name: '할 일 수정' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('수학 문제집')).toBeInTheDocument();
  });
});

describe('App — 할 일 성격', () => {
  const CATEGORY = { id: 'c1', name: '영어', color: 3 };

  it('할 일에 붙은 성격의 이름을 목록에 보여준다', async () => {
    saveSession(SESSION);
    mockApi({
      'GET /todos': () => res(200, [{ ...TODO, category_id: 'c1' }]),
      'GET /categories': () => res(200, [CATEGORY]),
    });
    render(<App />);

    expect(await screen.findByText('영어')).toBeInTheDocument();
  });

  it('넓은 화면 헤더의 성격 관리를 누르면 관리 창이 열린다', async () => {
    saveSession(SESSION);
    mockApi({
      'GET /todos': () => res(200, [TODO]),
      'GET /categories': () => res(200, [CATEGORY]),
    });
    render(<App />);
    await screen.findByText('수학 문제집');

    await userEvent.setup().click(screen.getByRole('button', { name: '성격 관리' }));

    expect(screen.getByRole('dialog', { name: '성격 관리' })).toBeInTheDocument();
  });

  // 칩은 성격 목록만 새로 받아도 사라지지만, 손에 든 할 일이 죽은 id를 계속
  // 들고 있으면 그 할 일을 수정할 때 폼이 그것을 되돌려 보내 서버가 400을 준다.
  it('성격을 지우면 할 일 목록도 다시 받아온다', async () => {
    saveSession(SESSION);
    vi.stubGlobal('confirm', vi.fn(() => true));
    const fetchMock = mockApi({
      'GET /todos': () => res(200, [TODO]),
      'GET /categories': () => res(200, [CATEGORY]),
      'DELETE /categories/c1': () => res(200, { success: true }),
    });
    render(<App />);
    await screen.findByText('수학 문제집');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '성격 관리' }));
    await user.click(screen.getByRole('button', { name: '영어 성격 메뉴' }));

    const todosBefore = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/todos')).length;
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));

    await waitFor(() => {
      const todosAfter = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/todos')).length;
      expect(todosAfter).toBeGreaterThan(todosBefore);
    });
  });

  // 이 기능이 없는 옛 서버는 404를 준다. 곁다리 하나로 화면 전체를 막으면 안 된다.
  it('성격을 받아오지 못해도 할 일 목록은 그대로 보여준다', async () => {
    saveSession(SESSION);
    mockApi({
      'GET /todos': () => res(200, [TODO]),
      'GET /categories': () => res(404, { error: 'not found' }),
    });
    render(<App />);

    expect(await screen.findByText('수학 문제집')).toBeInTheDocument();
    expect(screen.queryByText(/서버에 연결할 수 없습니다/)).not.toBeInTheDocument();
  });

  // 성격 조회가 실패한 화면을 "성격이 하나도 없다"로 읽으면, 할 일을 고칠 때마다
  // 붙어 있던 성격이 조용히 지워진다. 서버가 가드로 막아 둔 사고를 화면이 되살리는 셈이다.
  it('성격을 받아오지 못한 상태에서 할 일을 고쳐도 성격을 지우지 않는다', async () => {
    saveSession(SESSION);
    const fetchMock = mockApi({
      'GET /todos': () => res(200, [{ ...TODO, category_id: 'c1' }]),
      'GET /categories': () => res(500, { error: '서버 오류' }),
      'PUT /todos/t1': () => res(200, { ...TODO, category_id: 'c1' }),
    });
    render(<App />);
    await screen.findByText('수학 문제집');

    const user = userEvent.setup();
    await user.click(screen.getByTitle('수정'));
    await user.click(screen.getByRole('button', { name: '수정 완료' }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, opt]) => opt?.method === 'PUT');
      expect(put).toBeDefined();
      expect(JSON.parse(put[1].body)).not.toHaveProperty('category_id');
    });
  });
});

describe('App — 401 자동 로그아웃', () => {
  it('저장된 토큰이 만료됐으면 로그인 화면으로 돌아가고 세션도 지운다', async () => {
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(401, { error: '로그인이 필요합니다.' }) });

    render(<App />);

    expect(await loginScreen()).toBeInTheDocument();
    expect(loadSession()).toBe(null);
  });

  it('할 일을 고치는 도중 401을 받아도 로그인 화면으로 돌아간다', async () => {
    saveSession(SESSION);
    mockApi({
      'GET /todos':        () => res(200, [TODO]),
      'PUT /perform-date': () => res(401, { error: '로그인이 필요합니다.' }),
    });
    render(<App />);
    await screen.findByText('수학 문제집');

    await userEvent.setup().click(screen.getByTitle('오늘 할 일로 등록'));

    expect(await loginScreen()).toBeInTheDocument();
    expect(loadSession()).toBe(null);
  });

  it('자동 로그아웃은 에러가 아니므로 실패 알림을 띄우지 않는다', async () => {
    saveSession(SESSION);
    mockApi({
      'GET /todos':        () => res(200, [TODO]),
      'PUT /perform-date': () => res(401, { error: '로그인이 필요합니다.' }),
    });
    render(<App />);
    await screen.findByText('수학 문제집');

    await userEvent.setup().click(screen.getByTitle('오늘 할 일로 등록'));
    await loginScreen();

    expect(alertMock).not.toHaveBeenCalled();
  });

  it('정상 응답에는 로그아웃이 일어나지 않는다', async () => {
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, [TODO]) });

    render(<App />);
    await screen.findByText('수학 문제집');

    expect(loadSession()).toEqual(SESSION);
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument();
  });
});

describe('App — 로그인한 상태', () => {
  it('모든 요청에 토큰을 실어 보낸다', async () => {
    saveSession(SESSION);
    const fetchMock = mockApi({ 'GET /todos': () => res(200, []) });

    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe(`Bearer ${SESSION.token}`);
  });

  it('헤더에 로그인한 사람의 이메일을 보여준다', async () => {
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, []) });

    render(<App />);

    expect(await screen.findByText('a@example.com')).toBeInTheDocument();
  });

  it('로그아웃하면 저장된 세션이 지워지고 로그인 화면으로 돌아간다', async () => {
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, [TODO]) });
    render(<App />);
    await screen.findByText('수학 문제집');

    await userEvent.setup().click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await loginScreen()).toBeInTheDocument();
    expect(loadSession()).toBe(null);
  });

  it('로그아웃하면 진행률 확인 모달도 닫힌다', async () => {
    saveSession(SESSION);
    // 수행날짜가 지났는데 진행률이 비어 있으면 앱 시작 시 모달이 뜬다
    mockApi({ 'GET /todos': () => res(200, [{ ...TODO, perform_date: '2020-01-01' }]) });
    render(<App />);
    await screen.findByText('진행률 확인');

    await userEvent.setup().click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await loginScreen()).toBeInTheDocument();
    expect(screen.queryByText('진행률 확인')).not.toBeInTheDocument();
  });

  it('헤더의 비밀번호 변경을 누르면 입력 폼이 열린다', async () => {
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, []) });
    render(<App />);
    await screen.findByText('a@example.com');

    await userEvent.setup().click(screen.getByRole('button', { name: '비밀번호 변경' }));

    expect(await screen.findByLabelText('현재 비밀번호')).toBeInTheDocument();
  });

  it('비밀번호를 바꾸면 새 토큰을 저장하고 로그아웃되지 않는다', async () => {
    saveSession(SESSION);
    const fetchMock = mockApi({
      'GET /todos':      () => res(200, []),
      'PUT /auth/password': () => res(200, { token: 'brand.new.token' }),
    });
    render(<App />);
    await screen.findByText('a@example.com');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    await user.type(await screen.findByLabelText('현재 비밀번호'), 'password1');
    await user.type(screen.getByLabelText('새 비밀번호'), 'newpassword1');
    await user.click(screen.getByRole('button', { name: '변경' }));

    expect(await screen.findByText(/변경되었습니다/)).toBeInTheDocument();
    await waitFor(() => expect(loadSession()?.token).toBe('brand.new.token'));
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument();

    // 바뀐 토큰이 이후 요청에 실려야 한다
    const changeCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/password'));
    expect(changeCall[1].headers.Authorization).toBe(`Bearer ${SESSION.token}`);
  });

  it('넓은 화면에서도 회원 탈퇴 버튼이 헤더에 있다', async () => {
    saveSession(SESSION);
    mockApi({ 'GET /todos': () => res(200, []) });
    render(<App />);
    await screen.findByText('a@example.com');

    await userEvent.setup().click(screen.getByRole('button', { name: '회원 탈퇴' }));

    expect(await screen.findByLabelText('비밀번호 확인')).toBeInTheDocument();
  });

  it('탈퇴하면 세션을 지우고 로그인 화면으로 돌아간다', async () => {
    saveSession(SESSION);
    const fetchMock = mockApi({
      'GET /todos':            () => res(200, [TODO]),
      'DELETE /auth/me':  () => res(200, { ok: true }),
    });
    render(<App />);
    await screen.findByText('수학 문제집');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '회원 탈퇴' }));
    await user.type(await screen.findByLabelText('비밀번호 확인'), 'password1');
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }));

    expect(await loginScreen()).toBeInTheDocument();
    expect(loadSession()).toBe(null);

    const call = fetchMock.mock.calls.find(([url, o]) => o?.method === 'DELETE' && String(url).endsWith('/auth/me'));
    expect(JSON.parse(call[1].body)).toEqual({ password: 'password1' });
    expect(call[1].headers.Authorization).toBe(`Bearer ${SESSION.token}`);
  });

  // 서버가 403을 주는 이유가 여기 있다 — 401이면 authFetch가 세션 만료로 보고 로그아웃시킨다.
  it('비밀번호를 틀리면 로그아웃되지 않고 모달에 오류만 남는다', async () => {
    saveSession(SESSION);
    mockApi({
      'GET /todos':           () => res(200, [TODO]),
      'DELETE /auth/me': () => res(403, { error: '비밀번호가 올바르지 않습니다.' }),
    });
    render(<App />);
    await screen.findByText('수학 문제집');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '회원 탈퇴' }));
    await user.type(await screen.findByLabelText('비밀번호 확인'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }));

    expect(await screen.findByText(/비밀번호가 올바르지 않습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument();
    expect(loadSession()?.token).toBe(SESSION.token);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('로그아웃 뒤 다른 계정으로 로그인하면 그 계정의 목록을 새로 받아온다', async () => {
    saveSession(SESSION);
    const other = { token: 'other.token', user: { id: '2', email: 'b@example.com' } };
    const fetchMock = mockApi({
      'GET /todos':      () => res(200, [TODO]),
      'POST /auth/login': () => res(200, other),
    });
    render(<App />);
    await screen.findByText('수학 문제집');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await loginScreen();

    await user.type(screen.getByLabelText('이메일'), 'b@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'password1');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('b@example.com')).toBeInTheDocument();
    const todoCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/todos'));
    expect(todoCalls).toHaveLength(2);
    expect(todoCalls[1][1].headers.Authorization).toBe('Bearer other.token');
  });
});
