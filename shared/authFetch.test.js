import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAuthFetch, SessionExpiredError } from './authFetch.js';

const res = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function mockFetch(impl) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const build = (token = 'tok.en.abc', onUnauthorized = vi.fn()) =>
  ({ authFetch: createAuthFetch({ token, onUnauthorized }), onUnauthorized });

describe('createAuthFetch', () => {
  it('토큰을 Bearer 헤더로 실어 보낸다', async () => {
    const fetchMock = mockFetch(async () => res(200));
    const { authFetch } = build();

    await authFetch('/api/todos');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok.en.abc');
  });

  it('토큰이 없으면 Authorization 헤더를 붙이지 않는다', async () => {
    const fetchMock = mockFetch(async () => res(200));
    const { authFetch } = build(null);

    await authFetch('/api/todos');

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('JSON 본문을 기본으로 하되 호출부가 헤더를 덮어쓸 수 있다', async () => {
    const fetchMock = mockFetch(async () => res(200));
    const { authFetch } = build();

    await authFetch('/api/todos', { headers: { 'Content-Type': 'text/plain' } });

    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('text/plain');
  });

  it('method와 body를 그대로 전달한다', async () => {
    const fetchMock = mockFetch(async () => res(200));
    const { authFetch } = build();

    await authFetch('/api/todos', { method: 'POST', body: '{"text":"수학"}' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe('{"text":"수학"}');
  });

  it('401이면 onUnauthorized를 부르고 SessionExpiredError를 던진다', async () => {
    mockFetch(async () => res(401, { error: '로그인이 필요합니다.' }));
    const { authFetch, onUnauthorized } = build();

    await expect(authFetch('/api/todos')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('401이 아닌 실패 응답은 그대로 돌려준다 (호출부가 판단한다)', async () => {
    mockFetch(async () => res(404, { error: 'not found' }));
    const { authFetch, onUnauthorized } = build();

    const result = await authFetch('/api/todos/없는것');

    expect(result.status).toBe(404);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('정상 응답에는 onUnauthorized를 부르지 않는다', async () => {
    mockFetch(async () => res(200));
    const { authFetch, onUnauthorized } = build();

    await authFetch('/api/todos');

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('네트워크 오류는 SessionExpiredError로 둔갑시키지 않는다', async () => {
    mockFetch(async () => { throw new TypeError('Failed to fetch'); });
    const { authFetch, onUnauthorized } = build();

    await expect(authFetch('/api/todos')).rejects.toBeInstanceOf(TypeError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
