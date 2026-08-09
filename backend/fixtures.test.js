// 픽스처 자체의 테스트 + 픽스처를 써서 시간 의존 기능을 검증하는 테스트.
// (JWT_SECRET은 app.js를 import하기 전에 넣어야 한다)
process.env.JWT_SECRET = 'test-secret';
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';
// 알림 시각을 고정한다 — 실행 환경의 .env에 좌우되지 않게.
process.env.REMINDER_TIME = '09:00';

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app, User, Todo, Review, PushSubscription, INTERVALS } from './app.js';
import { runReminderTick } from './reminders.js';
import {
  SEED_PREFIX, SCENARIO_NAMES,
  buildScenarios, seedScenarios, clearScenarios, countRealTodos, resetPushState,
} from './fixtures.js';
import { localDate, addDays } from './lib/dates.js';

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

const asUser = (token) => ({ Authorization: `Bearer ${token}` });

/** 가입하고 { token, userId }를 준다. */
async function signUp(email = 'seed@test.local', password = 'password1') {
  const res = await request(app).post('/api/auth/register').send({ email, password });
  expect(res.status).toBe(200);
  const user = await User.findOne({ email });
  return { token: res.body.token, userId: user._id };
}

// ── buildScenarios: DB 없이 도는 순수 함수 ─────────

describe('buildScenarios', () => {
  // 시계와 무관하게 같은 결과가 나와야 하므로 날짜를 고정해서 넣는다.
  const TODAY = '2026-06-01';

  it('복습 사슬은 단계마다 오늘 마감인 복습을 하나씩 만든다', () => {
    const { todos, reviews } = buildScenarios(TODAY, ['reviewChain']);

    expect(todos).toHaveLength(INTERVALS.length);
    expect(reviews).toHaveLength(INTERVALS.length);
    expect(reviews.map(r => r.stage)).toEqual([0, 1, 2, 3, 4]);
    expect(reviews.every(r => r.due_date === TODAY)).toBe(true);
    // 복습 뱃지는 완료된 할 일에만 붙는다(app.js의 withActiveReview)
    expect(todos.every(t => t.completed === 1 && t.needs_review === 1)).toBe(true);
  });

  it('마감 경계값을 지남·오늘·임박 안팎으로 모두 만든다', () => {
    const { todos } = buildScenarios(TODAY, ['deadlines']);
    const deadlines = todos.map(t => t.deadline).filter(Boolean);

    expect(deadlines).toEqual([
      '2026-05-30',  // 2일 지남
      '2026-06-01',  // 오늘 마감
      '2026-06-04',  // D-3 · 임박 경계 안쪽
      '2026-06-05',  // D-4 · 임박 경계 바로 바깥
      '2026-06-11',  // D-10
    ]);
  });

  it('어제 수행하고 진행률을 안 적은 항목을 만든다', () => {
    const { todos } = buildScenarios(TODAY, ['yesterday']);

    expect(todos.length).toBeGreaterThan(0);
    // App.jsx가 진행률 모달을 띄우는 조건 그대로다
    expect(todos.every(t =>
      !t.completed && t.perform_date === '2026-05-31' && t.progress === null
    )).toBe(true);
  });

  it('모든 날짜가 넘겨준 오늘을 기준으로 만들어진다', () => {
    const a = buildScenarios('2026-06-01');
    const b = buildScenarios('2026-06-02');

    // 하루를 밀면 모든 날짜가 그대로 하루씩 밀린다 — 하드코딩된 날짜가 없다는 뜻
    expect(b.todos.map(t => t.deadline)).toEqual(
      a.todos.map(t => (t.deadline ? addDays(t.deadline, 1) : t.deadline))
    );
    expect(b.reviews.map(r => r.due_date)).toEqual(
      a.reviews.map(r => addDays(r.due_date, 1))
    );
  });

  it('only를 주면 그 묶음만, 생략하면 전부 만든다', () => {
    const one = buildScenarios(TODAY, ['yesterday']);
    const all = buildScenarios(TODAY);

    expect(one.names).toEqual(['yesterday']);
    expect(all.names).toEqual(SCENARIO_NAMES);
    expect(all.todos.length).toBeGreaterThan(one.todos.length);
  });

  it('모든 할 일에 시드 표시를 붙인다', () => {
    const { todos } = buildScenarios(TODAY);
    expect(todos.every(t => t.text.startsWith(SEED_PREFIX))).toBe(true);
  });

  it('모르는 묶음 이름은 조용히 넘기지 않고 쓸 수 있는 이름을 알려준다', () => {
    expect(() => buildScenarios(TODAY, ['reviewChane'])).toThrow(/reviewChain/);
  });
});

// ── DB 반영과 격리 ────────────────────────────────

describe('seedScenarios / clearScenarios', () => {
  it('복습을 만든 할 일에 제대로 이어 붙인다', async () => {
    const { userId } = await signUp();
    await seedScenarios({ userId, today: '2026-06-01', only: ['reviewChain'] });

    const reviews = await Review.find({ userId }).sort({ stage: 1 }).lean();
    expect(reviews).toHaveLength(INTERVALS.length);

    for (const review of reviews) {
      const todo = await Todo.findById(review.todoId).lean();
      expect(todo).not.toBeNull();
      expect(todo.text).toContain(`복습 ${review.stage + 1}단계`);
    }
  });

  it('여러 번 돌려도 데이터가 쌓이지 않는다', async () => {
    const { userId } = await signUp();

    await seedScenarios({ userId, today: '2026-06-01' });
    const first = await Todo.countDocuments({ userId });

    await seedScenarios({ userId, today: '2026-06-01' });
    expect(await Todo.countDocuments({ userId })).toBe(first);
  });

  it('시드가 아닌 할 일은 지우지 않는다', async () => {
    const { token, userId } = await signUp();
    await request(app).post('/api/todos').set(asUser(token)).send({ text: '내 진짜 할 일' });

    await seedScenarios({ userId, today: '2026-06-01' });
    await clearScenarios({ userId });

    const left = await Todo.find({ userId }).lean();
    expect(left).toHaveLength(1);
    expect(left[0].text).toBe('내 진짜 할 일');
  });

  it('다른 사람의 데이터는 건드리지 않는다', async () => {
    const mine = await signUp('me@test.local');
    const other = await signUp('other@test.local');

    await seedScenarios({ userId: mine.userId, today: '2026-06-01' });
    await seedScenarios({ userId: other.userId, today: '2026-06-01' });
    await clearScenarios({ userId: mine.userId });

    expect(await Todo.countDocuments({ userId: mine.userId })).toBe(0);
    expect(await Todo.countDocuments({ userId: other.userId })).toBeGreaterThan(0);
  });

  it('시드는 내 목록에만 보이고 남의 목록에는 보이지 않는다', async () => {
    const seedAccount = await signUp('seed@test.local');
    const real = await signUp('real@test.local');
    await seedScenarios({ userId: seedAccount.userId, today: '2026-06-01' });

    const res = await request(app).get('/api/todos').set(asUser(real.token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('countRealTodos는 시드를 세지 않는다', async () => {
    const { token, userId } = await signUp();
    await seedScenarios({ userId, today: '2026-06-01' });
    expect(await countRealTodos({ userId })).toBe(0);

    await request(app).post('/api/todos').set(asUser(token)).send({ text: '내 진짜 할 일' });
    expect(await countRealTodos({ userId })).toBe(1);
  });
});

// ── 복습 사슬: 한 달을 기다리지 않고 전 단계를 확인한다 ──

describe('복습 사슬', () => {
  // 라우트는 localDate()로 실제 오늘을 쓴다(주입 불가). 픽스처도 같은 값을 써서 맞춘다.
  const today = localDate();

  // app.js의 다음 마감은 addDays(today, INTERVALS[next] - INTERVALS[cur]) —
  // 누적값이 아니라 차분값이다.
  const EXPECTED_GAP = { 0: 2, 1: 4, 2: 9, 3: 14 };

  async function seedChain() {
    const { token, userId } = await signUp();
    await seedScenarios({ userId, today, only: ['reviewChain'] });
    const reviews = await Review.find({ userId }).sort({ stage: 1 }).lean();
    return { token, userId, reviews };
  }

  it.each(Object.entries(EXPECTED_GAP))(
    '%s단계를 완료하면 다음 복습이 %s일 뒤로 잡힌다',
    async (stage, gap) => {
      const { token, userId, reviews } = await seedChain();
      const review = reviews.find(r => r.stage === Number(stage));

      const res = await request(app)
        .put(`/api/reviews/${review._id}/complete`).set(asUser(token));
      expect(res.status).toBe(200);

      const next = await Review.findOne({
        userId, todoId: review.todoId, completed: 0,
      }).lean();

      expect(next.stage).toBe(Number(stage) + 1);
      expect(next.due_date).toBe(addDays(today, gap));
    }
  );

  it('마지막 단계를 완료하면 복습이 끝나고 새로 생기지 않는다', async () => {
    const { token, userId, reviews } = await seedChain();
    const last = reviews.find(r => r.stage === INTERVALS.length - 1);

    await request(app).put(`/api/reviews/${last._id}/complete`).set(asUser(token));

    const remaining = await Review.find({
      userId, todoId: last.todoId, completed: 0,
    }).lean();
    expect(remaining).toHaveLength(0);
  });

  it('완료 전에는 목록에 오늘 마감인 복습으로 나온다', async () => {
    const { token } = await seedChain();

    const res = await request(app).get('/api/todos').set(asUser(token));

    const withReview = res.body.filter(t => t.activeReview);
    expect(withReview).toHaveLength(INTERVALS.length);
    expect(withReview.every(t => t.activeReview.due_date === today)).toBe(true);
  });
});

// ── 알림: 09시를 기다리지 않고 발송 경로를 태운다 ──

describe('복습 알림', () => {
  const today = localDate();
  // 오늘 09시. runReminderTick이 now를 주입받으므로 시각을 기다릴 필요가 없다.
  const nineAm = new Date(`${today}T09:00:00`);

  async function subscribe(userId) {
    return PushSubscription.create({
      userId,
      endpoint: 'https://fcm.googleapis.com/fcm/send/seed',
      keys: { p256dh: 'p', auth: 'a' },
      created_at: today,
    });
  }

  it('시드가 만든 마감 복습을 한 건의 요약으로 보낸다', async () => {
    const { userId } = await signUp();
    await seedScenarios({ userId, today, only: ['reviewChain'] });
    await subscribe(userId);
    const send = vi.fn(async () => ({ ok: true }));

    const result = await runReminderTick({ now: nineAm, send });

    expect(result.sent).toBe(1);
    const [, payload] = send.mock.calls[0];
    expect(payload.title).toBe(`오늘 복습 ${INTERVALS.length}건`);
  });

  it('같은 날 두 번째 tick에서는 다시 보내지 않는다', async () => {
    const { userId } = await signUp();
    await seedScenarios({ userId, today, only: ['reviewChain'] });
    await subscribe(userId);
    const send = vi.fn(async () => ({ ok: true }));

    await runReminderTick({ now: nineAm, send });
    const second = await runReminderTick({ now: nineAm, send });

    expect(second.sent).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('resetPushState 후에는 시각 검사를 우회하지 않고도 다시 보낸다', async () => {
    const { userId } = await signUp();
    await seedScenarios({ userId, today, only: ['reviewChain'] });
    await subscribe(userId);
    const send = vi.fn(async () => ({ ok: true }));

    await runReminderTick({ now: nineAm, send });
    await resetPushState({ userId });
    const again = await runReminderTick({ now: nineAm, send });

    expect(again.sent).toBe(1);
  });

  it('알림 시각 전에는 보내지 않는다', async () => {
    const { userId } = await signUp();
    await seedScenarios({ userId, today, only: ['reviewChain'] });
    await subscribe(userId);
    const send = vi.fn(async () => ({ ok: true }));

    const result = await runReminderTick({ now: new Date(`${today}T08:59:00`), send });

    expect(result.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
