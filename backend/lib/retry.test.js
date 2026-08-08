import { describe, it, expect, vi } from 'vitest';
import { nextDelay, connectWithRetry } from './retry.js';

describe('nextDelay', () => {
  it('첫 재시도는 1초를 기다린다', () => {
    expect(nextDelay(0)).toBe(1000);
  });

  it('재시도할 때마다 대기 시간이 2배가 된다', () => {
    expect([0, 1, 2, 3, 4].map(n => nextDelay(n))).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it('대기 시간은 30초를 넘지 않는다', () => {
    expect(nextDelay(5)).toBe(30000);
    expect(nextDelay(20)).toBe(30000);
  });

  it('시작 간격이 상한보다 크면 상한을 넘지 않는다', () => {
    expect(nextDelay(0, { base: 5000, max: 2000 })).toBe(2000);
  });

  it('attempt가 음수여도 시작 간격보다 짧아지지 않는다', () => {
    expect(nextDelay(-1)).toBe(1000);
    expect(nextDelay(-10)).toBe(1000);
  });

  it('시작 간격과 상한을 지정할 수 있다', () => {
    expect(nextDelay(0, { base: 500, max: 2000 })).toBe(500);
    expect(nextDelay(3, { base: 500, max: 2000 })).toBe(2000);
  });
});

describe('connectWithRetry', () => {
  it('첫 시도는 대기 없이 즉시 실행된다', async () => {
    const connect = vi.fn().mockResolvedValue();
    const sleep = vi.fn().mockResolvedValue();

    await connectWithRetry(connect, { sleep });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('연결에 성공하면 더 이상 재시도하지 않는다', async () => {
    const connect = vi.fn()
      .mockRejectedValueOnce(new Error('일시적 실패'))
      .mockResolvedValue();
    const sleep = vi.fn().mockResolvedValue();

    await connectWithRetry(connect, { sleep });

    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('3번 실패 후 성공하면 대기가 정확히 3번, 1초·2초·4초 간격으로 발생한다', async () => {
    const connect = vi.fn()
      .mockRejectedValueOnce(new Error('실패 1'))
      .mockRejectedValueOnce(new Error('실패 2'))
      .mockRejectedValueOnce(new Error('실패 3'))
      .mockResolvedValue();
    const sleep = vi.fn().mockResolvedValue();

    await connectWithRetry(connect, { sleep });

    expect(connect).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
  });

  it('연결 함수가 동기적으로 throw해도 재시도한다', async () => {
    let calls = 0;
    const connect = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw new Error('동기 예외');
      return Promise.resolve();
    });
    const sleep = vi.fn().mockResolvedValue();

    await connectWithRetry(connect, { sleep });

    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('실패할 때마다 onError에 에러와 시도 횟수를 넘긴다', async () => {
    const connect = vi.fn()
      .mockRejectedValueOnce(new Error('실패 1'))
      .mockRejectedValueOnce(new Error('실패 2'))
      .mockResolvedValue();
    const sleep = vi.fn().mockResolvedValue();
    const onError = vi.fn();

    await connectWithRetry(connect, { sleep, onError });

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls.map(([err, attempt]) => [err.message, attempt]))
      .toEqual([['실패 1', 1], ['실패 2', 2]]);
  });

  it('재시도 상한을 지정하면 그만큼만 시도하고 마지막 에러를 던진다', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('계속 실패'));
    const sleep = vi.fn().mockResolvedValue();

    await expect(connectWithRetry(connect, { sleep, maxAttempts: 3 }))
      .rejects.toThrow('계속 실패');
    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('연결에 성공하면 connect가 돌려준 값을 그대로 반환한다', async () => {
    const conn = { name: 'studytodo' };
    const connect = vi.fn().mockResolvedValue(conn);
    const sleep = vi.fn().mockResolvedValue();

    await expect(connectWithRetry(connect, { sleep })).resolves.toBe(conn);
  });

  it('재시도 상한이 1이면 대기 없이 한 번만 시도하고 에러를 던진다', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('한 번만'));
    const sleep = vi.fn().mockResolvedValue();

    await expect(connectWithRetry(connect, { sleep, maxAttempts: 1 }))
      .rejects.toThrow('한 번만');
    expect(connect).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('onError가 예외를 던져도 재시도를 멈추지 않는다', async () => {
    const connect = vi.fn()
      .mockRejectedValueOnce(new Error('연결 실패'))
      .mockResolvedValue();
    const sleep = vi.fn().mockResolvedValue();
    const onError = vi.fn(() => { throw new Error('로그 기록 실패'); });

    await connectWithRetry(connect, { sleep, onError });

    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('sleep을 주지 않아도 실제 타이머로 재시도한다', async () => {
    const connect = vi.fn()
      .mockRejectedValueOnce(new Error('연결 실패'))
      .mockResolvedValue();

    await connectWithRetry(connect, { base: 1, max: 1 });

    expect(connect).toHaveBeenCalledTimes(2);
  });
});
