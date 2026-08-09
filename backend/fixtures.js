// 시간에 얽힌 기능을 확인하기 위한 가짜 데이터 정의.
//
// 시계를 앞으로 돌릴 수는 없으니 반대로 한다 — "한 달 뒤에 떠야 할 것"을 오늘 마감으로
// 미리 꽂아 넣고 지금 확인한다. 손으로 볼 때(scripts/seed-demo.js)와 자동으로 검사할 때
// (fixtures.test.js)가 이 파일 하나를 같이 쓴다. 정의가 두 벌이면 반드시 한쪽만 썩는다.
//
// app.js의 모델이 필요하므로 lib/이 아니라 여기(backend 루트)에 둔다 —
// lib/에 두면 app.js가 lib/*를 require하는 것과 순환이 된다. reminders.js가 같은 처지다.
// require에 확장자를 붙이는 이유도 reminders.js와 같다(모델 중복 등록 방지).

const { Todo, Review, INTERVALS, PushSubscription } = require('./app.js');
const { localDate, addDays } = require('./lib/dates');

/** 시드로 만든 할 일임을 나타내는 표시. clearScenarios가 지울 대상을 이걸로 특정한다. */
const SEED_PREFIX = '[시드] ';
const SEED_TEXT_RE = /^\[시드\] /;

const isSeedText = text => SEED_TEXT_RE.test(text || '');

// ── 시나리오 묶음 ──────────────────────────────────
// 하나의 큰 덩어리로 두지 않는 이유: 기능이 늘 때마다 항목을 밀어 넣으면 비대해지고,
// 모든 테스트가 그 전체에 의존하게 되어 복습 때문에 고친 항목이 마감 테스트를 깬다.
// 묶음으로 나눠 두면 새 기능은 묶음 하나를 더할 뿐이고, 테스트는 필요한 것만 골라 쓴다.

/**
 * 복습 사슬 5단계. stage 0~4를 전부 "오늘 마감"으로 깔아 둔다.
 *
 * 복습 하나를 완료하면 다음 마감은 addDays(today, INTERVALS[next] - INTERVALS[cur])다
 * (app.js의 PUT /api/reviews/:id/complete). 즉 완료일 기준 간격은 누적값이 아니라
 * 차분값이라 +2 / +4 / +9 / +14일이고, 마지막 단계를 완료하면 복습이 끝난다.
 * 이 묶음이 있으면 그 5단계를 한 달 기다리지 않고 전부 확인할 수 있다.
 */
function reviewChain(today) {
  const todos = [];
  const reviews = [];

  INTERVALS.forEach((interval, stage) => {
    const key = `reviewChain-${stage}`;
    todos.push({
      key,
      text: `복습 ${stage + 1}단계 (${interval}일차) · 오늘 마감`,
      importance: 2,
      needs_review: 1,
      completed: 1,
      completed_at: addDays(today, -interval),
      created_at: addDays(today, -interval - 1),
    });
    reviews.push({ todoKey: key, stage, due_date: today, completed: 0 });
  });

  return { todos, reviews };
}

// 마감 태그의 분기점을 전부 찍는다(frontend TodoItem.jsx).
// D-3과 D-4는 화면 글자가 "마감 D-3" / "마감 D-4"로 똑같고 CSS 클래스만 다르다
// (dl-soon vs dl-normal). 경계 바로 바깥인 D-4가 있어야 임박 조건이 넓어진 것을 알아챈다.
const DEADLINE_OFFSETS = [
  { offset: -2, note: '지남' },
  { offset: 0, note: '오늘 마감' },
  { offset: 3, note: '임박 경계 안쪽' },
  { offset: 4, note: '임박 경계 바로 바깥' },
  { offset: 10, note: '여유' },
];

// 복습 뱃지·ReviewSection의 3분류(지남 / 오늘 / 예정)가 한 화면에 다 보이도록.
const REVIEW_OFFSETS = [
  { offset: -3, note: '지남' },
  { offset: 0, note: '오늘' },
  { offset: 5, note: '예정' },
];

/** 마감 D-day 표시와 복습 3분류의 경계값. */
function deadlines(today) {
  const todos = DEADLINE_OFFSETS.map(({ offset, note }, i) => ({
    key: `deadlines-todo-${i}`,
    text: `마감 ${describeOffset(offset)} · ${note}`,
    importance: (i % 3) + 1,
    deadline: addDays(today, offset),
    completed: 0,
    created_at: today,
  }));

  const reviewTodos = REVIEW_OFFSETS.map(({ offset, note }, i) => ({
    key: `deadlines-review-${i}`,
    text: `복습 ${describeOffset(offset)} · ${note}`,
    importance: 2,
    needs_review: 1,
    completed: 1,
    completed_at: addDays(today, -1),
    created_at: addDays(today, -2),
  }));

  const reviews = REVIEW_OFFSETS.map(({ offset }, i) => ({
    todoKey: `deadlines-review-${i}`,
    stage: 0,
    due_date: addDays(today, offset),
    completed: 0,
  }));

  return { todos: [...todos, ...reviewTodos], reviews };
}

/**
 * 어제 수행하기로 해놓고 진행률을 안 적은 항목.
 * 앱을 열면 App.jsx가 이걸 찾아 진행률 입력 모달을 강제로 띄운다 —
 * 자정을 넘겼을 때 벌어지는 일을 자정까지 기다리지 않고 재현한다.
 */
function yesterday(today) {
  const todos = [0, 1].map(i => ({
    key: `yesterday-${i}`,
    text: `어제 한 일 ${i + 1} · 진행률 미입력`,
    importance: 1,
    perform_date: addDays(today, -1),
    progress: null,
    completed: 0,
    created_at: addDays(today, -1),
  }));

  return { todos, reviews: [] };
}

const SCENARIOS = { reviewChain, deadlines, yesterday };
const SCENARIO_NAMES = Object.keys(SCENARIOS);

/** -2 → "2일 지남", 0 → "오늘", 3 → "D-3" */
function describeOffset(offset) {
  if (offset < 0) return `${Math.abs(offset)}일 지남`;
  if (offset === 0) return '오늘';
  return `D-${offset}`;
}

// ── 조립 ──────────────────────────────────────────

/** only(문자열 하나 또는 배열)를 검증된 묶음 이름 배열로. 생략하면 전부. */
function resolveNames(only) {
  if (only === undefined || only === null) return SCENARIO_NAMES;

  const names = Array.isArray(only) ? only : [only];
  const unknown = names.filter(n => !SCENARIOS[n]);
  if (unknown.length > 0) {
    // 오타를 조용히 무시하면 "왜 데이터가 안 생기지"로 한참을 헤맨다.
    throw new Error(
      `알 수 없는 시나리오: ${unknown.join(', ')}\n` +
      `쓸 수 있는 이름: ${SCENARIO_NAMES.join(', ')}`
    );
  }
  return names;
}

/**
 * 시나리오 데이터를 만든다. DB를 전혀 모르는 순수 함수다.
 *
 * today를 인자로 받는 것이 이 파일의 핵심이다 — 테스트는 여기에 고정 날짜를 꽂아
 * 시계와 무관하게 같은 결과를 얻는다. 날짜는 전부 today 기준 상대값이라
 * 언제 돌려도 같은 상황이 재현된다.
 *
 * 반환: { today, names, todos, reviews }
 *   todos는 key를, reviews는 그 key를 가리키는 todoKey를 갖는다
 *   (아직 _id가 없으므로 seedScenarios가 삽입 후 이어 붙인다).
 */
function buildScenarios(today = localDate(), only) {
  const names = resolveNames(only);
  const todos = [];
  const reviews = [];

  for (const name of names) {
    const part = SCENARIOS[name](today);
    for (const todo of part.todos) {
      todos.push({ ...todo, text: `${SEED_PREFIX}${todo.text}` });
    }
    reviews.push(...part.reviews);
  }

  return { today, names, todos, reviews };
}

// ── DB 반영 ───────────────────────────────────────

/** 이 사용자의 시드 할 일과 거기 딸린 복습을 지운다. 시드가 아닌 것은 건드리지 않는다. */
async function clearScenarios({ userId }) {
  const seeded = await Todo.find({ userId, text: SEED_TEXT_RE }).select('_id').lean();
  const ids = seeded.map(t => t._id);
  if (ids.length === 0) return { todos: 0, reviews: 0 };

  const removedReviews = await Review.deleteMany({ userId, todoId: { $in: ids } });
  const removedTodos = await Todo.deleteMany({ userId, _id: { $in: ids } });

  return { todos: removedTodos.deletedCount, reviews: removedReviews.deletedCount };
}

/**
 * 시나리오를 실제로 넣는다. 넣기 전에 기존 시드를 지우므로 여러 번 돌려도 안전하다.
 * 인메모리 DB든 실제 DB든 지금 연결된 곳 하나만 보므로 테스트와 시드 스크립트가 같이 쓴다.
 */
async function seedScenarios({ userId, today = localDate(), only } = {}) {
  const built = buildScenarios(today, only);
  await clearScenarios({ userId });

  const insertedTodos = await Todo.insertMany(
    built.todos.map(({ key, ...fields }) => ({ ...fields, userId }))
  );

  // key → _id. buildScenarios가 준 순서와 insertMany가 돌려주는 순서는 같다.
  const idOf = new Map(built.todos.map((t, i) => [t.key, insertedTodos[i]._id]));

  const insertedReviews = built.reviews.length === 0 ? [] : await Review.insertMany(
    built.reviews.map(({ todoKey, ...fields }) => ({
      ...fields,
      userId,
      todoId: idOf.get(todoKey),
    }))
  );

  return {
    today: built.today,
    names: built.names,
    todos: insertedTodos.length,
    reviews: insertedReviews.length,
  };
}

/** 시드가 아닌 할 일의 개수. 실제로 쓰는 계정에 시드를 붓지 않기 위한 확인용. */
function countRealTodos({ userId }) {
  return Todo.countDocuments({ userId, text: { $not: SEED_TEXT_RE } });
}

/**
 * "오늘 이미 보냄" 표시를 지운다.
 * send-reminders.js --force는 시각 검사를 통째로 건너뛰므로 09시 판정 로직을 지나지 않는다.
 * 이걸 비우고 REMINDER_TIME을 지금보다 이른 시각으로 낮추면 --force 없이 실제 경로를 태울 수 있다.
 */
async function resetPushState({ userId }) {
  const result = await PushSubscription.updateMany({ userId }, { $set: { last_sent_date: null } });
  return result.modifiedCount;
}

module.exports = {
  SEED_PREFIX,
  SCENARIO_NAMES,
  isSeedText,
  buildScenarios,
  seedScenarios,
  clearScenarios,
  countRealTodos,
  resetPushState,
};
