require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const INTERVALS = [1, 3, 7, 16, 30];

// ── MongoDB 스키마 ─────────────────────────────────
const todoSchema = new mongoose.Schema({
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
  todoId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Todo' },
  stage:        { type: Number },
  due_date:     { type: String },
  completed:    { type: Number, default: 0 },
  completed_at: { type: String, default: null },
});

const Todo   = mongoose.model('Todo', todoSchema);
const Review = mongoose.model('Review', reviewSchema);

// ── 유틸 ──────────────────────────────────────────
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

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

async function getActiveReview(todoId) {
  const reviews = await Review.find({ todoId, completed: 0 }).sort({ stage: 1 });
  return reviews[0] || null;
}

async function withActiveReview(todo) {
  let activeReview = null;
  if (todo.needs_review && todo.completed) {
    const r = await getActiveReview(todo._id);
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
      todoId: todo._id, stage: 0,
      due_date: addDays(today, INTERVALS[0]), completed: 0, completed_at: null,
    });
  }
}

// ── GET 전체 할일 ──────────────────────────────────
app.get('/api/todos', async (req, res) => {
  const todos = await Todo.find().sort({ completed: 1, created_at: -1 });
  const result = await Promise.all(todos.map(t => withActiveReview(t)));
  res.json(result);
});

// ── POST 할일 추가 ─────────────────────────────────
app.post('/api/todos', async (req, res) => {
  const { text, importance=1, deadline, perform_date, needs_review=false, start_time, end_time } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const todo = await Todo.create({
    text: text.trim(), importance: Number(importance),
    deadline: deadline||null, perform_date: perform_date||null,
    needs_review: needs_review ? 1 : 0,
    start_time: start_time||null, end_time: end_time||null,
    created_at: localDate(),
  });
  res.json(await withActiveReview(todo));
});

// ── PUT 할일 수정 ──────────────────────────────────
app.put('/api/todos/:id', async (req, res) => {
  const { text, importance, deadline, perform_date, needs_review, progress, start_time, end_time } = req.body;
  const todo = await Todo.findById(req.params.id);
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
});

// ── DELETE 할일 삭제 ───────────────────────────────
app.delete('/api/todos/:id', async (req, res) => {
  await Todo.findByIdAndDelete(req.params.id);
  await Review.deleteMany({ todoId: req.params.id });
  res.json({ success: true });
});

// ── PUT 완료 토글 ──────────────────────────────────
app.put('/api/todos/:id/complete', async (req, res) => {
  const { completed } = req.body;
  const todo = await Todo.findById(req.params.id);
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
});

// ── PUT 진행률 업데이트 ────────────────────────────
app.put('/api/todos/:id/progress', async (req, res) => {
  const { progress } = req.body;
  const todo = await Todo.findById(req.params.id);
  if (!todo) return res.status(404).json({ error: 'not found' });

  todo.progress = progress;
  if (progress === 100 && !todo.completed) await markCompleted(todo);
  await todo.save();
  res.json(await withActiveReview(todo));
});

// ── PUT 수행날짜 설정 ──────────────────────────────
app.put('/api/todos/:id/perform-date', async (req, res) => {
  const { perform_date } = req.body;
  const todo = await Todo.findById(req.params.id);
  if (!todo) return res.status(404).json({ error: 'not found' });

  todo.perform_date = perform_date || null;
  await todo.save();
  res.json(await withActiveReview(todo));
});

// ── PUT 복습 단계 완료 ─────────────────────────────
app.put('/api/reviews/:id/complete', async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ error: 'not found' });

  const today = localDate();
  review.completed = 1; review.completed_at = today;
  await review.save();

  const nextStage = review.stage + 1;
  if (nextStage < INTERVALS.length) {
    const diff = INTERVALS[nextStage] - INTERVALS[review.stage];
    await Review.create({
      todoId: review.todoId, stage: nextStage,
      due_date: addDays(today, diff), completed: 0, completed_at: null,
    });
  }
  res.json({ success: true });
});

// ── 서버 시작 ──────────────────────────────────────
const PORT = process.env.PORT || 3001;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`[Server] http://localhost:${PORT}`));
    console.log('[MongoDB] 연결 성공');
  })
  .catch(err => {
    console.error('[MongoDB] 연결 실패:', err.message);
    process.exit(1);
  });
