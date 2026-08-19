// 사용자 격리 통합 테스트. 인메모리 MongoDB에 붙여서 실제 라우트를 그대로 호출한다.
// (JWT_SECRET은 app.js를 import하기 전에 넣어야 한다)
process.env.JWT_SECRET = 'test-secret';
// 실제로 발송하지는 않는다 — 라우트가 "키가 있다"고 판단하게만 하면 된다.
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app, User, Todo, Review, Category, PushSubscription } from './app.js';
import { resetPassword } from './scripts/reset-password.js';

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
  // Category를 빼먹으면 이름 유니크 인덱스 때문에 같은 이름을 쓰는 **두 번째** 테스트가
  // 엉뚱한 409로 죽는다. 무엇을 검사하던 테스트인지와 상관없이.
  await Promise.all([
    User.deleteMany({}), Todo.deleteMany({}), Review.deleteMany({}),
    Category.deleteMany({}), PushSubscription.deleteMany({}),
  ]);
});

/** 회원가입하고 그 사용자의 토큰을 준다. */
async function signUp(email, password = 'password1') {
  const res = await request(app).post('/api/auth/register').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token;
}

const asUser = (token) => ({ Authorization: `Bearer ${token}` });

async function addTodo(token, text, extra = {}) {
  const res = await request(app).post('/api/todos').set(asUser(token)).send({ text, ...extra });
  expect(res.status).toBe(200);
  return res.body;
}

describe('회원가입', () => {
  it('가입하면 토큰과 사용자 정보를 준다', async () => {
    const res = await request(app)
      .post('/api/auth/register').send({ email: 'a@example.com', password: 'password1' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('a@example.com');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('비밀번호를 평문으로 저장하지 않는다', async () => {
    await signUp('a@example.com');
    const user = await User.findOne({ email: 'a@example.com' });
    expect(user.password_hash).not.toBe('password1');
    expect(user.password_hash.length).toBeGreaterThan(20);
  });

  it('같은 이메일로 두 번 가입할 수 없다', async () => {
    await signUp('a@example.com');
    const res = await request(app)
      .post('/api/auth/register').send({ email: 'a@example.com', password: 'password2' });

    expect(res.status).toBe(409);
  });

  it('대소문자만 다른 이메일도 같은 계정으로 본다', async () => {
    await signUp('a@example.com');
    const res = await request(app)
      .post('/api/auth/register').send({ email: 'A@Example.com', password: 'password2' });

    expect(res.status).toBe(409);
  });

  it('짧은 비밀번호는 거절한다', async () => {
    const res = await request(app)
      .post('/api/auth/register').send({ email: 'a@example.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });
});

describe('로그인', () => {
  it('가입한 비밀번호로 로그인하면 토큰을 준다', async () => {
    await signUp('a@example.com');
    const res = await request(app)
      .post('/api/auth/login').send({ email: 'a@example.com', password: 'password1' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('비밀번호가 틀리면 401을 준다', async () => {
    await signUp('a@example.com');
    const res = await request(app)
      .post('/api/auth/login').send({ email: 'a@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('없는 계정과 틀린 비밀번호의 응답을 구분할 수 없다', async () => {
    await signUp('a@example.com');
    const wrongPw = await request(app)
      .post('/api/auth/login').send({ email: 'a@example.com', password: 'wrongpassword' });
    const noUser = await request(app)
      .post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrongpassword' });

    expect(noUser.status).toBe(wrongPw.status);
    expect(noUser.body.error).toBe(wrongPw.body.error);
  });
});

describe('인증이 없는 요청', () => {
  it('토큰 없이 할일을 조회할 수 없다', async () => {
    expect((await request(app).get('/api/todos')).status).toBe(401);
  });

  it('토큰 없이 할일을 추가할 수 없다', async () => {
    const res = await request(app).post('/api/todos').send({ text: '몰래 추가' });
    expect(res.status).toBe(401);
    expect(await Todo.countDocuments()).toBe(0);
  });

  it('형식이 깨진 토큰을 거절한다', async () => {
    expect((await request(app).get('/api/todos').set(asUser('not-a-token'))).status).toBe(401);
  });

  it('다른 비밀키로 서명해 만든 토큰을 거절한다', async () => {
    await signUp('a@example.com');
    const user = await User.findOne({});
    const forged = jwt.sign({ sub: String(user._id) }, 'attacker-secret', { expiresIn: '30d' });

    expect((await request(app).get('/api/todos').set(asUser(forged))).status).toBe(401);
  });

  it('만료된 토큰을 거절한다', async () => {
    await signUp('a@example.com');
    const user = await User.findOne({});
    const expired = jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '-1s' });

    expect((await request(app).get('/api/todos').set(asUser(expired))).status).toBe(401);
  });
});

describe('내 정보 확인', () => {
  it('유효한 토큰이면 내 이메일을 준다', async () => {
    const token = await signUp('a@example.com');

    const res = await request(app).get('/api/auth/me').set(asUser(token));

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('a@example.com');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('토큰이 없으면 401을 준다', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });
});

describe('토큰 버전 호환·방어', () => {
  it('버전이 없던 시절에 발급된 토큰도 그대로 통한다', async () => {
    // 이 기능을 배포하는 순간 이미 로그인해 있던 사람들이 튕기면 안 된다
    await signUp('a@example.com');
    const user = await User.findOne({ email: 'a@example.com' });
    const legacy = jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '30d' });

    expect((await request(app).get('/api/todos').set(asUser(legacy))).status).toBe(200);
  });

  it('사용자 id 자리에 엉뚱한 값이 든 토큰은 500이 아니라 401을 준다', async () => {
    const bogus = jwt.sign(
      { sub: '이건-id가-아님', ver: 0 }, process.env.JWT_SECRET, { expiresIn: '30d' }
    );

    expect((await request(app).get('/api/todos').set(asUser(bogus))).status).toBe(401);
  });

  it('바꾼 비밀번호로 다시 로그인해 받은 토큰은 실제로 통한다', async () => {
    const token = await signUp('a@example.com');
    await request(app).put('/api/auth/password').set(asUser(token))
      .send({ currentPassword: 'password1', newPassword: 'newpassword1' });

    const login = await request(app)
      .post('/api/auth/login').send({ email: 'a@example.com', password: 'newpassword1' });

    expect((await request(app).get('/api/todos').set(asUser(login.body.token))).status).toBe(200);
  });
});

/** 성격을 만들고 그 몸통을 준다. */
async function addCategory(token, name, color = 1) {
  const res = await request(app).post('/api/categories').set(asUser(token)).send({ name, color });
  expect(res.status).toBe(200);
  return res.body;
}

describe('할 일 성격', () => {
  it('만든 성격이 목록에 나온다', async () => {
    const a = await signUp('a@example.com');
    await addCategory(a, '영어', 3);

    const res = await request(app).get('/api/categories').set(asUser(a));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject([{ name: '영어', color: 3 }]);
  });

  it('이름이 비면 거절하고 아무것도 만들지 않는다', async () => {
    const a = await signUp('a@example.com');

    const res = await request(app).post('/api/categories').set(asUser(a)).send({ name: '  ' });

    expect(res.status).toBe(400);
    expect(await Category.countDocuments({})).toBe(0);
  });

  it('같은 이름의 성격을 두 번 만들 수 없다', async () => {
    const a = await signUp('a@example.com');
    await addCategory(a, '영어');

    const res = await request(app).post('/api/categories').set(asUser(a)).send({ name: '영어' });

    expect(res.status).toBe(409);
    expect(await Category.countDocuments({})).toBe(1);
  });

  // 유니크 인덱스는 연결 직후 비동기로 만들어져서, 그 사이의 요청은 인덱스를 지나지 않는다.
  // 인덱스를 지워서 그 창을 재현한다 — 라우트가 스스로 막지 못하면 중복이 저장되고,
  // 한 번 중복이 생기면 인덱스 만들기가 영영 실패해 그 뒤로는 아무도 막히지 않는다.
  it('유니크 인덱스가 아직 없어도 같은 이름을 두 번 만들 수 없다', async () => {
    const a = await signUp('a@example.com');
    await addCategory(a, '영어');
    await Category.collection.dropIndex('userId_1_name_1').catch(() => {});

    const res = await request(app).post('/api/categories').set(asUser(a)).send({ name: '영어' });

    expect(res.status).toBe(409);
    expect(await Category.countDocuments({})).toBe(1);
    await Category.syncIndexes();
  });

  // 유니크 인덱스를 { name: 1 }로 잘못 걸면 다른 검사는 다 통과하고 이것만 깨진다
  it('다른 사용자는 같은 이름의 성격을 만들 수 있다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    await addCategory(a, '영어');

    const res = await request(app).post('/api/categories').set(asUser(b)).send({ name: '영어' });

    expect(res.status).toBe(200);
  });

  it('12개까지 만들 수 있고 13개째는 거절한다', async () => {
    const a = await signUp('a@example.com');
    for (let i = 1; i <= 11; i += 1) await addCategory(a, `성격${i}`);

    const twelfth = await request(app).post('/api/categories').set(asUser(a)).send({ name: '성격12' });
    const thirteenth = await request(app).post('/api/categories').set(asUser(a)).send({ name: '성격13' });

    expect(twelfth.status).toBe(200);
    expect(thirteenth.status).toBe(400);
    expect(await Category.countDocuments({})).toBe(12);
  });

  it('이름과 색을 바꿀 수 있다', async () => {
    const a = await signUp('a@example.com');
    const category = await addCategory(a, '영어', 1);

    const res = await request(app)
      .put(`/api/categories/${category.id}`).set(asUser(a)).send({ name: '영어 단어', color: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: '영어 단어', color: 5 });
  });

  it('이름을 다른 성격과 같게 바꿀 수는 없다', async () => {
    const a = await signUp('a@example.com');
    await addCategory(a, '영어');
    const other = await addCategory(a, '과제');

    const res = await request(app)
      .put(`/api/categories/${other.id}`).set(asUser(a)).send({ name: '영어' });

    expect(res.status).toBe(409);
    expect((await Category.findById(other.id)).name).toBe('과제');
  });

  it('이름을 그대로 두고 색만 바꾸는 것은 중복이 아니다', async () => {
    const a = await signUp('a@example.com');
    const category = await addCategory(a, '영어', 1);

    const res = await request(app)
      .put(`/api/categories/${category.id}`).set(asUser(a)).send({ name: '영어', color: 7 });

    expect(res.status).toBe(200);
    expect(res.body.color).toBe(7);
  });

  it('성격을 지우면 그 성격을 쓰던 할 일의 성격이 비워진다', async () => {
    const a = await signUp('a@example.com');
    const category = await addCategory(a, '영어');
    const todo = await addTodo(a, '단어 외우기', { category_id: category.id });

    await request(app).delete(`/api/categories/${category.id}`).set(asUser(a));

    const list = await request(app).get('/api/todos').set(asUser(a));
    expect(list.body[0].category_id).toBe(null);
    expect((await Todo.findById(todo.id)).category_id).toBe(null);
  });

  it('성격을 지워도 다른 성격을 쓰던 할 일은 그대로다', async () => {
    const a = await signUp('a@example.com');
    const gone = await addCategory(a, '영어');
    const kept = await addCategory(a, '과제');
    const todo = await addTodo(a, '보고서', { category_id: kept.id });

    await request(app).delete(`/api/categories/${gone.id}`).set(asUser(a));

    expect(String((await Todo.findById(todo.id)).category_id)).toBe(kept.id);
  });
});

describe('할 일에 성격 붙이기', () => {
  it('할 일을 만들 때 성격을 붙일 수 있다', async () => {
    const a = await signUp('a@example.com');
    const category = await addCategory(a, '영어');

    const todo = await addTodo(a, '단어 외우기', { category_id: category.id });

    expect(String(todo.category_id)).toBe(category.id);
  });

  // formatTodo는 허용목록이라 한 줄을 빠뜨리면 서버는 멀쩡히 저장하는데 화면엔 안 나온다
  it('성격을 주지 않으면 성격 없이 만들어지고, 그 사실이 응답에 담긴다', async () => {
    const a = await signUp('a@example.com');

    const todo = await addTodo(a, '그냥 할 일');

    expect(todo).toHaveProperty('category_id');
    expect(todo.category_id).toBe(null);
  });

  // 이 파일에서 가장 중요한 테스트다. PUT은 나열된 필드를 무조건 덮어쓰는 라우트라,
  // category_id에 !== undefined 가드가 없으면 이 필드를 모르는 옛 화면이 수정을
  // 보낼 때마다 성격이 조용히 지워진다.
  it('수정 요청에 성격이 없으면 기존 성격을 지우지 않는다', async () => {
    const a = await signUp('a@example.com');
    const category = await addCategory(a, '영어');
    const todo = await addTodo(a, '단어 외우기', { category_id: category.id });

    const res = await request(app)
      .put(`/api/todos/${todo.id}`).set(asUser(a))
      .send({ text: '단어 외우기', importance: 2 });

    expect(res.status).toBe(200);
    expect(String(res.body.category_id)).toBe(category.id);
    expect(String((await Todo.findById(todo.id)).category_id)).toBe(category.id);
  });

  it('수정 요청에 성격을 null로 주면 지운다', async () => {
    const a = await signUp('a@example.com');
    const category = await addCategory(a, '영어');
    const todo = await addTodo(a, '단어 외우기', { category_id: category.id });

    const res = await request(app)
      .put(`/api/todos/${todo.id}`).set(asUser(a))
      .send({ text: '단어 외우기', importance: 1, category_id: null });

    expect(res.status).toBe(200);
    expect(res.body.category_id).toBe(null);
  });

  it('수정으로 다른 성격을 붙일 수 있다', async () => {
    const a = await signUp('a@example.com');
    const before = await addCategory(a, '영어');
    const after = await addCategory(a, '과제');
    const todo = await addTodo(a, '할 일', { category_id: before.id });

    const res = await request(app)
      .put(`/api/todos/${todo.id}`).set(asUser(a))
      .send({ text: '할 일', importance: 1, category_id: after.id });

    expect(String(res.body.category_id)).toBe(after.id);
  });

  it('없는 성격을 붙이려 하면 거절하고 할 일도 만들지 않는다', async () => {
    const a = await signUp('a@example.com');
    const gone = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post('/api/todos').set(asUser(a)).send({ text: '할 일', category_id: gone });

    expect(res.status).toBe(400);
    expect(await Todo.countDocuments({})).toBe(0);
  });

  // 이 검사가 없으면 CastError가 전역 처리기를 타고 404가 되어, 같은 실수인데
  // 형식이 틀렸을 때만 답이 달라진다
  it('성격 id 형식이 아닌 값을 줘도 500이나 404가 아니라 400을 준다', async () => {
    const a = await signUp('a@example.com');

    const res = await request(app)
      .post('/api/todos').set(asUser(a)).send({ text: '할 일', category_id: '이건-id가-아님' });

    expect(res.status).toBe(400);
  });
});

describe('사용자별 데이터 격리', () => {
  it('내 목록에는 내 할일만 보인다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    await addTodo(a, 'A의 할일');
    await addTodo(b, 'B의 할일');

    const listA = await request(app).get('/api/todos').set(asUser(a));
    const listB = await request(app).get('/api/todos').set(asUser(b));

    expect(listA.body.map(t => t.text)).toEqual(['A의 할일']);
    expect(listB.body.map(t => t.text)).toEqual(['B의 할일']);
  });

  it('남의 할일은 수정할 수 없고 내용도 그대로 남는다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const todoA = await addTodo(a, 'A의 할일');

    const res = await request(app)
      .put(`/api/todos/${todoA.id}`).set(asUser(b))
      .send({ text: '가로챈 할일', importance: 3 });

    expect(res.status).toBe(404);
    expect((await Todo.findById(todoA.id)).text).toBe('A의 할일');
  });

  it('남의 할일은 삭제할 수 없다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const todoA = await addTodo(a, 'A의 할일');

    expect((await request(app).delete(`/api/todos/${todoA.id}`).set(asUser(b))).status).toBe(404);
    expect(await Todo.findById(todoA.id)).not.toBe(null);
  });

  it('남의 할일을 완료 처리할 수 없다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const todoA = await addTodo(a, 'A의 할일');

    const res = await request(app)
      .put(`/api/todos/${todoA.id}/complete`).set(asUser(b)).send({ completed: true });

    expect(res.status).toBe(404);
    expect((await Todo.findById(todoA.id)).completed).toBe(0);
  });

  it('남의 할일에 진행률·수행날짜를 넣을 수 없다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const todoA = await addTodo(a, 'A의 할일');

    const progress = await request(app)
      .put(`/api/todos/${todoA.id}/progress`).set(asUser(b)).send({ progress: 50 });
    const performDate = await request(app)
      .put(`/api/todos/${todoA.id}/perform-date`).set(asUser(b)).send({ perform_date: '2026-06-01' });

    expect(progress.status).toBe(404);
    expect(performDate.status).toBe(404);
    const after = await Todo.findById(todoA.id);
    expect(after.progress).toBe(null);
    expect(after.perform_date).toBe(null);
  });

  it('남의 복습 단계를 완료 처리할 수 없다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const todoA = await addTodo(a, '복습할 할일', { needs_review: true });
    const completed = await request(app)
      .put(`/api/todos/${todoA.id}/complete`).set(asUser(a)).send({ completed: true });
    const reviewId = completed.body.activeReview.id;

    const res = await request(app).put(`/api/reviews/${reviewId}/complete`).set(asUser(b));

    expect(res.status).toBe(404);
    expect((await Review.findById(reviewId)).completed).toBe(0);
  });

  it('남의 성격은 내 목록에 보이지 않는다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    await addCategory(a, 'A의 성격');
    await addCategory(b, 'B의 성격');

    const listA = await request(app).get('/api/categories').set(asUser(a));

    expect(listA.body.map(c => c.name)).toEqual(['A의 성격']);
  });

  it('남의 성격은 수정할 수 없고 이름도 그대로 남는다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const categoryA = await addCategory(a, 'A의 성격');

    const res = await request(app)
      .put(`/api/categories/${categoryA.id}`).set(asUser(b)).send({ name: '가로챈 성격', color: 2 });

    expect(res.status).toBe(404);
    expect((await Category.findById(categoryA.id)).name).toBe('A의 성격');
  });

  it('남의 성격은 삭제할 수 없다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const categoryA = await addCategory(a, 'A의 성격');

    expect((await request(app).delete(`/api/categories/${categoryA.id}`).set(asUser(b))).status).toBe(404);
    expect(await Category.findById(categoryA.id)).not.toBe(null);
  });

  // 막지 않으면 B의 할 일에 A의 성격 id가 영구히 박히고, A가 그것을 지워도
  // 정리는 A의 할 일만 훑으므로 그대로 남는다
  it('남의 성격을 내 할일에 붙일 수 없다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const categoryA = await addCategory(a, 'A의 성격');
    const todoB = await addTodo(b, 'B의 할일');

    const res = await request(app)
      .put(`/api/todos/${todoB.id}`).set(asUser(b))
      .send({ text: 'B의 할일', importance: 1, category_id: categoryA.id });

    expect(res.status).toBe(400);
    expect((await Todo.findById(todoB.id)).category_id).toBe(null);
  });

  it('남의 성격을 지워도 내 할일의 성격은 그대로다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    // 두 사람이 같은 이름을 쓰고 있어도 서로의 정리에 휩쓸리지 않아야 한다
    const categoryA = await addCategory(a, '영어');
    const categoryB = await addCategory(b, '영어');
    const todoB = await addTodo(b, 'B의 할일', { category_id: categoryB.id });

    await request(app).delete(`/api/categories/${categoryA.id}`).set(asUser(a));

    expect(String((await Todo.findById(todoB.id)).category_id)).toBe(categoryB.id);
  });

  it('한 사람의 할일을 지워도 남의 복습 일정은 남는다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const todoA = await addTodo(a, 'A의 복습', { needs_review: true });
    const todoB = await addTodo(b, 'B의 복습', { needs_review: true });
    await request(app).put(`/api/todos/${todoA.id}/complete`).set(asUser(a)).send({ completed: true });
    await request(app).put(`/api/todos/${todoB.id}/complete`).set(asUser(b)).send({ completed: true });

    await request(app).delete(`/api/todos/${todoA.id}`).set(asUser(a));

    expect(await Review.countDocuments({ todoId: todoA.id })).toBe(0);
    expect(await Review.countDocuments({ todoId: todoB.id })).toBe(1);
  });
});

describe('잘못된 요청 처리', () => {
  it('할일 id 형식이 아닌 값을 줘도 500이 아니라 404를 준다', async () => {
    const a = await signUp('a@example.com');
    const res = await request(app).delete('/api/todos/이건-id가-아님').set(asUser(a));
    expect(res.status).toBe(404);
  });
});

describe('비밀번호 변경', () => {
  const change = (token, body) =>
    request(app).put('/api/auth/password').set(asUser(token)).send(body);

  const login = (email, password) =>
    request(app).post('/api/auth/login').send({ email, password });

  it('로그인하지 않으면 바꿀 수 없다', async () => {
    const res = await request(app)
      .put('/api/auth/password').send({ currentPassword: 'password1', newPassword: 'newpassword1' });

    expect(res.status).toBe(401);
  });

  it('현재 비밀번호가 틀리면 401이고 비밀번호는 그대로다', async () => {
    const token = await signUp('a@example.com');

    const res = await change(token, { currentPassword: 'wrongpassword', newPassword: 'newpassword1' });

    expect(res.status).toBe(401);
    expect((await login('a@example.com', 'password1')).status).toBe(200);
  });

  it('새 비밀번호가 8자 미만이면 400이고 바뀌지 않는다', async () => {
    const token = await signUp('a@example.com');

    const res = await change(token, { currentPassword: 'password1', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect((await login('a@example.com', 'password1')).status).toBe(200);
  });

  it('새 비밀번호가 현재와 같으면 400이다', async () => {
    const token = await signUp('a@example.com');

    const res = await change(token, { currentPassword: 'password1', newPassword: 'password1' });

    expect(res.status).toBe(400);
  });

  it('바꾸고 나면 새 비밀번호로 로그인되고 옛 비밀번호로는 안 된다', async () => {
    const token = await signUp('a@example.com');

    expect((await change(token, { currentPassword: 'password1', newPassword: 'newpassword1' })).status).toBe(200);

    expect((await login('a@example.com', 'newpassword1')).status).toBe(200);
    expect((await login('a@example.com', 'password1')).status).toBe(401);
  });

  it('새 비밀번호도 평문으로 저장하지 않는다', async () => {
    const token = await signUp('a@example.com');

    await change(token, { currentPassword: 'password1', newPassword: 'newpassword1' });

    const user = await User.findOne({ email: 'a@example.com' });
    expect(user.password_hash).not.toBe('newpassword1');
  });
});

describe('비밀번호를 바꾸면 기존 토큰이 무효가 된다', () => {
  const change = (token, body) =>
    request(app).put('/api/auth/password').set(asUser(token)).send(body);

  it('변경 전에 발급된 토큰은 더 이상 통하지 않는다', async () => {
    const oldToken = await signUp('a@example.com');
    await addTodo(oldToken, '내 할일');

    await change(oldToken, { currentPassword: 'password1', newPassword: 'newpassword1' });

    expect((await request(app).get('/api/todos').set(asUser(oldToken))).status).toBe(401);
  });

  it('변경 응답으로 받은 새 토큰은 그대로 쓸 수 있다', async () => {
    const oldToken = await signUp('a@example.com');
    await addTodo(oldToken, '내 할일');

    const res = await change(oldToken, { currentPassword: 'password1', newPassword: 'newpassword1' });

    expect(res.body.token).toEqual(expect.any(String));
    const after = await request(app).get('/api/todos').set(asUser(res.body.token));
    expect(after.status).toBe(200);
    expect(after.body.map(t => t.text)).toEqual(['내 할일']);
  });

  it('남이 비밀번호를 바꿔도 내 토큰은 멀쩡하다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');

    await change(b, { currentPassword: 'password1', newPassword: 'newpassword1' });

    expect((await request(app).get('/api/todos').set(asUser(a))).status).toBe(200);
  });

  it('계정이 사라지면 그 토큰도 더 이상 통하지 않는다', async () => {
    const token = await signUp('a@example.com');
    await User.deleteMany({ email: 'a@example.com' });

    expect((await request(app).get('/api/todos').set(asUser(token))).status).toBe(401);
  });
});

describe('회원 탈퇴', () => {
  const withdraw = (token, password) =>
    request(app).delete('/api/auth/me').set(asUser(token)).send({ password });

  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/device-a',
    keys: { p256dh: 'p256dh-a', auth: 'auth-a' },
  };

  /** 지워질 것이 실제로 있는 상태를 만든다 — 할일·복습·알림 구독까지. */
  async function seedEverything(token, { endpoint = subscription.endpoint } = {}) {
    const todo = await addTodo(token, '망각곡선 대상', { needs_review: true });
    await request(app)
      .put(`/api/todos/${todo.id}/complete`).set(asUser(token)).send({ completed: true });
    await request(app)
      .post('/api/push/subscribe').set(asUser(token))
      .send({ subscription: { ...subscription, endpoint } });
  }

  it('로그인하지 않으면 탈퇴할 수 없다', async () => {
    await signUp('a@example.com');

    const res = await request(app).delete('/api/auth/me').send({ password: 'password1' });

    expect(res.status).toBe(401);
    expect(await User.countDocuments()).toBe(1);
  });

  it('비밀번호가 틀리면 403이고 아무것도 지워지지 않는다', async () => {
    const token = await signUp('a@example.com');
    await seedEverything(token);

    const res = await withdraw(token, 'wrongpassword');

    expect(res.status).toBe(403);
    expect(await User.countDocuments()).toBe(1);
    expect(await Todo.countDocuments()).toBe(1);
    expect(await Review.countDocuments()).toBe(1);
    expect(await PushSubscription.countDocuments()).toBe(1);
  });

  // 401을 주면 프론트의 authFetch가 세션 만료로 보고 로그아웃시켜 버린다.
  it('비밀번호가 틀려도 401은 주지 않는다 (세션 만료로 오해받지 않도록)', async () => {
    const token = await signUp('a@example.com');

    expect((await withdraw(token, 'wrongpassword')).status).not.toBe(401);
  });

  it('비밀번호 칸이 아예 없어도 500이 아니라 403을 준다', async () => {
    const token = await signUp('a@example.com');

    const res = await request(app).delete('/api/auth/me').set(asUser(token)).send({});

    expect(res.status).toBe(403);
    expect(await User.countDocuments()).toBe(1);
  });

  it('비밀번호가 맞으면 계정과 그 사용자의 데이터가 전부 사라진다', async () => {
    const token = await signUp('a@example.com');
    await seedEverything(token);

    const res = await withdraw(token, 'password1');

    expect(res.status).toBe(200);
    expect(await User.countDocuments()).toBe(0);
    expect(await Todo.countDocuments()).toBe(0);
    expect(await Review.countDocuments()).toBe(0);
    expect(await PushSubscription.countDocuments()).toBe(0);
  });

  it('탈퇴해도 다른 사용자의 데이터는 그대로 남는다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    await seedEverything(a);
    await seedEverything(b, { endpoint: 'https://fcm.googleapis.com/fcm/send/device-b' });

    expect((await withdraw(a, 'password1')).status).toBe(200);

    expect(await User.countDocuments()).toBe(1);
    expect((await User.findOne()).email).toBe('b@example.com');
    const bId = String((await User.findOne({ email: 'b@example.com' }))._id);
    expect((await Todo.find()).map(t => String(t.userId))).toEqual([bId]);
    expect((await Review.find()).map(r => String(r.userId))).toEqual([bId]);
    expect((await PushSubscription.find()).map(s => String(s.userId))).toEqual([bId]);

    // 남은 쪽은 아무 일도 없었던 것처럼 계속 쓸 수 있어야 한다
    const after = await request(app).get('/api/todos').set(asUser(b));
    expect(after.status).toBe(200);
    expect(after.body.map(t => t.text)).toEqual(['망각곡선 대상']);
  });

  it('탈퇴하면 그 계정의 토큰은 더 이상 통하지 않는다', async () => {
    const token = await signUp('a@example.com');
    await withdraw(token, 'password1');

    expect((await request(app).get('/api/todos').set(asUser(token))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(asUser(token))).status).toBe(401);
  });

  it('탈퇴한 뒤에는 같은 이메일로 다시 가입할 수 있다', async () => {
    const token = await signUp('a@example.com');
    await seedEverything(token);
    await withdraw(token, 'password1');

    const fresh = await signUp('a@example.com');

    // 옛 할일이 새 계정에 딸려오지 않는다
    const res = await request(app).get('/api/todos').set(asUser(fresh));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('탈퇴하면 옛 비밀번호로 로그인되지 않는다', async () => {
    const token = await signUp('a@example.com');
    await withdraw(token, 'password1');

    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'password1' });
    expect(res.status).toBe(401);
  });
});

describe('관리자 비밀번호 재설정 스크립트', () => {
  it('해당 계정의 비밀번호를 재설정한다', async () => {
    await signUp('a@example.com');

    await resetPassword(User, 'a@example.com', 'resetpassword1');

    const res = await request(app)
      .post('/api/auth/login').send({ email: 'a@example.com', password: 'resetpassword1' });
    expect(res.status).toBe(200);
  });

  it('재설정하면 그 계정의 기존 토큰이 전부 무효가 된다', async () => {
    const token = await signUp('a@example.com');

    await resetPassword(User, 'a@example.com', 'resetpassword1');

    expect((await request(app).get('/api/todos').set(asUser(token))).status).toBe(401);
  });

  it('대소문자가 달라도 같은 계정으로 찾는다', async () => {
    await signUp('a@example.com');

    await resetPassword(User, 'A@Example.COM', 'resetpassword1');

    const res = await request(app)
      .post('/api/auth/login').send({ email: 'a@example.com', password: 'resetpassword1' });
    expect(res.status).toBe(200);
  });

  it('없는 계정이면 아무것도 바꾸지 않고 실패한다', async () => {
    await signUp('a@example.com');

    await expect(resetPassword(User, 'nobody@example.com', 'resetpassword1')).rejects.toThrow();

    const res = await request(app)
      .post('/api/auth/login').send({ email: 'a@example.com', password: 'password1' });
    expect(res.status).toBe(200);
  });

  it('재설정 후 새 비밀번호로 받은 토큰이 실제로 통한다', async () => {
    await signUp('a@example.com');

    await resetPassword(User, 'a@example.com', 'resetpassword1');
    const login = await request(app)
      .post('/api/auth/login').send({ email: 'a@example.com', password: 'resetpassword1' });

    expect((await request(app).get('/api/todos').set(asUser(login.body.token))).status).toBe(200);
  });

  it('8자 미만이면 거절하고 비밀번호를 건드리지 않는다', async () => {
    await signUp('a@example.com');

    await expect(resetPassword(User, 'a@example.com', 'short')).rejects.toThrow(/8자/);

    const res = await request(app)
      .post('/api/auth/login').send({ email: 'a@example.com', password: 'password1' });
    expect(res.status).toBe(200);
  });
});

describe('알림 구독', () => {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/device-a',
    keys: { p256dh: 'p256dh-a', auth: 'auth-a' },
  };

  const subscribe = (token, sub = subscription) =>
    request(app).post('/api/push/subscribe').set(asUser(token)).send({ subscription: sub });

  it('로그인하지 않으면 구독할 수 없다', async () => {
    const res = await request(app).post('/api/push/subscribe').send({ subscription });
    expect(res.status).toBe(401);
    expect(await PushSubscription.countDocuments()).toBe(0);
  });

  it('공개키를 알려준다', async () => {
    const a = await signUp('a@example.com');
    const res = await request(app).get('/api/push/public-key').set(asUser(a));

    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBe('test-public-key');
  });

  it('서버에 알림 키가 없으면 503으로 거절한다', async () => {
    const a = await signUp('a@example.com');
    const saved = process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    try {
      expect((await request(app).get('/api/push/public-key').set(asUser(a))).status).toBe(503);
      expect((await subscribe(a)).status).toBe(503);
    } finally {
      process.env.VAPID_PUBLIC_KEY = saved;
    }
  });

  it('구독하면 그 사용자의 것으로 저장된다', async () => {
    const a = await signUp('a@example.com');
    const res = await subscribe(a);

    expect(res.status).toBe(200);
    const saved = await PushSubscription.findOne({ endpoint: subscription.endpoint });
    expect(saved.keys.auth).toBe('auth-a');
    expect(saved.last_sent_date).toBeNull();
    expect(String(saved.userId)).toBe(String((await User.findOne({ email: 'a@example.com' }))._id));
  });

  it('같은 기기에서 다시 구독해도 행이 늘어나지 않는다', async () => {
    const a = await signUp('a@example.com');
    await subscribe(a);
    await subscribe(a);

    expect(await PushSubscription.countDocuments()).toBe(1);
  });

  it('다른 계정으로 다시 구독하면 그 기기의 주인이 바뀐다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    await subscribe(a);
    await subscribe(b);

    const saved = await PushSubscription.findOne({ endpoint: subscription.endpoint });
    expect(await PushSubscription.countDocuments()).toBe(1);
    expect(String(saved.userId)).toBe(String((await User.findOne({ email: 'b@example.com' }))._id));
  });

  it('모양이 잘못된 구독은 저장하지 않는다', async () => {
    const a = await signUp('a@example.com');
    const res = await subscribe(a, { endpoint: 'http://insecure.example.com', keys: { p256dh: 'x', auth: 'y' } });

    expect(res.status).toBe(400);
    expect(await PushSubscription.countDocuments()).toBe(0);
  });

  it('남의 구독은 해제할 수 없다', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    await subscribe(a);

    const res = await request(app)
      .delete('/api/push/subscribe').set(asUser(b)).send({ endpoint: subscription.endpoint });

    expect(res.status).toBe(404);
    expect(await PushSubscription.countDocuments()).toBe(1);
  });

  it('자기 구독은 해제할 수 있다', async () => {
    const a = await signUp('a@example.com');
    await subscribe(a);

    const res = await request(app)
      .delete('/api/push/subscribe').set(asUser(a)).send({ endpoint: subscription.endpoint });

    expect(res.status).toBe(200);
    expect(await PushSubscription.countDocuments()).toBe(0);
  });

  it('구독하지 않은 사용자에게는 테스트 알림을 보내지 않는다', async () => {
    const a = await signUp('a@example.com');
    const res = await request(app).post('/api/push/test').set(asUser(a));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/알림을 먼저 켜/);
  });
});

describe('복습 흐름', () => {
  it('복습 대상 할일을 완료하면 1일 뒤 복습이 잡힌다', async () => {
    const a = await signUp('a@example.com');
    const todo = await addTodo(a, '망각곡선 대상', { needs_review: true });

    const res = await request(app)
      .put(`/api/todos/${todo.id}/complete`).set(asUser(a)).send({ completed: true });

    expect(res.body.activeReview.stage).toBe(0);
    const review = await Review.findById(res.body.activeReview.id);
    expect(String(review.userId)).toBe(String((await Todo.findById(todo.id)).userId));
  });
});
