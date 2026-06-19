const express = require('express');
const cors    = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const INTERVALS = [1, 3, 7, 16, 30];

/* ── MongoDB 연결 (서버리스 warm 인스턴스 재사용) ── */
let _client = null;
async function getDB() {
  if (!_client) {
    _client = new MongoClient(process.env.MONGODB_URI);
    await _client.connect();
  }
  return _client.db('studyapp');
}

/* ── 자동 증가 ID ──────────────────────────────── */
async function nextId(db, name) {
  const r = await db.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return r.seq;
}

/* ── 날짜 유틸 ─────────────────────────────────── */
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── 공통 함수 ─────────────────────────────────── */
function clean(t) {
  // MongoDB _id 제거
  const { _id, ...rest } = t;
  return {
    ...rest,
    perform_date: t.perform_date  || null,
    progress:     t.progress !== undefined ? t.progress : null,
    start_time:   t.start_time   || null,
    end_time:     t.end_time     || null,
  };
}

async function activeReview(db, todoId) {
  const r = await db.collection('reviews')
    .find({ todoId, completed: 0 }).sort({ stage: 1 }).toArray();
  return r[0] ? clean(r[0]) : null;
}

async function withReview(todo, db) {
  const t = clean(todo);
  return { ...t, activeReview: (t.needs_review && t.completed) ? await activeReview(db, t.id) : null };
}

async function doComplete(todo, db, today) {
  const upd = { completed: 1, completed_at: today };
  if (todo.needs_review) {
    await db.collection('reviews').updateMany({ todoId: todo.id }, { $set: { completed: 1 } });
    await db.collection('reviews').insertOne({
      id: await nextId(db, 'reviews'), todoId: todo.id, stage: 0,
      due_date: addDays(today, INTERVALS[0]), completed: 0, completed_at: null,
    });
  }
  return upd;
}

/* ── GET /api/todos ─────────────────────────────── */
app.get('/api/todos', async (req, res) => {
  try {
    const db = await getDB();
    const todos = await db.collection('todos').find({})
      .sort({ completed: 1, created_at: -1 }).toArray();
    res.json(await Promise.all(todos.map(t => withReview(t, db))));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── POST /api/todos ────────────────────────────── */
app.post('/api/todos', async (req, res) => {
  try {
    const { text, importance=1, deadline, perform_date, needs_review=false, start_time, end_time } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });
    const db = await getDB();
    const todo = {
      id: await nextId(db, 'todos'), text: text.trim(),
      importance: Number(importance),
      deadline: deadline || null, perform_date: perform_date || null,
      needs_review: needs_review ? 1 : 0, progress: null,
      start_time: start_time || null, end_time: end_time || null,
      completed: 0, completed_at: null, created_at: localDate(),
    };
    await db.collection('todos').insertOne(todo);
    res.json(await withReview(todo, db));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUT /api/todos/:id ─────────────────────────── */
app.put('/api/todos/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { text, importance, deadline, perform_date, needs_review, progress, start_time, end_time } = req.body;
    const db = await getDB();
    const todo = await db.collection('todos').findOne({ id });
    if (!todo) return res.status(404).json({ error: 'not found' });

    const upd = {
      text: text.trim(), importance: Number(importance),
      deadline: deadline || null, perform_date: perform_date || null,
      needs_review: needs_review ? 1 : 0,
      start_time: start_time || null, end_time: end_time || null,
    };
    if (progress !== undefined) upd.progress = progress;

    const effProgress = progress !== undefined ? progress : todo.progress;
    if (effProgress === 100 && !todo.completed)
      Object.assign(upd, await doComplete({ ...todo, ...upd }, db, localDate()));

    await db.collection('todos').updateOne({ id }, { $set: upd });
    res.json(await withReview({ ...todo, ...upd }, db));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── DELETE /api/todos/:id ──────────────────────── */
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = await getDB();
    await db.collection('todos').deleteOne({ id });
    await db.collection('reviews').deleteMany({ todoId: id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUT /api/todos/:id/complete ────────────────── */
app.put('/api/todos/:id/complete', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { completed } = req.body;
    const db = await getDB();
    const todo = await db.collection('todos').findOne({ id });
    if (!todo) return res.status(404).json({ error: 'not found' });

    const upd = {};
    if (completed) {
      Object.assign(upd, await doComplete(todo, db, localDate()));
      if (todo.progress === null) upd.progress = 100;
    } else {
      upd.completed = 0; upd.completed_at = null;
      await db.collection('reviews').deleteMany({ todoId: id });
    }
    await db.collection('todos').updateOne({ id }, { $set: upd });
    res.json(await withReview({ ...todo, ...upd }, db));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUT /api/todos/:id/progress ────────────────── */
app.put('/api/todos/:id/progress', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { progress } = req.body;
    const db = await getDB();
    const todo = await db.collection('todos').findOne({ id });
    if (!todo) return res.status(404).json({ error: 'not found' });

    const upd = { progress };
    if (progress === 100 && !todo.completed)
      Object.assign(upd, await doComplete(todo, db, localDate()));
    await db.collection('todos').updateOne({ id }, { $set: upd });
    res.json(await withReview({ ...todo, ...upd }, db));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUT /api/todos/:id/perform-date ────────────── */
app.put('/api/todos/:id/perform-date', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { perform_date } = req.body;
    const db = await getDB();
    const todo = await db.collection('todos').findOne({ id });
    if (!todo) return res.status(404).json({ error: 'not found' });

    const upd = { perform_date: perform_date || null };
    await db.collection('todos').updateOne({ id }, { $set: upd });
    res.json(await withReview({ ...todo, ...upd }, db));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUT /api/reviews/:id/complete ─────────────── */
app.put('/api/reviews/:id/complete', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = await getDB();
    const review = await db.collection('reviews').findOne({ id });
    if (!review) return res.status(404).json({ error: 'not found' });

    const today = localDate();
    await db.collection('reviews').updateOne({ id }, { $set: { completed: 1, completed_at: today } });

    const next = review.stage + 1;
    if (next < INTERVALS.length) {
      await db.collection('reviews').insertOne({
        id: await nextId(db, 'reviews'), todoId: review.todoId, stage: next,
        due_date: addDays(today, INTERVALS[next] - INTERVALS[review.stage]),
        completed: 0, completed_at: null,
      });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = app;
