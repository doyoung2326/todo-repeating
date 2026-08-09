// 알림에 필요한 순수 로직. web-push도, DB도, express도 모른다.
// (실제 발송은 lib/webpush.js, 대상 조회는 reminders.js가 한다)

const MAX_ENDPOINT_LENGTH = 2000;
const MAX_NAMES = 2;      // 본문에 이름을 그대로 적을 항목 수
const MAX_NAME_LENGTH = 20;

const isFilledString = v => typeof v === 'string' && v.trim().length > 0;

/**
 * 브라우저가 준 구독 정보가 우리가 저장할 만한 모양인지 본다.
 * lib/auth.js의 검증들과 마찬가지로 던지지 않고 { ok } 를 돌려준다.
 */
function validateSubscription(sub) {
  if (!sub || typeof sub !== 'object') {
    return { ok: false, error: '구독 정보가 없습니다.' };
  }
  const { endpoint, keys } = sub;

  if (!isFilledString(endpoint) || !endpoint.startsWith('https://')) {
    return { ok: false, error: '구독 주소가 올바르지 않습니다.' };
  }
  if (endpoint.length > MAX_ENDPOINT_LENGTH) {
    return { ok: false, error: '구독 주소가 너무 깁니다.' };
  }
  if (!keys || !isFilledString(keys.p256dh) || !isFilledString(keys.auth)) {
    return { ok: false, error: '구독 키가 올바르지 않습니다.' };
  }

  return { ok: true, subscription: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } };
}

/** 저장해 둔 구독 문서에서 web-push가 필요로 하는 부분만 꺼낸다 */
function toWebPushSubscription(doc) {
  return { endpoint: doc.endpoint, keys: { p256dh: doc.keys.p256dh, auth: doc.keys.auth } };
}

/** Date를 "HH:MM"으로 (로컬 기준 — 서버 TZ가 Asia/Seoul이어야 한다) */
function toClockTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "HH:MM" 형식이면 그대로, 아니면 fallback */
function parseReminderTime(value, fallback = '09:00') {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

/**
 * 지금 보낼 때인가.
 *
 * "정각에 정확히 맞는가"가 아니라 "지정 시각을 지났는데 오늘 아직 안 보냈는가"로 본다.
 * 09:00:30에 재시작하거나 tick 하나를 놓쳐도 알림이 사라지지 않고, 하루 지나면 저절로 복구된다.
 */
function shouldSendNow({ nowTime, reminderTime, lastSentDate, today }) {
  if (lastSentDate === today) return false;
  return nowTime >= parseReminderTime(reminderTime);
}

const shorten = text =>
  text.length > MAX_NAME_LENGTH ? `${text.slice(0, MAX_NAME_LENGTH - 1)}…` : text;

/**
 * 알림 문구를 만든다. 보낼 것이 없으면 null.
 *
 * items: [{ text, stage, due_date }] — 화면(ReviewSection)과 같은 어휘를 쓴다.
 * intervals: 복습 주기 배열. 단계 이름("7일차")을 여기서 만든다.
 */
function buildReminder(items, today, intervals) {
  if (!items || items.length === 0) return null;

  const overdue = items.filter(i => i.due_date < today).length;
  const names = items.slice(0, MAX_NAMES).map(i => shorten(i.text)).join(', ');
  const rest = items.length - MAX_NAMES;

  let body;
  if (items.length === 1) {
    const stage = intervals[items[0].stage];
    body = stage ? `${names} · ${stage}일차` : names;
  } else {
    body = rest > 0 ? `${names} 외 ${rest}건` : names;
  }
  if (overdue > 0) body += ` · 지난 복습 ${overdue}건 포함`;

  return { title: `오늘 복습 ${items.length}건`, body };
}

module.exports = {
  validateSubscription,
  toWebPushSubscription,
  toClockTime,
  parseReminderTime,
  shouldSendNow,
  buildReminder,
};
