// Express 앱과 모델 정의. 여기서는 DB에 연결하지도, 포트를 열지도 않는다.
// 실제 구동은 server.js가, 테스트는 인메모리 DB에 붙인 뒤 이 app을 supertest로 쓴다.

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { localDate, addDays } = require('./lib/dates');
const {
  validateCredentials, normalizeEmail,
  signToken, verifyToken, extractBearerToken,
} = require('./lib/auth');

const INTERVALS = [1, 3, 7, 16, 30];
const BCRYPT_ROUNDS = 10;

// 모듈 로드 시점이 아니라 요청 시점에 읽는다 (테스트에서 환경변수를 나중에 넣을 수 있도록)
const jwtSecret = () => process.env.JWT_SECRET;

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// DB가 아직 연결되지 않았으면 요청을 매달아두지 말고 즉시 503을 준다.
// (mongoose는 기본적으로 명령을 버퍼링해서 연결될 때까지 응답이 지연된다)
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: '데이터베이스 연결 준비 중입니다. 잠시 후 다시 시도해 주세요.' });
  }
  next();
});

// ── MongoDB 스키마 ─────────────────────────────────
const userSchema = new mongoose.Schema({
  email:         { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  created_at:    { type: String },
});

// userId는 모든 조회의 필터에 들어가므로 인덱스가 필요하다.
const todoSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text:         { type: String, required: true },
  importance:   { type: Number, default: 1 },
  deadline:     { type: String, default: null },
  perform_date: { type: String, default: null },
  needs_review: { type: Number, default: 0 },
  progress:     { type: Number, default: null },
  start_time:   { type: String, default: null },
  end_time:     { type: String, default: null },
  completed:    { type: Number, default: 0 },
  completed_at: { type: String, default: null },
  created_at:   { type: String },
});

const reviewSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  todoId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Todo' },
  stage:        { type: Number },
  due_date:     { type: String },
  completed:    { type: Number, default: 0 },
  completed_at: { type: String, default: null },
});

const User   = mongoose.model('User', userSchema);
const Todo   = mongoose.model('Todo', todoSchema);
const Review = mongoose.model('Review', reviewSchema);

// ── 유틸 ──────────────────────────────────────────
// express 4는 async 핸들러가 던진 예외를 잡지 못해 요청이 그대로 매달린다.
// (잘못된 형식의 :id가 들어오면 mongoose가 CastError를 던진다)
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function formatTodo(t, activeReview) {
  return {
    id:           t._id,
    text:         t.text,
    importance:   t.importance,
    deadline:     t.deadline,
    perform_date: t.perform_date,
    needs_review: t.needs_review,
    progress:     t.progress,
    start_time:   t.start_time,
    end_time:     t.end_time,
    completed:    t.completed,
    completed_at: t.completed_at,
    created_at:   t.created_at,
    activeReview: activeReview || null,
  };
}

async function getActiveReview(todoId, userId) {
  const reviews = await Review.find({ todoId, userId, completed: 0 }).sort({ stage: 1 });
  return reviews[0] || null;
}

async function withActiveReview(todo) {
  let activeReview = null;
  if (todo.needs_review && todo.completed) {
    const r = await getActiveReview(todo._id, todo.userId);
    if (r) activeReview = { id: r._id, stage: r.stage, due_date: r.due_date };
  }
  return formatTodo(todo, activeReview);
}

async function markCompleted(todo) {
  const today = localDate();
  todo.completed    = 1;
  todo.completed_at = today;
  if (todo.needs_review) {
    await Review.deleteMany({ todoId: todo._id });
    await Review.create({
      userId: todo.userId, todoId: todo._id, stage: 0,
      due_date: addDays(today, INTERVALS[0]), completed: 0, completed_at: null,
    });
  }
}

/** 요청한 사용자가 가진 할일만 찾는다. 남의 할일은 존재하지 않는 것처럼 취급한다. */
function findOwnTodo(req) {
  return Todo.findOne({ _id: req.params.id, userId: req.userId });
}

// ── 인증 ──────────────────────────────────────────
function requireSecret(res) {
  if (jwtSecret()) return true;
  res.status(503).json({ error: '서버에 JWT_SECRET이 설정되지 않았습니다. 관리자에게 문의하세요.' });
  return false;
}

function requireAuth(req, res, next) {
  if (!requireSecret(res)) return;
  const userId = verifyToken(extractBearerToken(req.headers.authorization), jwtSecret());
  if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });
  req.userId = userId;
  next();
}

const publicUser = user => ({ id: user._id, email: user.email });

app.post('/api/auth/register', wrap(async (req, res) => {
  if (!requireSecret(res)) return;
  const check = validateCredentials(req.body.email, req.body.password);
  if (!check.ok) return res.status(400).json({ error: check.error });

  if (await User.findOne({ email: check.email })) {
    return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
  }

  let user;
  try {
    user = await User.create({
      email: check.email,
      password_hash: await bcrypt.hash(req.body.password, BCRYPT_ROUNDS),
      created_at: localDate(),
    });
  } catch (err) {
    // 위 중복 검사와 저장 사이에 같은 이메일이 먼저 들어온 경우 (unique 인덱스 충돌)
    if (err.code === 11000) return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    throw err;
  }

  res.json({ token: signToken(user._id, jwtSecret()), user: publicUser(user) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  if (!requireSecret(res)) return;
  const user = await User.findOne({ email: normalizeEmail(req.body.email) });
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  // 이메일이 없는지 비밀번호가 틀린지는 구분해서 알려주지 않는다 (계정 존재 여부 노출 방지)
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  res.json({ token: signToken(user._id, jwtSecret()), user: publicUser(user) });
}));

// 저장된 토큰이 아직 유효한지 확인하는 용도
app.get('/api/auth/me', requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  res.json({ user: publicUser(user) });
}));

// 여기부터 아래 모든 라우트는 로그인이 필요하다.
app.use('/api/todos', requireAuth);
app.use('/api/reviews', requireAuth);

// ── GET 전체 할일 ──────────────────────────────────
app.get('/api/todos', wrap(async (req, res) => {
  const todos = await Todo.find({ userId: req.userId }).sort({ completed: 1, created_at: -1 });
  const result = await Promise.all(todos.map(t => withActiveReview(t)));
  res.json(result);
}));

// ── POST 할일 추가 ─────────────────────────────────
app.post('/api/todos', wrap(async (req, res) => {
  const { text, importance=1, deadline, perform_date, needs_review=false, start_time, end_time } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const todo = await Todo.create({
    userId: req.userId,
    text: text.trim(), importance: Number(importance),
    deadline: deadline||null, perform_date: perform_date||null,
    needs_review: needs_review ? 1 : 0,
    start_time: start_time||null, end_time: end_time||null,
    created_at: localDate(),
  });
  res.json(await withActiveReview(todo));
}));

// ── PUT 할일 수정 ──────────────────────────────────
app.put('/api/todos/:id', wrap(async (req, res) => {
  const { text, importance, deadline, perform_date, needs_review, progress, start_time, end_time } = req.body;
  const todo = await findOwnTodo(req);
  if (!todo) return res.status(404).json({ error: 'not found' });

  todo.text         = text.trim();
  todo.importance   = Number(importance);
  todo.deadline     = deadline    || null;
  todo.perform_date = perform_date|| null;
  todo.needs_review = needs_review ? 1 : 0;
  todo.start_time   = start_time  || null;
  todo.end_time     = end_time    || null;
  if (progress !== undefined) todo.progress = progress;
  if (todo.progress === 100 && !todo.completed) await markCompleted(todo);

  await todo.save();
  res.json(await withActiveReview(todo));
}));

// ── DELETE 할일 삭제 ───────────────────────────────
app.delete('/api/todos/:id', wrap(async (req, res) => {
  const todo = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!todo) return res.status(404).json({ error: 'not found' });
  await Review.deleteMany({ todoId: todo._id });
  res.json({ success: true });
}));

// ── PUT 완료 토글 ──────────────────────────────────
app.put('/api/todos/:id/complete', wrap(async (req, res) => {
  const { completed } = req.body;
  const todo = await findOwnTodo(req);
  if (!todo) return res.status(404).json({ error: 'not found' });

  if (completed) {
    await markCompleted(todo);
    if (todo.progress === null) todo.progress = 100;
  } else {
    todo.completed = 0; todo.completed_at = null;
    await Review.deleteMany({ todoId: todo._id });
  }
  await todo.save();
  res.json(await withActiveReview(todo));
}));

// ── PUT 진행률 업데이트 ────────────────────────────
app.put('/api/todos/:id/progress', wrap(async (req, res) => {
  const { progress } = req.body;
  const todo = await findOwnTodo(req);
  if (!todo) return res.status(404).json({ error: 'not found' });

  todo.progress = progress;
  if (progress === 100 && !todo.completed) await markCompleted(todo);
  await todo.save();
  res.json(await withActiveReview(todo));
}));

// ── PUT 수행날짜 설정 ──────────────────────────────
app.put('/api/todos/:id/perform-date', wrap(async (req, res) => {
  const { perform_date } = req.body;
  const todo = await findOwnTodo(req);
  if (!todo) return res.status(404).json({ error: 'not found' });

  todo.perform_date = perform_date || null;
  await todo.save();
  res.json(await withActiveReview(todo));
}));

// ── PUT 복습 단계 완료 ─────────────────────────────
app.put('/api/reviews/:id/complete', wrap(async (req, res) => {
  const review = await Review.findOne({ _id: req.params.id, userId: req.userId });
  if (!review) return res.status(404).json({ error: 'not found' });

  const today = localDate();
  review.completed = 1; review.completed_at = today;
  await review.save();

  const nextStage = review.stage + 1;
  if (nextStage < INTERVALS.length) {
    const diff = INTERVALS[nextStage] - INTERVALS[review.stage];
    await Review.create({
      userId: review.userId, todoId: review.todoId, stage: nextStage,
      due_date: addDays(today, diff), completed: 0, completed_at: null,
    });
  }
  res.json({ success: true });
}));

// ── 에러 처리 ─────────────────────────────────────
// 잘못된 형식의 id(CastError)는 사용자 실수이므로 404로, 나머지는 500으로.
// eslint-disable-next-line no-unused-vars
app.use('/api', (err, req, res, next) => {
  if (err.name === 'CastError') return res.status(404).json({ error: 'not found' });
  console.error('[API]', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

module.exports = { app, User, Todo, Review, INTERVALS };
