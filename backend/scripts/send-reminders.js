// 복습 알림을 지금 한 번 보낸다. 09시를 기다리지 않고 발송 경로를 확인할 때 쓴다.
//
// 사용법:
//   node backend/scripts/send-reminders.js           평소 규칙대로 (시각이 됐고 오늘 안 보낸 사람에게만)
//   node backend/scripts/send-reminders.js --force    시각과 "오늘 이미 보냄" 표시를 무시하고 지금 보낸다
//
// 여러 번 실행해도 안전하다. --force 없이 돌리면 이미 보낸 사람에게는 아무것도 하지 않는다.

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const { runReminderTick } = require('../reminders');
  const webpush = require('../lib/webpush');

  const force = process.argv.includes('--force');

  if (!webpush.isConfigured()) {
    console.error('VAPID 키가 없습니다. backend/.env에 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY를 넣으세요.');
    console.error('  키 만들기: npx web-push generate-vapid-keys');
    process.exit(1);
  }

  mongoose.connect(process.env.MONGODB_URI)
    .then(() => runReminderTick({ force }))
    .then(({ sent, removed, skipped }) => {
      if (skipped) return console.log(`보내지 않았습니다 (${skipped}).`);
      console.log(`알림 ${sent}건을 보냈습니다.${removed ? ` 만료된 구독 ${removed}건을 정리했습니다.` : ''}`);
      if (sent === 0 && !force) {
        console.log('보낼 대상이 없다면 --force로 시각 검사를 건너뛰고 다시 확인해 보세요.');
      }
    })
    .catch(err => { console.error('실패:', err.message); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
