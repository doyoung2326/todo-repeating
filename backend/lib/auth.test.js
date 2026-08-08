import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  validateCredentials,
  validatePassword,
  signToken,
  verifyToken,
  extractBearerToken,
} from './auth.js';

const SECRET = 'test-secret';

describe('normalizeEmail', () => {
  it('앞뒤 공백을 없애고 소문자로 바꾼다', () => {
    expect(normalizeEmail('  Kim@Example.COM ')).toBe('kim@example.com');
  });

  it('문자열이 아니면 빈 문자열을 준다', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(123)).toBe('');
  });
});

describe('validateCredentials', () => {
  it('올바른 입력이면 정규화된 이메일과 함께 통과시킨다', () => {
    expect(validateCredentials(' USER@Example.com ', 'password1')).toEqual({
      ok: true,
      email: 'user@example.com',
    });
  });

  it('이메일이 비어 있으면 거절한다', () => {
    expect(validateCredentials('   ', 'password1').ok).toBe(false);
  });

  it('@나 도메인이 없는 이메일을 거절한다', () => {
    expect(validateCredentials('user', 'password1').ok).toBe(false);
    expect(validateCredentials('user@localhost', 'password1').ok).toBe(false);
  });

  it('비밀번호가 없으면 거절한다', () => {
    expect(validateCredentials('user@example.com', '').ok).toBe(false);
    expect(validateCredentials('user@example.com', undefined).ok).toBe(false);
  });

  it('비밀번호가 8자 미만이면 거절한다', () => {
    expect(validateCredentials('user@example.com', '1234567').ok).toBe(false);
    expect(validateCredentials('user@example.com', '12345678').ok).toBe(true);
  });

  it('거절할 때는 이유를 한국어 메시지로 알려준다', () => {
    expect(validateCredentials('user@example.com', 'short').error).toContain('8자');
  });
});

describe('validatePassword', () => {
  it('8자 이상이면 통과시킨다', () => {
    expect(validatePassword('12345678')).toEqual({ ok: true });
  });

  it('8자 미만이면 거절하고 이유를 알려준다', () => {
    const result = validatePassword('1234567');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('8자');
  });

  it('비어 있거나 문자열이 아니면 거절한다', () => {
    expect(validatePassword('').ok).toBe(false);
    expect(validatePassword(undefined).ok).toBe(false);
    expect(validatePassword(12345678).ok).toBe(false);
  });
});

describe('signToken / verifyToken', () => {
  it('발급한 토큰에서 같은 사용자 id를 다시 꺼낸다', () => {
    const token = signToken('507f1f77bcf86cd799439011', SECRET);
    expect(verifyToken(token, SECRET).sub).toBe('507f1f77bcf86cd799439011');
  });

  it('토큰 버전을 함께 담아 그대로 돌려준다', () => {
    const token = signToken('abc', SECRET, { version: 3 });
    expect(verifyToken(token, SECRET).ver).toBe(3);
  });

  it('버전을 주지 않으면 0으로 발급한다', () => {
    expect(verifyToken(signToken('abc', SECRET), SECRET).ver).toBe(0);
  });

  it('다른 비밀키로 검증하면 null을 준다', () => {
    const token = signToken('abc', SECRET);
    expect(verifyToken(token, 'other-secret')).toBe(null);
  });

  it('토큰이 망가졌거나 비어 있으면 예외 대신 null을 준다', () => {
    expect(verifyToken('not-a-token', SECRET)).toBe(null);
    expect(verifyToken('', SECRET)).toBe(null);
    expect(verifyToken(undefined, SECRET)).toBe(null);
  });

  it('만료된 토큰은 거절한다', () => {
    const token = signToken('abc', SECRET, { expiresIn: '-1s' });
    expect(verifyToken(token, SECRET)).toBe(null);
  });
});

describe('extractBearerToken', () => {
  it('Bearer 헤더에서 토큰만 꺼낸다', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('Bearer 대소문자를 가리지 않는다', () => {
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it('헤더가 없거나 형식이 다르면 null을 준다', () => {
    expect(extractBearerToken(undefined)).toBe(null);
    expect(extractBearerToken('')).toBe(null);
    expect(extractBearerToken('abc')).toBe(null);
    expect(extractBearerToken('Basic abc')).toBe(null);
    expect(extractBearerToken('Bearer')).toBe(null);
  });
});
