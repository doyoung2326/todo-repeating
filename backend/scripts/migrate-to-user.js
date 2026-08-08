// 사용자 구분이 없던 시절의 데이터(userId 없는 할일·복습)를 특정 계정 소유로 옮긴다.
// 한 번만 실행하면 되고, 여러 번 실행해도 안전하다(이미 주인이 있는 문서는 건드리지 않는다).
//
// 사용법: 먼저 앱에서 회원가입한 뒤
//   node backend/scripts/migrate-to-user.js you@example.com

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('사용법: node backend/scripts/migrate-to-user.js <이메일>');
  console.error('  먼저 앱에서 해당 이메일로 회원가입을 해두어야 합니다.');
  process.exit(1);
}

// 스키마 검증을 거치지 않고 원본 문서를 그대로 다루기 위해 느슨한 스키마를 쓴다.
// (기존 문서에는 userId가 없어서 server.js의 required 검증에 걸린다)
const loose = () => new mongoose.Schema({}, { strict: false });
const User   = mongoose.model('User',   loose(), 'users');
const Todo   = mongoose.model('Todo',   loose(), 'todos');
const Review = mongoose.model('Review', loose(), 'reviews');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(`'${email}' 계정을 찾을 수 없습니다. 앱에서 먼저 회원가입해 주세요.`);
  }

  const orphan = { userId: { $exists: false } };
  const todos   = await Todo.updateMany(orphan, { $set: { userId: user._id } });
  const reviews = await Review.updateMany(orphan, { $set: { userId: user._id } });

  console.log(`할일 ${todos.modifiedCount}개, 복습 ${reviews.modifiedCount}개를 ${email} 소유로 옮겼습니다.`);
}

main()
  .catch(err => { console.error('실패:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
