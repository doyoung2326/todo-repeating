import { describe, it, expect } from 'vitest';
import { resolveApiUrl } from './apiUrl.js';

describe('resolveApiUrl - 프로덕션 빌드', () => {
  it('VITE_API_URL이 없으면 빌드를 중단시킨다', () => {
    expect(() => resolveApiUrl({}, 'production')).toThrow(/VITE_API_URL/);
  });

  it('VITE_API_URL이 빈 문자열이어도 빌드를 중단시킨다', () => {
    expect(() => resolveApiUrl({ VITE_API_URL: '' }, 'production')).toThrow(/VITE_API_URL/);
  });

  it('상대 경로면 빌드를 중단시킨다', () => {
    expect(() => resolveApiUrl({ VITE_API_URL: '/api' }, 'production'))
      .toThrow(/절대 URL/);
  });

  it('절대 URL이면 그대로 돌려준다', () => {
    expect(resolveApiUrl({ VITE_API_URL: 'https://api.example.com/api' }, 'production'))
      .toBe('https://api.example.com/api');
  });

  it('에러 메시지에 어디에 무엇을 설정해야 하는지 담는다', () => {
    expect(() => resolveApiUrl({}, 'production')).toThrow(/Vercel/);
  });
});

describe('resolveApiUrl - 개발 환경', () => {
  it('VITE_API_URL이 없으면 같은 도메인의 /api로 폴백한다', () => {
    expect(resolveApiUrl({}, 'development')).toBe('/api');
  });

  it('VITE_API_URL이 있으면 그 값을 쓴다', () => {
    expect(resolveApiUrl({ VITE_API_URL: 'http://localhost:3001/api' }, 'development'))
      .toBe('http://localhost:3001/api');
  });

  it('상대 경로를 줘도 개발 환경에서는 막지 않는다', () => {
    expect(resolveApiUrl({ VITE_API_URL: '/api' }, 'development')).toBe('/api');
  });
});
