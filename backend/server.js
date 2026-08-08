require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { app } = require('./app');
const { connectWithRetry } = require('./lib/retry');

const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET) {
  console.error('[설정] JWT_SECRET이 없습니다. 로그인·회원가입이 503으로 거절됩니다. 환경변수를 설정하세요.');
}

// DB 연결 여부와 무관하게 먼저 리슨한다. 연결 실패로 프로세스를 죽이면
// 배포 환경(Railway)이 컨테이너를 계속 재시작해 무한 크래시 루프가 된다.
app.listen(PORT, () => console.log(`[Server] http://localhost:${PORT}`));

connectWithRetry(() => mongoose.connect(process.env.MONGODB_URI), {
  onError: (err, attempt) => console.error(`[MongoDB] 연결 실패 (${attempt}번째): ${err.message}`),
}).then(() => console.log('[MongoDB] 연결 성공'));
