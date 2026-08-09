import { describe, it, expect } from 'vitest';
import { normalizeSession, parseSession, serializeSession } from './session.js';

const VALID = { token: 'abc.def.ghi', user: { id: '1', email: 'user@example.com' } };

describe('normalizeSession', () => {
  it('올바른 세션 객체를 그대로 돌려준다', () => {
    expect(normalizeSession(VALID)).toEqual(VALID);
  });

  it('토큰이 없거나 문자열이 아니면 null을 준다', () => {
    expect(normalizeSession({ user: VALID.user })).toBe(null);
    expect(normalizeSession({ token: '', user: VALID.user })).toBe(null);
    expect(normalizeSession({ token: 123, user: VALID.user })).toBe(null);
  });

  it('사용자 이메일이 없으면 null을 준다', () => {
    expect(normalizeSession({ token: 'abc' })).toBe(null);
    expect(normalizeSession({ token: 'abc', user: {} })).toBe(null);
  });

  it('값이 아예 없어도 예외 대신 null을 준다', () => {
    expect(normalizeSession(null)).toBe(null);
    expect(normalizeSession(undefined)).toBe(null);
  });

  it('알 수 없는 필드는 버린다', () => {
    expect(normalizeSession({ ...VALID, isAdmin: true })).toEqual(VALID);
  });
});

describe('parseSession', () => {
  it('올바른 세션 JSON을 그대로 되돌린다', () => {
    expect(parseSession(JSON.stringify(VALID))).toEqual(VALID);
  });

  it('저장된 값이 없으면 null을 준다', () => {
    expect(parseSession(null)).toBe(null);
    expect(parseSession('')).toBe(null);
  });

  it('JSON이 깨져 있으면 예외 대신 null을 준다', () => {
    expect(parseSession('{ 망가진')).toBe(null);
  });

  it('토큰이 없거나 문자열이 아니면 null을 준다', () => {
    expect(parseSession(JSON.stringify({ user: VALID.user }))).toBe(null);
    expect(parseSession(JSON.stringify({ token: '', user: VALID.user }))).toBe(null);
    expect(parseSession(JSON.stringify({ token: 123, user: VALID.user }))).toBe(null);
  });

  it('사용자 이메일이 없으면 null을 준다', () => {
    expect(parseSession(JSON.stringify({ token: 'abc' }))).toBe(null);
    expect(parseSession(JSON.stringify({ token: 'abc', user: {} }))).toBe(null);
  });

  it('알 수 없는 필드는 버리고 토큰과 사용자만 남긴다', () => {
    const raw = JSON.stringify({ ...VALID, isAdmin: true });
    expect(parseSession(raw)).toEqual(VALID);
  });
});

describe('serializeSession', () => {
  it('저장했다가 다시 읽으면 같은 세션이 된다', () => {
    expect(parseSession(serializeSession(VALID))).toEqual(VALID);
  });
});
