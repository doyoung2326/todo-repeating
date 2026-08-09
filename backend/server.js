require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { app } = require('./app');
const { connectWithRetry } = require('./lib/retry');
const { startReminderScheduler } = require('./reminders');
const webpush = require('./lib/webpush');

const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET) {
  console.error('[설정] JWT_SECRET이 없습니다. 로그인·회원가입이 503으로 거절됩니다. 환경변수를 설정하세요.');
}

if (!webpush.isConfigured()) {
  console.error('[설정] VAPID 키가 없습니다. 알림 기능만 꺼집니다 (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).');
}

// 알림 시각은 서버의 로컬 시간 기준이다. 배포 환경은 기본이 UTC이므로 TZ를 넣어야 한다.
if (!process.env.TZ) {
  console.error('[설정] TZ가 없습니다. 날짜·알림 시각이 UTC 기준으로 계산됩니다 (TZ=Asia/Seoul).');
}

// DB 연결 여부와 무관하게 먼저 리슨한다. 연결 실패로 프로세스를 죽이면
// 배포 환경(Railway)이 컨테이너를 계속 재시작해 무한 크래시 루프가 된다.
app.listen(PORT, () => console.log(`[Server] http://localhost:${PORT}`));

connectWithRetry(() => mongoose.connect(process.env.MONGODB_URI), {
  onError: (err, attempt) => console.error(`[MongoDB] 연결 실패 (${attempt}번째): ${err.message}`),
}).then(() => {
  console.log('[MongoDB] 연결 성공');
  // DB가 붙은 뒤에 시작한다. (tick 자체도 연결 상태를 확인하므로 순서가 어긋나도 안전하다)
  startReminderScheduler();
});
