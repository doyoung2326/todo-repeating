// 매일 정해진 시각에 "오늘 복습할 것"을 알려주는 잡.
//
// app.js는 이 파일을 모른다(모델만 이쪽으로 흘러온다) — 그래서 순환 import가 없다.
// 구동은 server.js가, 수동 실행은 scripts/send-reminders.js가 한다.

const mongoose = require('mongoose');
// 확장자를 붙여야 테스트 러너가 app.test.js의 import와 같은 모듈로 본다
// (없으면 app.js가 두 번 평가되어 mongoose 모델이 중복 등록된다)
const { Todo, Review, PushSubscription, INTERVALS } = require('./app.js');
const { toDateStr } = require('./lib/dates');
const { toClockTime, toWebPushSubscription, shouldSendNow, buildReminder } = require('./lib/push');
const webpush = require('./lib/webpush');

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * 오늘까지 마감인 복습을 사용자별로 묶는다.
 * 할 일 하나당 가장 낮은 단계 하나만 남기고, 지워진 할 일은 뺀다.
 */
async function collectDueReviews(today) {
  const byUser = new Map();

  const reviews = await Review.find({ completed: 0, due_date: { $lte: today } })
    .sort({ stage: 1 })
    .lean();
  if (reviews.length === 0) return byUser;

  const todos = await Todo.find({ _id: { $in: reviews.map(r => r.todoId) } })
    .select('_id text')
    .lean();
  const textOf = new Map(todos.map(t => [String(t._id), t.text]));

  const seen = new Set();
  for (const review of reviews) {
    const todoId = String(review.todoId);
    if (seen.has(todoId)) continue;

    const text = textOf.get(todoId);
    if (!text) continue;   // 할 일이 지워졌으면 알릴 것도 없다
    seen.add(todoId);

    const userId = String(review.userId);
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId).push({ text, stage: review.stage, due_date: review.due_date });
  }
  return byUser;
}

/**
 * 한 번 돌면서 보낼 사람에게 보낸다.
 *
 * send를 주입받는 것은 lib/retry.js가 sleep을 주입받는 것과 같은 이유다 —
 * 실제 발송 없이 테스트할 수 있어야 한다.
 * force는 시각 검사와 "오늘 이미 보냄" 표시를 무시한다(수동 확인용).
 */
async function runReminderTick({ now = new Date(), send = webpush.sendTo, force = false } = {}) {
  if (mongoose.connection.readyState !== 1) return { sent: 0, skipped: 'db' };
  if (!webpush.isConfigured()) return { sent: 0, skipped: 'vapid' };

  const today = toDateStr(now);
  const nowTime = toClockTime(now);

  const byUser = await collectDueReviews(today);
  if (byUser.size === 0) return { sent: 0, removed: 0 };

  const subs = await PushSubscription.find({ userId: { $in: [...byUser.keys()] } });
  const gone = [];
  let sent = 0;

  for (const sub of subs) {
    const items = byUser.get(String(sub.userId));
    if (!items) continue;

    const due = force || shouldSendNow({
      nowTime,
      reminderTime: process.env.REMINDER_TIME,
      lastSentDate: sub.last_sent_date,
      today,
    });
    if (!due) continue;

    const payload = buildReminder(items, today, INTERVALS);
    if (!payload) continue;

    const result = await send(toWebPushSubscription(sub), payload);
    if (result.gone) { gone.push(sub._id); continue; }
    if (!result.ok) continue;   // 일시적인 실패일 수 있으므로 표시를 남기지 않는다 — 다음 tick에 다시 시도한다

    sub.last_sent_date = today;
    await sub.save();
    sent += 1;
  }

  if (gone.length > 0) await PushSubscription.deleteMany({ _id: { $in: gone } });
  return { sent, removed: gone.length };
}

/**
 * 1분마다 확인한다. 실제 발송은 하루에 한 번뿐이고, shouldSendNow가 그것을 보장한다.
 * 잦은 확인은 재시작·정전으로 시각을 놓쳤을 때 그날 안에 따라잡기 위한 것이다.
 */
function startReminderScheduler({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const tick = async () => {
    try {
      // 예외로 프로세스를 죽이면 배포 환경이 컨테이너를 계속 재시작한다.
      const { sent, removed } = await runReminderTick();
      if (sent) console.log(`[Reminder] 알림 ${sent}건 발송${removed ? ` (만료 구독 ${removed}건 정리)` : ''}`);
    } catch (err) {
      console.error('[Reminder] 발송 중 오류:', err.message);
    }
  };

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();   // 이 타이머 때문에 프로세스가 끝나지 못하는 일은 없게 한다
  tick();

  return () => clearInterval(timer);
}

module.exports = { collectDueReviews, runReminderTick, startReminderScheduler };
