import { describe, it, expect } from 'vitest';
import { validateCategory, MAX_NAME_LENGTH, COLOR_SLOTS } from './categories.js';

describe('validateCategory — 이름', () => {
  it('이름이 없으면 이유를 알려주고 거절한다', () => {
    const result = validateCategory({ color: 1 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/이름/);
  });

  it('공백뿐인 이름은 빈 이름으로 본다', () => {
    expect(validateCategory({ name: '   ' }).ok).toBe(false);
  });

  it('문자열이 아닌 이름은 거절한다', () => {
    expect(validateCategory({ name: 3 }).ok).toBe(false);
    expect(validateCategory({ name: null }).ok).toBe(false);
  });

  it('이름 앞뒤 공백은 떼고 받는다', () => {
    expect(validateCategory({ name: '  영어  ' })).toMatchObject({ ok: true, name: '영어' });
  });

  // 경계는 바깥쪽까지 본다 — 12자만 보면 조건이 <= 13으로 넓어져도 통과한다
  it(`이름이 ${MAX_NAME_LENGTH}자면 받고 ${MAX_NAME_LENGTH + 1}자면 거절한다`, () => {
    expect(validateCategory({ name: '가'.repeat(MAX_NAME_LENGTH) }).ok).toBe(true);
    expect(validateCategory({ name: '가'.repeat(MAX_NAME_LENGTH + 1) }).ok).toBe(false);
  });

  it('길이는 공백을 떼고 잰다', () => {
    expect(validateCategory({ name: ` ${'가'.repeat(MAX_NAME_LENGTH)} ` }).ok).toBe(true);
  });
});

describe('validateCategory — 색', () => {
  it('색을 주지 않으면 첫 칸으로 본다', () => {
    expect(validateCategory({ name: '영어' })).toMatchObject({ ok: true, color: 1 });
  });

  it(`색은 1과 ${COLOR_SLOTS}을 받고 0과 ${COLOR_SLOTS + 1}은 거절한다`, () => {
    expect(validateCategory({ name: '영어', color: 1 }).ok).toBe(true);
    expect(validateCategory({ name: '영어', color: COLOR_SLOTS }).ok).toBe(true);
    expect(validateCategory({ name: '영어', color: 0 }).ok).toBe(false);
    expect(validateCategory({ name: '영어', color: COLOR_SLOTS + 1 }).ok).toBe(false);
  });

  it('폼이 보내는 문자열 색도 숫자로 받는다', () => {
    expect(validateCategory({ name: '영어', color: '3' })).toMatchObject({ ok: true, color: 3 });
  });

  it('정수가 아닌 색은 거절한다', () => {
    expect(validateCategory({ name: '영어', color: 1.5 }).ok).toBe(false);
    expect(validateCategory({ name: '영어', color: '삼' }).ok).toBe(false);
  });

  // Number(null)은 0, Number(true)는 1이라 그냥 Number를 태우면 조용히 새어 들어온다
  it('null과 참거짓은 색으로 받지 않는다', () => {
    expect(validateCategory({ name: '영어', color: null }).ok).toBe(false);
    expect(validateCategory({ name: '영어', color: true }).ok).toBe(false);
    expect(validateCategory({ name: '영어', color: '' }).ok).toBe(false);
  });
});
