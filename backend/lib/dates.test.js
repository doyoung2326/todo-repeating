import { describe, it, expect } from 'vitest';
import { addDays, daysDiff, localDate, toDateStr } from './dates.js';

describe('toDateStr', () => {
  it('한 자리 월/일도 0을 채워 YYYY-MM-DD로 만든다', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('같은 달 안에서 날짜를 더한다', () => {
    expect(addDays('2026-03-10', 3)).toBe('2026-03-13');
  });

  it('달을 넘어가면 다음 달로 넘어간다', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('해를 넘어가면 다음 해로 넘어간다', () => {
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('윤년 2월 29일을 건너뛰지 않는다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('복습 주기(1, 3, 7, 16, 30일)를 모두 계산한다', () => {
    expect([1, 3, 7, 16, 30].map(n => addDays('2026-06-01', n)))
      .toEqual(['2026-06-02', '2026-06-04', '2026-06-08', '2026-06-17', '2026-07-01']);
  });
});

describe('daysDiff', () => {
  it('앞으로 남은 날은 양수로 준다', () => {
    expect(daysDiff('2026-06-01', '2026-06-04')).toBe(3);
  });

  it('이미 지난 날은 음수로 준다', () => {
    expect(daysDiff('2026-06-04', '2026-06-01')).toBe(-3);
  });

  it('같은 날은 0이다', () => {
    expect(daysDiff('2026-06-01', '2026-06-01')).toBe(0);
  });

  it('달과 해를 넘어가도 일수로 센다', () => {
    expect(daysDiff('2026-12-28', '2027-01-04')).toBe(7);
  });

  it('서머타임이 있는 구간에서도 하루를 잃지 않는다', () => {
    expect(daysDiff('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysDiff('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('localDate', () => {
  it('오늘 날짜를 YYYY-MM-DD 형식으로 준다', () => {
    expect(localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
