import { describe, it, expect } from 'vitest';
import { resolveApiUrl } from './apiUrl.js';

const HINT = '어딘가에 API 주소를 등록하세요.';
const prod = (url) => resolveApiUrl({ url, isProd: true, setupHint: HINT });
const dev  = (url) => resolveApiUrl({ url, isProd: false, setupHint: HINT });

describe('resolveApiUrl - 프로덕션 빌드', () => {
  it('값이 없으면 빌드를 중단시킨다', () => {
    expect(() => prod(undefined)).toThrow(/API 주소가 필요합니다/);
  });

  it('빈 문자열이어도 빌드를 중단시킨다', () => {
    expect(() => prod('')).toThrow(/API 주소가 필요합니다/);
  });

  it('상대 경로면 빌드를 중단시킨다', () => {
    expect(() => prod('/api')).toThrow(/절대 URL/);
  });

  it('절대 URL이면 그대로 돌려준다', () => {
    expect(prod('https://api.example.com/api')).toBe('https://api.example.com/api');
  });

  it('에러 메시지에 플랫폼별 안내를 그대로 담는다', () => {
    // 등록하는 곳이 Vercel인지 EAS인지는 호출부만 안다.
    expect(() => prod(undefined)).toThrow(HINT);
    expect(() => prod('/api')).toThrow(HINT);
  });
});

describe('resolveApiUrl - 개발 환경', () => {
  it('값이 없으면 기본값으로 폴백한다', () => {
    expect(dev(undefined)).toBe('/api');
  });

  it('기본값은 호출부가 정한다', () => {
    expect(resolveApiUrl({ url: undefined, isProd: false, setupHint: HINT, fallback: 'http://10.0.2.2:3001/api' }))
      .toBe('http://10.0.2.2:3001/api');
  });

  it('값이 있으면 그 값을 쓴다', () => {
    expect(dev('http://localhost:3001/api')).toBe('http://localhost:3001/api');
  });

  it('상대 경로를 줘도 개발 환경에서는 막지 않는다', () => {
    expect(dev('/api')).toBe('/api');
  });
});
