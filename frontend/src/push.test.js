import { describe, it, expect, afterEach, vi } from 'vitest';
import { urlBase64ToUint8Array, isPushSupported, isStandalone, isIos, permissionState } from './push.js';

afterEach(() => vi.unstubAllGlobals());

describe('urlBase64ToUint8Array', () => {
  it('base64url 문자열을 바이트 배열로 푼다', () => {
    // 'Hello' → SGVsbG8
    expect([...urlBase64ToUint8Array('SGVsbG8')]).toEqual([72, 101, 108, 108, 111]);
  });

  it('길이가 4의 배수가 아니어도 패딩을 채워 푼다', () => {
    expect(urlBase64ToUint8Array('SGVsbG8')).toBeInstanceOf(Uint8Array);
    expect(urlBase64ToUint8Array('SGk')).toHaveLength(2);
  });

  it('base64url의 - 와 _ 를 원래 문자로 되돌린다', () => {
    // '-_' 는 표준 base64의 '+/' 다
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });
});

describe('isPushSupported', () => {
  it('jsdom처럼 서비스 워커도 Notification도 없으면 false다', () => {
    expect(isPushSupported()).toBe(false);
  });

  it('필요한 것이 모두 있으면 true다', () => {
    vi.stubGlobal('navigator', { serviceWorker: {} });
    vi.stubGlobal('window', { PushManager: function () {}, Notification: function () {} });

    expect(isPushSupported()).toBe(true);
  });

  it('하나라도 없으면 false다', () => {
    vi.stubGlobal('navigator', { serviceWorker: {} });
    vi.stubGlobal('window', { PushManager: function () {} });   // Notification 없음

    expect(isPushSupported()).toBe(false);
  });
});

describe('permissionState', () => {
  it('지원하지 않는 환경에서는 null이다', () => {
    expect(permissionState()).toBeNull();
  });

  it('지원하면 브라우저가 말하는 권한 상태를 그대로 준다', () => {
    vi.stubGlobal('navigator', { serviceWorker: {} });
    vi.stubGlobal('Notification', { permission: 'denied' });
    vi.stubGlobal('window', { PushManager: function () {}, Notification: { permission: 'denied' } });

    expect(permissionState()).toBe('denied');
  });
});

describe('isStandalone', () => {
  it('설치형으로 실행 중이면 true다', () => {
    vi.stubGlobal('window', {
      matchMedia: (q) => ({ matches: q.includes('standalone') }),
    });

    expect(isStandalone()).toBe(true);
  });

  it('브라우저 탭에서는 false다', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

    expect(isStandalone()).toBe(false);
  });
});

describe('isIos', () => {
  it('아이폰을 알아본다', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' });

    expect(isIos()).toBe(true);
  });

  it('자신을 Mac이라 소개하는 아이패드도 알아본다', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', maxTouchPoints: 5 });

    expect(isIos()).toBe(true);
  });

  it('진짜 맥은 아니다', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', maxTouchPoints: 0 });

    expect(isIos()).toBe(false);
  });
});
