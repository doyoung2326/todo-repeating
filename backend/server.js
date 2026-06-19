const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'data.json');
const INTERVALS = [1, 3, 7, 16, 30];

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {}
  return { todos: [], reviews: [], nextTodoId: 1, nextReviewId: 1 };
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeTodo(t) {
  return {
    ...t,
    perform_date: t.perform_date || null,
    progress:     t.progress !== undefined ? t.progress : null,
    start_time:   t.start_time || null,
    end_time:     t.end_time || null,
  };
}

function getActiveReview(db, todoId) {
  return db.reviews
    .filter(r => r.todoId === todoId && !r.completed)
    .sort((a, b) => a.stage - b.stage)[0] || null;
}

function withActiveReview(todo, db) {
  const t = normalizeTodo(todo);
  let activeReview = null;
  if (t.needs_review && t.completed) activeReview = getActiveReview(db, t.id);
  return { ...t, activeReview };
}

// 완료 처리 + 복습 일정 생성 (내부 공통 함수)
function markCompleted(todo, db) {
  const today = localDate();
  todo.completed = 1;
  todo.completed_at = today;
  if (todo.needs_review) {
    db.reviews = db.reviews.filter(r => r.todoId !== todo.id);
    db.reviews.push({
      id: db.nextReviewId++, todoId: todo.id, stage: 0,
      due_date: addDays(today, INTERVALS[0]), completed: 0, completed_at: null,
    });
  }
}

// ── GET 전체 할일 ─────────────────────────────────
app.get('/api/todos', (req, res) => {
  const db = loadDB();
  const sorted = [...db.todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  res.json(sorted.map(t => withActiveReview(t, db)));
});

// ── POST 할일 추가 ────────────────────────────────
app.post('/api/todos', (req, res) => {
  const { text, importance = 1, deadline, perform_date, needs_review = false,
          start_time, end_time } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const db = loadDB();
  const todo = {
    id: db.nextTodoId++, text: text.trim(),
    importance: Number(importance),
    deadline: deadline || null,
    perform_date: perform_date || null,
    needs_review: needs_review ? 1 : 0,
    progress: null,
    start_time: start_time || null,
    end_time: end_time || null,
    completed: 0, completed_at: null,
    created_at: localDate(),
  };
  db.todos.push(todo);
  saveDB(db);
  res.json(withActiveReview(todo, db));
});

// ── PUT 할일 수정 ─────────────────────────────────
app.put('/api/todos/:id', (req, res) => {
  const id = Number(req.params.id);
  const { text, importance, deadline, perform_date, needs_review,
          progress, start_time, end_time } = req.body;
  const db = loadDB();
  const todo = db.todos.find(t => t.id === id);
  if (!todo) return res.status(404).json({ error: 'not found' });

  todo.text        = text.trim();
  todo.importance  = Number(importance);
  todo.deadline    = deadline    || null;
  todo.perform_date= perform_date|| null;
  todo.needs_review= needs_review ? 1 : 0;
  todo.start_time  = start_time  || null;
  todo.end_time    = end_time    || null;
  if (progress !== undefined) todo.progress = progress;

  // 진행률 100%면 자동 완료
  if (todo.progress === 100 && !todo.completed) markCompleted(todo, db);

  saveDB(db);
  res.json(withActiveReview(todo, db));
});

// ── DELETE 할일 삭제 ──────────────────────────────
app.delete('/api/todos/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = loadDB();
  db.todos   = db.todos.filter(t => t.id !== id);
  db.reviews = db.reviews.filter(r => r.todoId !== id);
  saveDB(db);
  res.json({ success: true });
});

// ── PUT 완료 토글 ─────────────────────────────────
app.put('/api/todos/:id/complete', (req, res) => {
  const id = Number(req.params.id);
  const { completed } = req.body;
  const db = loadDB();
  const todo = db.todos.find(t => t.id === id);
  if (!todo) return res.status(404).json({ error: 'not found' });

  if (completed) {
    markCompleted(todo, db);
    if (todo.progress === null) todo.progress = 100;
  } else {
    todo.completed = 0; todo.completed_at = null;
    db.reviews = db.reviews.filter(r => r.todoId !== id);
  }
  saveDB(db);
  res.json(withActiveReview(todo, db));
});

// ── PUT 진행률 업데이트 ───────────────────────────
app.put('/api/todos/:id/progress', (req, res) => {
  const id = Number(req.params.id);
  const { progress } = req.body;
  const db = loadDB();
  const todo = db.todos.find(t => t.id === id);
  if (!todo) return res.status(404).json({ error: 'not found' });

  todo.progress = progress;
  if (progress === 100 && !todo.completed) markCompleted(todo, db);

  saveDB(db);
  res.json(withActiveReview(todo, db));
});

// ── PUT 수행날짜 설정 ─────────────────────────────
app.put('/api/todos/:id/perform-date', (req, res) => {
  const id = Number(req.params.id);
  const { perform_date } = req.body;
  const db = loadDB();
  const todo = db.todos.find(t => t.id === id);
  if (!todo) return res.status(404).json({ error: 'not found' });

  todo.perform_date = perform_date || null;
  saveDB(db);
  res.json(withActiveReview(todo, db));
});

// ── PUT 복습 단계 완료 ────────────────────────────
app.put('/api/reviews/:id/complete', (req, res) => {
  const id = Number(req.params.id);
  const db = loadDB();
  const review = db.reviews.find(r => r.id === id);
  if (!review) return res.status(404).json({ error: 'not found' });

  const today = localDate();
  review.completed = 1; review.completed_at = today;

  const nextStage = review.stage + 1;
  if (nextStage < INTERVALS.length) {
    const diff = INTERVALS[nextStage] - INTERVALS[review.stage];
    db.reviews.push({
      id: db.nextReviewId++, todoId: review.todoId, stage: nextStage,
      due_date: addDays(today, diff), completed: 0, completed_at: null,
    });
  }
  saveDB(db);
  res.json({ success: true });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log('\n[Server] http://localhost:' + PORT);
  console.log('[Server] Open http://localhost:5173\n');
});
