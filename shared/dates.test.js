import { describe, it, expect } from 'vitest';
import { localToday, msUntilMidnight, daysDiff, formatKoreanDate } from './dates.js';

describe('localToday', () => {
  it('기기 시계의 날짜를 YYYY-MM-DD로 준다', () => {
    expect(localToday(new Date(2026, 7, 9, 13, 30))).toBe('2026-08-09');
  });

  it('한 자리 월·일에 0을 채운다', () => {
    expect(localToday(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });

  it('UTC가 아니라 로컬 시간대로 읽는다', () => {
    // 로컬 23시 50분은 시간대에 따라 UTC로는 다음 날이지만, 사용자에게는 아직 오늘이다.
    expect(localToday(new Date(2026, 7, 9, 23, 50))).toBe('2026-08-09');
  });
});

describe('msUntilMidnight', () => {
  it('다음 자정까지 남은 시간을 준다 (1초 여유 포함)', () => {
    const now = new Date(2026, 7, 9, 23, 0, 0);
    expect(msUntilMidnight(now)).toBe(60 * 60 * 1000 + 1000);
  });

  it('자정 직후에는 거의 하루가 남는다', () => {
    const now = new Date(2026, 7, 9, 0, 0, 0);
    expect(msUntilMidnight(now)).toBe(24 * 60 * 60 * 1000 + 1000);
  });

  it('항상 양수다 — 0을 주면 타이머가 폭주한다', () => {
    expect(msUntilMidnight(new Date(2026, 7, 9, 23, 59, 59))).toBeGreaterThan(0);
  });
});

describe('daysDiff', () => {
  it('미래가 양수다', () => {
    expect(daysDiff('2026-08-11', '2026-08-09')).toBe(2);
  });

  it('지난 날은 음수다', () => {
    expect(daysDiff('2026-08-07', '2026-08-09')).toBe(-2);
  });

  it('같은 날은 0이다', () => {
    expect(daysDiff('2026-08-09', '2026-08-09')).toBe(0);
  });

  it('서머타임이 끼어 있어도 하루를 잃지 않는다 (반올림)', () => {
    expect(daysDiff('2026-04-01', '2026-03-01')).toBe(31);
  });
});

describe('formatKoreanDate', () => {
  it('요일까지 붙여 읽어준다', () => {
    expect(formatKoreanDate('2026-08-09')).toBe('8월 9일 일요일');
  });

  it('날짜가 아니면 빈 문자열을 준다 — 화면에 Invalid Date를 적지 않는다', () => {
    expect(formatKoreanDate('아무말')).toBe('');
    expect(formatKoreanDate('')).toBe('');
  });
});
