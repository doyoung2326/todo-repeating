import { describe, it, expect, beforeEach } from 'vitest';
import { loadSession, saveSession, clearSession, STORAGE_KEY } from './session.js';

// 세션의 "형태"에 관한 규칙(normalizeSession·parseSession)은 shared/session.test.js에 있다.
// 여기서 보는 것은 localStorage라는 보관 장소에 관한 것뿐이다.

const VALID = { token: 'abc.def.ghi', user: { id: '1', email: 'user@example.com' } };

describe('loadSession / saveSession / clearSession', () => {
  beforeEach(() => localStorage.clear());

  it('저장한 세션을 다시 읽어온다', () => {
    saveSession(VALID);
    expect(loadSession()).toEqual(VALID);
  });

  it('저장된 것이 없으면 null을 준다', () => {
    expect(loadSession()).toBe(null);
  });

  it('지우고 나면 다시 읽히지 않는다', () => {
    saveSession(VALID);
    clearSession();
    expect(loadSession()).toBe(null);
  });

  it('누군가 저장값을 손으로 망가뜨려도 null로 처리한다', () => {
    localStorage.setItem(STORAGE_KEY, '아무말');
    expect(loadSession()).toBe(null);
  });

  it('localStorage를 쓸 수 없는 환경에서도 예외를 던지지 않는다', () => {
    const blocked = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    };
    expect(loadSession(blocked)).toBe(null);
    expect(() => saveSession(VALID, blocked)).not.toThrow();
    expect(() => clearSession(blocked)).not.toThrow();
  });
});
