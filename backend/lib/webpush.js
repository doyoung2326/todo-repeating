// web-push 라이브러리를 감싸는 얇은 껍데기.
// 우리 모델을 import하지 않으므로 app.js와 reminders.js 양쪽에서 써도 순환이 생기지 않는다.

const webpush = require('web-push');

const DEFAULT_SUBJECT = 'mailto:noreply@localhost';

// JWT_SECRET과 같은 이유로 모듈 로드 시점이 아니라 호출 시점에 읽는다.
const vapidKeys = () => ({
  publicKey:  process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject:    process.env.VAPID_SUBJECT || DEFAULT_SUBJECT,
});

/** 키가 둘 다 있는가. 없으면 푸시 기능 전체가 조용히 꺼진다. */
function isConfigured() {
  const { publicKey, privateKey } = vapidKeys();
  return Boolean(publicKey && privateKey);
}

function publicKey() {
  return vapidKeys().publicKey || null;
}

// 같은 키로 매번 setVapidDetails를 부를 필요는 없다. 값이 바뀔 때만 다시 넣는다.
let applied = null;

/** 발송 준비가 됐으면 true. 키가 없거나 형식이 틀리면 false(예외를 던지지 않는다). */
function configure() {
  if (!isConfigured()) return false;

  const { publicKey: pub, privateKey: priv, subject } = vapidKeys();
  const signature = `${subject}\n${pub}\n${priv}`;
  if (applied === signature) return true;

  try {
    webpush.setVapidDetails(subject, pub, priv);
    applied = signature;
    return true;
  } catch (err) {
    applied = null;
    console.error('[Push] VAPID 설정이 올바르지 않습니다:', err.message);
    return false;
  }
}

/**
 * 한 구독에 알림 하나를 보낸다. 던지지 않는다.
 *
 *  { ok: true }              보냄
 *  { gone: true }            구독이 만료됐다 — 호출한 쪽에서 그 행을 지워야 한다
 *  { ok: false, error }      그 밖의 실패 (일시적일 수 있으므로 구독은 남긴다)
 */
async function sendTo(subscription, payload) {
  if (!configure()) return { ok: false, error: 'VAPID 키가 설정되지 않았습니다.' };

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    // 404/410은 브라우저가 구독을 버렸다는 뜻이다. 다시 보내봐야 계속 실패한다.
    if (err.statusCode === 404 || err.statusCode === 410) return { gone: true };
    return { ok: false, error: err.message };
  }
}

module.exports = { isConfigured, publicKey, configure, sendTo };
