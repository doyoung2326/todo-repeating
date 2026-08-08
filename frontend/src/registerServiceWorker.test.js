import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { watchForUpdate, applyUpdate } from './registerServiceWorker';

/**
 * navigator.serviceWorker를 흉내낸다.
 * controlled: 이미 워커가 화면을 잡고 있는가(= 캐시에서 뜬 화면인가)
 */
function fakeServiceWorker({ controlled = true, waiting = null } = {}) {
  const regListeners = {};
  const swListeners = {};

  const registration = {
    waiting,
    installing: null,
    addEventListener: (type, fn) => { regListeners[type] = fn; },
    removeEventListener: () => {},
  };

  const container = {
    controller: controlled ? {} : null,
    register: vi.fn(async () => registration),
    addEventListener: (type, fn) => { swListeners[type] = fn; },
  };

  vi.stubGlobal('navigator', { serviceWorker: container });

  const reload = vi.fn();
  vi.stubGlobal('window', { location: { reload } });

  return {
    registration,
    reload,
    /** 새 워커가 설치되는 과정을 재생한다 */
    installNewWorker() {
      const stateListeners = {};
      const worker = {
        state: 'installing',
        postMessage: vi.fn(),
        addEventListener: (type, fn) => { stateListeners[type] = fn; },
        removeEventListener: () => {},
      };
      registration.installing = worker;
      regListeners.updatefound?.();
      worker.state = 'installed';
      stateListeners.statechange?.();
      return worker;
    },
    takeControl: () => swListeners.controllerchange?.(),
  };
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('watchForUpdate', () => {
  it('새 워커가 설치되면 알려준다', async () => {
    const sw = fakeServiceWorker({ controlled: true });
    const onReady = vi.fn();

    watchForUpdate(onReady);
    await Promise.resolve();               // register()의 then을 흘려보낸다
    const worker = sw.installNewWorker();

    expect(onReady).toHaveBeenCalledWith(worker);
  });

  it('첫 설치는 알리지 않는다 — 지금 화면이 이미 최신이다', async () => {
    const sw = fakeServiceWorker({ controlled: false });
    const onReady = vi.fn();

    watchForUpdate(onReady);
    await Promise.resolve();
    sw.installNewWorker();

    expect(onReady).not.toHaveBeenCalled();
  });

  it('지난번에 안내를 닫아 이미 기다리는 워커가 있으면 다시 알린다', async () => {
    const waiting = { postMessage: vi.fn() };
    fakeServiceWorker({ controlled: true, waiting });
    const onReady = vi.fn();

    watchForUpdate(onReady);
    await Promise.resolve();

    expect(onReady).toHaveBeenCalledWith(waiting);
  });

  it('정리한 뒤에는 알리지 않는다', async () => {
    const sw = fakeServiceWorker({ controlled: true });
    const onReady = vi.fn();

    const stop = watchForUpdate(onReady);
    await Promise.resolve();
    stop();
    sw.installNewWorker();

    expect(onReady).not.toHaveBeenCalled();
  });

  it('서비스 워커를 쓸 수 없는 환경에서는 아무것도 하지 않는다', () => {
    vi.stubGlobal('navigator', {});

    expect(() => watchForUpdate(vi.fn())()).not.toThrow();
  });
});

describe('applyUpdate', () => {
  it('대기 중인 워커에게 자리를 넘겨받으라고 하고, 넘겨받으면 화면을 다시 읽는다', () => {
    const sw = fakeServiceWorker({ controlled: true });
    const worker = { postMessage: vi.fn() };

    applyUpdate(worker);

    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(sw.reload).not.toHaveBeenCalled();   // 아직 넘겨받기 전

    sw.takeControl();
    expect(sw.reload).toHaveBeenCalledTimes(1);
  });

  it('교체 알림이 여러 번 와도 한 번만 다시 읽는다', () => {
    const sw = fakeServiceWorker({ controlled: true });

    applyUpdate({ postMessage: vi.fn() });
    sw.takeControl();
    sw.takeControl();

    expect(sw.reload).toHaveBeenCalledTimes(1);
  });
});
