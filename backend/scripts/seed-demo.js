// 시간에 얽힌 기능을 손으로 확인하기 위한 가짜 데이터를 넣는다.
//
// 복습은 1·3·7·16·30일 뒤에 뜨고 마감 표시는 날짜가 지나야 바뀐다 — 다 보려면 한 달이 걸린다.
// 그래서 시계를 돌리는 대신 "나중에 떠야 할 것"을 오늘 마감으로 미리 꽂아 넣는다.
// 무엇을 넣을지는 fixtures.js가 정하고, 이 파일은 그걸 DB에 넣는 일만 한다.
//
// 사용법:
//   node backend/scripts/seed-demo.js                     기본 계정(test@test.local)에 전부
//   node backend/scripts/seed-demo.js --only reviewChain  특정 묶음만 (쉼표로 여러 개)
//   node backend/scripts/seed-demo.js --clean             넣었던 시드만 삭제
//   node backend/scripts/seed-demo.js --reset-push        "오늘 이미 보냄" 표시도 초기화
//   node backend/scripts/seed-demo.js other@test.local    다른 테스트 계정 지정
//
// 가짜 데이터는 테스트 전용 계정에만 들어간다. 이 앱은 남의 할 일을 아예 보여주지 않으므로
// 진짜 계정으로 로그인하면 시드는 한 개도 보이지 않는다.

const DEFAULT_EMAIL = 'test@test.local';
const DEFAULT_PASSWORD = 'seedtest1234';   // lib/auth.js의 최소 길이(8자)만 넘기면 된다

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const bcrypt = require('bcryptjs');
  const { User } = require('../app.js');
  const {
    SCENARIO_NAMES, seedScenarios, clearScenarios, countRealTodos, resetPushState,
  } = require('../fixtures.js');

  const args = process.argv.slice(2);
  const clean = args.includes('--clean');
  const resetPush = args.includes('--reset-push');

  const onlyIndex = args.indexOf('--only');
  const only = onlyIndex === -1 ? undefined : (args[onlyIndex + 1] || '').split(',').filter(Boolean);

  // --only 다음 값은 플래그가 아니라 묶음 이름이므로 이메일 후보에서 뺀다.
  // (--only가 없으면 onlyIndex가 -1이라 그냥 두면 첫 번째 인자가 통째로 걸러진다)
  const nameArgIndex = onlyIndex === -1 ? -1 : onlyIndex + 1;
  const email = args.find((a, i) =>
    !a.startsWith('--') && i !== nameArgIndex
  )?.trim().toLowerCase() || DEFAULT_EMAIL;

  if (only && only.length === 0) {
    console.error(`--only 뒤에 묶음 이름이 없습니다. 쓸 수 있는 이름: ${SCENARIO_NAMES.join(', ')}`);
    process.exit(1);
  }

  /** 계정을 찾고, 없으면 만든다. 만들었으면 created=true. */
  async function findOrCreateUser(today) {
    const existing = await User.findOne({ email });
    if (existing) return { user: existing, created: false };

    const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);   // app.js의 BCRYPT_ROUNDS와 같은 값
    const user = await User.create({ email, password_hash, token_version: 0, created_at: today });
    return { user, created: true };
  }

  async function main() {
    await mongoose.connect(process.env.MONGODB_URI);

    // 어느 DB에 붙었는지 먼저 밝힌다. 실수로 운영 DB에 꽂는 사고는 열에 아홉 여기서 걸린다.
    const { host, name } = mongoose.connection;
    console.log(`연결됨: ${host} / DB: ${name}`);

    const { localDate } = require('../lib/dates');
    const today = localDate();

    if (clean) {
      const user = await User.findOne({ email });
      if (!user) return console.log(`'${email}' 계정이 없습니다. 지울 것도 없습니다.`);

      const removed = await clearScenarios({ userId: user._id });
      console.log(`'${email}'에서 시드를 지웠습니다: 할 일 ${removed.todos}개, 복습 ${removed.reviews}개`);
      return;
    }

    const { user, created } = await findOrCreateUser(today);

    // 사람이 실제로 쓰는 계정에는 붓지 않는다. 이메일 오타 한 번으로 진짜 목록이 더러워지면 곤란하다.
    const real = await countRealTodos({ userId: user._id });
    if (real > 0) {
      console.error(`\n'${email}' 계정에는 시드가 아닌 할 일이 ${real}개 있습니다.`);
      console.error('실제로 쓰는 계정으로 보여 중단합니다. 테스트 전용 계정을 쓰세요.');
      console.error(`  예: node backend/scripts/seed-demo.js ${DEFAULT_EMAIL}`);
      process.exitCode = 1;
      return;
    }

    const result = await seedScenarios({ userId: user._id, today, only });
    console.log(`\n시드를 넣었습니다 (오늘 = ${today})`);
    console.log(`  묶음: ${result.names.join(', ')}`);
    console.log(`  할 일 ${result.todos}개, 복습 ${result.reviews}개`);

    if (resetPush) {
      const n = await resetPushState({ userId: user._id });
      console.log(`  알림 구독 ${n}건의 "오늘 이미 보냄" 표시를 지웠습니다`);
    }

    console.log('\n브라우저에서 아래 계정으로 로그인하세요.');
    console.log(`  ${email} / ${created ? DEFAULT_PASSWORD : '(기존 비밀번호)'}`);
    console.log('\n다 보고 나면: node backend/scripts/seed-demo.js --clean');
  }

  main()
    .catch(err => { console.error('실패:', err.message); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
