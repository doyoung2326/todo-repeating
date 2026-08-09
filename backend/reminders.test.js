// 리마인더 잡 테스트. 실제 발송 대신 가짜 send를 주입해서 "누구에게 무엇을 보내려 했는지"만 본다.
process.env.JWT_SECRET = 'test-secret';
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Todo, Review, PushSubscription } from './app.js';
import { runReminderTick } from './reminders.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Todo.deleteMany({}), Review.deleteMany({}), PushSubscription.deleteMany({}),
  ]);
});

// 2026-06-01 오전 9시 (로컬)
const NINE_AM = new Date(2026, 5, 1, 9, 0);
const TODAY = '2026-06-01';

/** 알림을 켠 사용자 하나와, 마감된 복습 하나를 만든다. */
async function seedUser(email, { due_date = TODAY, stage = 0, text = '수학 문제집' } = {}) {
  const user = await User.create({ email, password_hash: 'x', created_at: TODAY });
  const todo = await Todo.create({ userId: user._id, text, needs_review: 1, completed: 1, created_at: TODAY });
  await Review.create({ userId: user._id, todoId: todo._id, stage, due_date, completed: 0 });
  const sub = await PushSubscription.create({
    userId: user._id,
    endpoint: `https://fcm.googleapis.com/fcm/send/${email}`,
    keys: { p256dh: 'p', auth: 'a' },
    created_at: TODAY,
  });
  return { user, todo, sub };
}

const okSend = () => vi.fn(async () => ({ ok: true }));

describe('runReminderTick', () => {
  it('마감된 복습이 있는 사용자에게 오늘 복습 요약을 보낸다', async () => {
    await seedUser('a@example.com');
    const send = okSend();

    const result = await runReminderTick({ now: NINE_AM, send });

    expect(result.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const [subscription, payload] = send.mock.calls[0];
    expect(subscription.endpoint).toContain('a@example.com');
    expect(payload).toEqual({ title: '오늘 복습 1건', body: '수학 문제집 · 1일차' });
  });

  it('알림 시각 전에는 보내지 않는다', async () => {
    await seedUser('a@example.com');
    const send = okSend();

    const result = await runReminderTick({ now: new Date(2026, 5, 1, 8, 30), send });

    expect(result.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('같은 날 두 번 돌아도 한 번만 보낸다', async () => {
    await seedUser('a@example.com');
    const send = okSend();

    await runReminderTick({ now: NINE_AM, send });
    const second = await runReminderTick({ now: new Date(2026, 5, 1, 12, 0), send });

    expect(second.sent).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('다음 날이 되면 다시 보낸다', async () => {
    await seedUser('a@example.com');
    const send = okSend();

    await runReminderTick({ now: NINE_AM, send });
    const nextDay = await runReminderTick({ now: new Date(2026, 5, 2, 9, 0), send });

    expect(nextDay.sent).toBe(1);
  });

  it('--force는 시각과 "오늘 이미 보냄" 표시를 무시한다', async () => {
    await seedUser('a@example.com');
    const send = okSend();

    await runReminderTick({ now: NINE_AM, send });
    const forced = await runReminderTick({ now: new Date(2026, 5, 1, 3, 0), send, force: true });

    expect(forced.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('마감이 아직 남은 복습만 있으면 아무에게도 보내지 않는다', async () => {
    await seedUser('a@example.com', { due_date: '2026-06-10' });
    const send = okSend();

    expect((await runReminderTick({ now: NINE_AM, send })).sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('지난 복습은 몇 건인지 함께 알려준다', async () => {
    const { user } = await seedUser('a@example.com', { due_date: '2026-05-20' });
    const other = await Todo.create({ userId: user._id, text: '영단어', needs_review: 1, completed: 1, created_at: TODAY });
    await Review.create({ userId: user._id, todoId: other._id, stage: 0, due_date: TODAY, completed: 0 });
    const send = okSend();

    await runReminderTick({ now: NINE_AM, send });

    const [, payload] = send.mock.calls[0];
    expect(payload.title).toBe('오늘 복습 2건');
    expect(payload.body).toContain('지난 복습 1건 포함');
  });

  it('다른 사용자의 복습을 남의 알림에 섞지 않는다', async () => {
    await seedUser('a@example.com', { text: 'A의 할 일' });
    await seedUser('b@example.com', { text: 'B의 할 일' });
    const send = okSend();

    await runReminderTick({ now: NINE_AM, send });

    expect(send).toHaveBeenCalledTimes(2);
    for (const [subscription, payload] of send.mock.calls) {
      const who = subscription.endpoint.includes('a@example.com') ? 'A' : 'B';
      expect(payload.body).toContain(`${who}의 할 일`);
    }
  });

  it('할 일이 지워진 복습은 건너뛴다', async () => {
    const { todo } = await seedUser('a@example.com');
    await Todo.deleteOne({ _id: todo._id });
    const send = okSend();

    expect((await runReminderTick({ now: NINE_AM, send })).sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('만료된 구독은 지운다', async () => {
    await seedUser('a@example.com');
    const send = vi.fn(async () => ({ gone: true }));

    const result = await runReminderTick({ now: NINE_AM, send });

    expect(result).toEqual({ sent: 0, removed: 1 });
    expect(await PushSubscription.countDocuments()).toBe(0);
  });

  it('일시적인 실패는 표시를 남기지 않아 다음에 다시 시도한다', async () => {
    await seedUser('a@example.com');
    const failing = vi.fn(async () => ({ ok: false, error: '일시 오류' }));

    await runReminderTick({ now: NINE_AM, send: failing });

    const sub = await PushSubscription.findOne();
    expect(sub.last_sent_date).toBeNull();

    const send = okSend();
    expect((await runReminderTick({ now: NINE_AM, send })).sent).toBe(1);
  });

  it('알림을 켜지 않은 사용자에게는 아무것도 하지 않는다', async () => {
    const { sub } = await seedUser('a@example.com');
    await PushSubscription.deleteOne({ _id: sub._id });
    const send = okSend();

    expect((await runReminderTick({ now: NINE_AM, send })).sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
