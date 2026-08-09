import { describe, it, expect } from 'vitest';
import {
  validateSubscription, toClockTime, parseReminderTime, shouldSendNow, buildReminder,
} from './push.js';

const INTERVALS = [1, 3, 7, 16, 30];

const validSub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

describe('validateSubscription', () => {
  it('올바른 구독은 endpoint와 키만 추려서 통과시킨다', () => {
    const result = validateSubscription({ ...validSub, expirationTime: null, 쓰레기: 1 });
    expect(result).toEqual({ ok: true, subscription: validSub });
  });

  it('구독 정보가 아예 없으면 거절한다', () => {
    expect(validateSubscription(null).ok).toBe(false);
    expect(validateSubscription('문자열').ok).toBe(false);
  });

  it('https가 아닌 주소는 거절한다', () => {
    const result = validateSubscription({ ...validSub, endpoint: 'http://example.com/push' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('구독 주소가 올바르지 않습니다.');
  });

  it('지나치게 긴 주소는 거절한다', () => {
    const result = validateSubscription({ ...validSub, endpoint: `https://x.com/${'a'.repeat(2000)}` });
    expect(result.ok).toBe(false);
  });

  it('키가 비어 있으면 거절한다', () => {
    expect(validateSubscription({ ...validSub, keys: undefined }).ok).toBe(false);
    expect(validateSubscription({ ...validSub, keys: { p256dh: '', auth: 'a' } }).ok).toBe(false);
    expect(validateSubscription({ ...validSub, keys: { p256dh: 'a' } }).ok).toBe(false);
  });
});

describe('toClockTime', () => {
  it('시와 분을 0을 채워 HH:MM으로 준다', () => {
    expect(toClockTime(new Date(2026, 5, 1, 9, 5))).toBe('09:05');
    expect(toClockTime(new Date(2026, 5, 1, 23, 59))).toBe('23:59');
  });
});

describe('parseReminderTime', () => {
  it('HH:MM 형식이면 그대로 쓴다', () => {
    expect(parseReminderTime('07:30')).toBe('07:30');
  });

  it('형식이 아니면 기본값으로 떨어진다', () => {
    expect(parseReminderTime(undefined)).toBe('09:00');
    expect(parseReminderTime('아홉시')).toBe('09:00');
    expect(parseReminderTime('25:00')).toBe('09:00');
    expect(parseReminderTime('9:00')).toBe('09:00');
  });
});

describe('shouldSendNow', () => {
  const base = { reminderTime: '09:00', lastSentDate: null, today: '2026-06-01' };

  it('지정 시각 전에는 보내지 않는다', () => {
    expect(shouldSendNow({ ...base, nowTime: '08:59' })).toBe(false);
  });

  it('지정 시각이 되면 보낸다', () => {
    expect(shouldSendNow({ ...base, nowTime: '09:00' })).toBe(true);
  });

  it('시각을 조금 놓쳐도 그날 안에는 보낸다 (재시작 대비)', () => {
    expect(shouldSendNow({ ...base, nowTime: '11:20' })).toBe(true);
  });

  it('오늘 이미 보냈으면 다시 보내지 않는다', () => {
    expect(shouldSendNow({ ...base, nowTime: '09:00', lastSentDate: '2026-06-01' })).toBe(false);
  });

  it('어제 보냈으면 오늘 다시 보낸다', () => {
    expect(shouldSendNow({ ...base, nowTime: '09:00', lastSentDate: '2026-05-31' })).toBe(true);
  });
});

describe('buildReminder', () => {
  const today = '2026-06-01';

  it('보낼 것이 없으면 null이다', () => {
    expect(buildReminder([], today, INTERVALS)).toBeNull();
    expect(buildReminder(undefined, today, INTERVALS)).toBeNull();
  });

  it('한 건이면 제목과 단계를 함께 알려준다', () => {
    expect(buildReminder([{ text: '수학 문제집', stage: 2, due_date: today }], today, INTERVALS))
      .toEqual({ title: '오늘 복습 1건', body: '수학 문제집 · 7일차' });
  });

  it('여러 건이면 앞의 둘만 이름으로 적고 나머지는 개수로 센다', () => {
    const items = [
      { text: '수학 문제집', stage: 0, due_date: today },
      { text: '영단어',     stage: 1, due_date: today },
      { text: '한국사',     stage: 0, due_date: today },
    ];
    expect(buildReminder(items, today, INTERVALS))
      .toEqual({ title: '오늘 복습 3건', body: '수학 문제집, 영단어 외 1건' });
  });

  it('마감이 지난 항목이 있으면 몇 건인지 덧붙인다', () => {
    const items = [
      { text: '수학 문제집', stage: 0, due_date: '2026-05-28' },
      { text: '영단어',     stage: 0, due_date: today },
    ];
    expect(buildReminder(items, today, INTERVALS).body)
      .toBe('수학 문제집, 영단어 · 지난 복습 1건 포함');
  });

  it('긴 제목은 줄여서 넣는다', () => {
    const long = '가'.repeat(40);
    const { body } = buildReminder([{ text: long, stage: 0, due_date: today }], today, INTERVALS);
    expect(body).toBe(`${'가'.repeat(19)}… · 1일차`);
  });
});
