// Express 앱과 모델 정의. 여기서는 DB에 연결하지도, 포트를 열지도 않는다.
// 실제 구동은 server.js가, 테스트는 인메모리 DB에 붙인 뒤 이 app을 supertest로 쓴다.

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { localDate, addDays } = require('./lib/dates');
const {
  validateCredentials, validatePassword, normalizeEmail,
  signToken, verifyToken, extractBearerToken,
} = require('./lib/auth');
const { validateSubscription, toWebPushSubscription } = require('./lib/push');
const { validateCategory, MAX_CATEGORIES } = require('./lib/categories');
const webpush = require('./lib/webpush');

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
  // 비밀번호가 바뀔 때마다 올린다. 토큰에 박힌 값과 다르면 그 토큰은 죽는다.
  token_version: { type: Number, default: 0 },
  created_at:    { type: String },
});

// userId는 모든 조회의 필터에 들어가므로 인덱스가 필요하다.
const todoSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text:         { type: String, required: true },
  importance:   { type: Number, default: 1 },
  category_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
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

// 사용자가 직접 만드는 할 일의 성격("영어", "과제"…). 색은 색값이 아니라 칸 번호다 —
// 실제 색은 화면에만 있어서(웹 App.css의 --cat-N, 앱 tokens.ts) 색을 다시 맞춰도
// 이미 저장된 성격이 그대로 따라온다.
const categorySchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:       { type: String, required: true },
  color:      { type: Number, required: true },
  created_at: { type: String },
});

// 칩에는 이름만 나오므로 같은 이름 둘은 화면에서 구분할 수 없다.
// userId가 인덱스 안에 있으니 다른 사용자는 같은 이름을 써도 된다.
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

const reviewSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  todoId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Todo' },
  stage:        { type: Number },
  due_date:     { type: String },
  completed:    { type: Number, default: 0 },
  completed_at: { type: String, default: null },
});

// 리마인더 잡은 사용자를 가리지 않고 "마감된 복습"을 훑는다 — userId 인덱스로는 도움이 안 된다.
reviewSchema.index({ due_date: 1, completed: 1 });

// 브라우저 하나(=기기 하나)당 한 행. endpoint가 곧 그 기기의 주소다.
const pushSubscriptionSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth:   { type: String, required: true },
  },
  created_at: { type: String },
  // 마지막으로 알림을 보낸 날. 재시작이나 tick 중복에도 하루 한 번만 보내게 하는 표시다.
  last_sent_date: { type: String, default: null },
});

// 테스트 러너는 이 파일을 CJS와 ESM 두 갈래로 각각 평가할 수 있다(reminders.js는 require로,
// 테스트는 import로 읽는다). 모델은 mongoose가 이름으로 하나만 들고 있으므로 이미 있으면 그것을 쓴다.
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

const User   = model('User', userSchema);
const Todo   = model('Todo', todoSchema);
const Review = model('Review', reviewSchema);
const Category = model('Category', categorySchema);
const PushSubscription = model('PushSubscription', pushSubscriptionSchema);

// ── 유틸 ──────────────────────────────────────────
// express 4는 async 핸들러가 던진 예외를 잡지 못해 요청이 그대로 매달린다.
// (잘못된 형식의 :id가 들어오면 mongoose가 CastError를 던진다)
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function formatTodo(t, activeReview) {
  return {
    id:           t._id,
    text:         t.text,
    importance:   t.importance,
    category_id:  t.category_id,
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

const formatCategory = c => ({
  id: c._id, name: c.name, color: c.color, created_at: c.created_at,
});

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

const UNKNOWN_CATEGORY = { error: '알 수 없는 성격입니다.' };

/**
 * 할 일에 붙일 성격 id를 확인한다. 빈 값이면 null(성격 없음), 쓸 수 없는 값이면 undefined.
 *
 * 남의 성격도 undefined다. 막지 않으면 B가 A의 성격 id를 자기 할 일에 영구히 박을 수 있고,
 * A가 그 성격을 지워도 정리(updateMany)는 A의 할 일만 훑으므로 그대로 남는다.
 *
 * 없는 성격·남의 성격·형식이 틀린 값에 **모두 같은 답**을 준다 — 그래야 남의 것이
 * 있는지 없는지가 새어 나가지 않는다.
 */
async function resolveCategoryId(value, userId) {
  if (value === null || value === undefined || value === '') return null;
  // 이 검사가 없으면 mongoose가 CastError를 던지고, 전역 처리기가 그걸 404로 바꿔
  // 다른 경로와 답이 어긋난다.
  if (!mongoose.Types.ObjectId.isValid(value)) return undefined;

  const found = await Category.findOne({ _id: value, userId }).select('_id');
  return found ? found._id : undefined;
}

// ── 인증 ──────────────────────────────────────────
function requireSecret(res) {
  if (jwtSecret()) return true;
  res.status(503).json({ error: '서버에 JWT_SECRET이 설정되지 않았습니다. 관리자에게 문의하세요.' });
  return false;
}

const unauthorized = res => res.status(401).json({ error: '로그인이 필요합니다.' });

// 서명만 보지 않고 사용자를 실제로 읽는다. 요청마다 조회가 하나 늘어나는 대신,
// 비밀번호가 바뀐 뒤의 옛 토큰과 사라진 계정의 토큰을 막을 수 있다.
const requireAuth = wrap(async (req, res, next) => {
  if (!requireSecret(res)) return;

  const payload = verifyToken(extractBearerToken(req.headers.authorization), jwtSecret());
  if (!payload || !mongoose.Types.ObjectId.isValid(payload.sub)) return unauthorized(res);

  const user = await User.findById(payload.sub);
  if (!user || user.token_version !== payload.ver) return unauthorized(res);

  req.userId = String(user._id);
  req.user = user;
  next();
});

const publicUser = user => ({ id: user._id, email: user.email });

/** 그 사용자의 현재 토큰 버전으로 발급한다. 버전을 빠뜨리면 발급 즉시 무효가 된다. */
const issueToken = user => signToken(user._id, jwtSecret(), { version: user.token_version });

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

  res.json({ token: issueToken(user), user: publicUser(user) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  if (!requireSecret(res)) return;
  const user = await User.findOne({ email: normalizeEmail(req.body.email) });
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  // 이메일이 없는지 비밀번호가 틀린지는 구분해서 알려주지 않는다 (계정 존재 여부 노출 방지)
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  res.json({ token: issueToken(user), user: publicUser(user) });
}));

// 저장된 토큰이 아직 유효한지 확인하는 용도 (requireAuth가 이미 사용자를 읽어둔다)
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ── PUT 비밀번호 변경 ──────────────────────────────
app.put('/api/auth/password', requireAuth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user;

  const given = typeof currentPassword === 'string' ? currentPassword : '';
  if (!await bcrypt.compare(given, user.password_hash)) {
    return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
  }

  const check = validatePassword(newPassword);
  if (!check.ok) return res.status(400).json({ error: check.error });
  if (newPassword === given) {
    return res.status(400).json({ error: '새 비밀번호는 현재와 다른 값이어야 합니다.' });
  }

  user.password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.token_version += 1;   // 지금까지 발급된 토큰을 모두 무효로 만든다
  await user.save();

  // 방금 바꾼 기기까지 로그아웃시키면 불편하므로 새 토큰을 돌려준다
  res.json({ token: issueToken(user) });
}));

// ── DELETE 회원 탈퇴 ───────────────────────────────
// 앱스토어(App Store 5.1.1(v) / Google Play)는 계정을 만들 수 있는 앱에 앱 안에서의
// 삭제 경로를 요구한다. 유예 기간을 두지 않고 그 자리에서 전부 지운다.
// 웹과 앱이 같은 라우트를 쓴다.
app.delete('/api/auth/me', requireAuth, wrap(async (req, res) => {
  const user = req.user;

  const given = typeof req.body?.password === 'string' ? req.body.password : '';
  // 여기만 401이 아니라 403이다. 프론트의 authFetch는 401을 "세션 만료"로 보고 무조건
  // 로그아웃시키므로, 비밀번호를 한 번 잘못 치면 모달째로 튕겨나간다.
  if (!await bcrypt.compare(given, user.password_hash)) {
    return res.status(403).json({ error: '비밀번호가 올바르지 않습니다.' });
  }

  // 트랜잭션을 걸지 않는 대신 순서로 지킨다 — User를 마지막에 지워야, 중간에 실패해도
  // 다시 로그인해서 탈퇴를 재시도할 수 있다. 먼저 지우면 주인 없는 문서만 남는다.
  const userId = user._id;
  await PushSubscription.deleteMany({ userId });
  await Review.deleteMany({ userId });
  await Todo.deleteMany({ userId });
  await User.deleteOne({ _id: userId });

  // 남아 있는 토큰은 따로 무효로 만들지 않아도 된다 — requireAuth가 요청마다 사용자를
  // 실제로 읽으므로, 계정 문서가 사라지는 순간 모든 기기의 토큰이 401이 된다.
  res.json({ ok: true });
}));

// 여기부터 아래 모든 라우트는 로그인이 필요하다.
app.use('/api/todos', requireAuth);
app.use('/api/reviews', requireAuth);
app.use('/api/categories', requireAuth);
app.use('/api/push', requireAuth);

// ── GET 전체 할일 ──────────────────────────────────
app.get('/api/todos', wrap(async (req, res) => {
  const todos = await Todo.find({ userId: req.userId }).sort({ completed: 1, created_at: -1 });
  const result = await Promise.all(todos.map(t => withActiveReview(t)));
  res.json(result);
}));

// ── POST 할일 추가 ─────────────────────────────────
app.post('/api/todos', wrap(async (req, res) => {
  const { text, importance=1, category_id, deadline, perform_date, needs_review=false, start_time, end_time } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const categoryId = await resolveCategoryId(category_id, req.userId);
  if (categoryId === undefined) return res.status(400).json(UNKNOWN_CATEGORY);

  const todo = await Todo.create({
    userId: req.userId,
    text: text.trim(), importance: Number(importance),
    category_id: categoryId,
    deadline: deadline||null, perform_date: perform_date||null,
    needs_review: needs_review ? 1 : 0,
    start_time: start_time||null, end_time: end_time||null,
    created_at: localDate(),
  });
  res.json(await withActiveReview(todo));
}));

// ── PUT 할일 수정 ──────────────────────────────────
app.put('/api/todos/:id', wrap(async (req, res) => {
  const { text, importance, category_id, deadline, perform_date, needs_review, progress, start_time, end_time } = req.body;
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

  // 위의 필드들과 달리 **조건부**다. progress와 같은 이유다.
  // 이 라우트는 나열된 것을 무조건 덮어쓰므로, 무조건 대입하면 이 필드를 모르는
  // 옛 화면이 수정을 보낼 때마다 성격이 지워진다 — 홈 화면에 설치한 앱은 사용자가
  // 갱신을 수락할 때까지 캐시된 옛 번들로 돈다(CLAUDE.md "설치한 앱(PWA)의 갱신").
  // 그래서 성격을 없애려면 생략이 아니라 category_id: null을 명시해서 보내야 한다.
  if (category_id !== undefined) {
    const next = await resolveCategoryId(category_id, req.userId);
    if (next === undefined) return res.status(400).json(UNKNOWN_CATEGORY);
    todo.category_id = next;
  }

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

// ── 할 일 성격 ─────────────────────────────────────
const DUPLICATE_KEY = 11000;
const duplicateName = res => res.status(409).json({ error: '같은 이름의 성격이 이미 있습니다.' });

app.get('/api/categories', wrap(async (req, res) => {
  // _id로 정렬한다 — created_at은 날짜 단위 문자열이라 같은 날 만든 것끼리 순서가
  // 요청마다 흔들리고, 그러면 관리 화면의 목록이 이유 없이 뒤바뀐다.
  const categories = await Category.find({ userId: req.userId }).sort({ _id: 1 });
  res.json(categories.map(formatCategory));
}));

app.post('/api/categories', wrap(async (req, res) => {
  const valid = validateCategory(req.body);
  if (!valid.ok) return res.status(400).json({ error: valid.error });

  const count = await Category.countDocuments({ userId: req.userId });
  if (count >= MAX_CATEGORIES) {
    return res.status(400).json({ error: `성격은 최대 ${MAX_CATEGORIES}개까지 만들 수 있습니다.` });
  }

  // 인덱스에만 기대지 않고 여기서 먼저 본다. 유니크 인덱스는 연결 직후 비동기로
  // 만들어지는데, 그 사이에 들어온 요청은 인덱스를 지나지 않아 중복이 그대로 저장된다.
  // 한 번 중복이 생기면 인덱스 만들기가 영영 실패해서 그 뒤로는 아무도 막히지 않는다.
  if (await Category.findOne({ userId: req.userId, name: valid.name })) return duplicateName(res);

  try {
    const category = await Category.create({
      userId: req.userId, name: valid.name, color: valid.color, created_at: localDate(),
    });
    res.json(formatCategory(category));
  } catch (err) {
    // 유니크 인덱스는 비동기로 만들어진다. 미리 조회해서 막는 것만으로는 부족해서
    // 회원가입(POST /api/auth/register)과 같은 방식으로 여기서도 한 번 더 받아낸다.
    if (err.code === DUPLICATE_KEY) return duplicateName(res);
    throw err;
  }
}));

app.put('/api/categories/:id', wrap(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, userId: req.userId });
  if (!category) return res.status(404).json({ error: 'not found' });

  const valid = validateCategory(req.body);
  if (!valid.ok) return res.status(400).json({ error: valid.error });

  // 자기 자신은 빼고 본다 — 이름을 그대로 두고 색만 바꾸는 것은 중복이 아니다.
  const sameName = await Category.findOne({
    userId: req.userId, name: valid.name, _id: { $ne: category._id },
  });
  if (sameName) return duplicateName(res);

  category.name = valid.name;
  category.color = valid.color;
  try {
    await category.save();
    res.json(formatCategory(category));
  } catch (err) {
    if (err.code === DUPLICATE_KEY) return duplicateName(res);
    throw err;
  }
}));

app.delete('/api/categories/:id', wrap(async (req, res) => {
  // 성격을 **먼저** 지우고 할 일을 비운다. 이 앱에는 트랜잭션이 없어서 둘 사이에서
  // 죽을 수 있는데, 이 순서로 남는 상태는 "성격은 없고 일부 할 일이 죽은 id를 들고 있다"다.
  // 화면은 없는 성격을 조용히 무시해 칩을 안 그리므로 사용자가 누른 그대로 보이고,
  // 그 할 일을 다음에 수정할 때 스스로 정리된다.
  // 반대로 했다면 "성격은 살아있는데 할 일에서만 떨어져 나감" — 아무도 요청하지 않은
  // 데이터 손실이 조용히 남는다.
  const removed = await Category.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!removed) return res.status(404).json({ error: 'not found' });

  // 남의 것을 건드릴 일이 없더라도 userId를 함께 건다 — 이 파일의 모든 질의가 그렇고,
  // 여기만 예외인지 읽는 사람이 따져보게 만들지 않는다.
  await Todo.updateMany(
    { userId: req.userId, category_id: removed._id },
    { $set: { category_id: null } },
  );
  res.json({ success: true });
}));

// ── 알림 구독 ─────────────────────────────────────
// JWT_SECRET과 같은 방식: 키가 없으면 기능만 503으로 거절하고 서버는 계속 산다.
function requireVapid(res) {
  if (webpush.isConfigured()) return true;
  res.status(503).json({ error: '서버에 알림 키가 설정되지 않았습니다. 관리자에게 문의하세요.' });
  return false;
}

// 브라우저가 구독을 만들려면 공개키가 필요하다. 라우트로 주면 프론트를 다시 빌드하지 않고 키를 바꿀 수 있다.
app.get('/api/push/public-key', (req, res) => {
  if (!requireVapid(res)) return;
  res.json({ publicKey: webpush.publicKey() });
});

// 같은 endpoint로 다시 부르면 갱신된다(upsert). 그래서 여러 번 눌러도, 다른 계정으로 로그인해도 안전하다.
app.post('/api/push/subscribe', wrap(async (req, res) => {
  if (!requireVapid(res)) return;

  const check = validateSubscription(req.body.subscription || req.body);
  if (!check.ok) return res.status(400).json({ error: check.error });

  const { endpoint, keys } = check.subscription;
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { userId: req.userId, endpoint, keys, created_at: localDate() },
    { upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true });
}));

// 남의 기기 구독은 존재하지 않는 것처럼 취급한다.
app.delete('/api/push/subscribe', wrap(async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string' || !endpoint) {
    return res.status(400).json({ error: '구독 주소가 없습니다.' });
  }

  const removed = await PushSubscription.findOneAndDelete({ endpoint, userId: req.userId });
  if (!removed) return res.status(404).json({ error: 'not found' });
  res.json({ success: true });
}));

// 09시를 기다리지 않고 알림 경로 전체를 확인하는 용도.
app.post('/api/push/test', wrap(async (req, res) => {
  if (!requireVapid(res)) return;

  const subs = await PushSubscription.find({ userId: req.userId });
  if (subs.length === 0) {
    return res.status(400).json({ error: '이 기기에서 알림을 먼저 켜 주세요.' });
  }

  const payload = { title: '알림 테스트', body: '알림이 정상적으로 도착했습니다.' };
  const results = await Promise.all(
    subs.map(sub => webpush.sendTo(toWebPushSubscription(sub), payload))
  );

  // 만료된 구독은 여기서 정리한다 (알림을 끄지 않고 앱을 지운 기기 등)
  const gone = subs.filter((_, i) => results[i].gone).map(s => s._id);
  if (gone.length > 0) await PushSubscription.deleteMany({ _id: { $in: gone } });

  const sent = results.filter(r => r.ok).length;
  if (sent === 0) return res.status(502).json({ error: '알림을 보내지 못했습니다. 알림을 다시 켜 보세요.' });
  res.json({ success: true, sent });
}));

// ── 에러 처리 ─────────────────────────────────────
// 잘못된 형식의 id(CastError)는 사용자 실수이므로 404로, 나머지는 500으로.
// eslint-disable-next-line no-unused-vars
app.use('/api', (err, req, res, next) => {
  if (err.name === 'CastError') return res.status(404).json({ error: 'not found' });
  console.error('[API]', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

module.exports = { app, User, Todo, Review, Category, PushSubscription, INTERVALS };
