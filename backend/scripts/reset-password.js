// 비밀번호를 잊은 계정을 관리자가 직접 재설정한다.
// 이메일 발송 기반 "비밀번호 찾기"가 없으므로, 이게 유일한 구제 수단이다.
//
// 사용법:
//   node backend/scripts/reset-password.js you@example.com 새비밀번호8자이상
//
// 재설정하면 그 계정의 기존 토큰이 전부 무효가 되어, 모든 기기에서 다시 로그인해야 한다.

const bcrypt = require('bcryptjs');
const { validatePassword, normalizeEmail } = require('../lib/auth');

const BCRYPT_ROUNDS = 10;

/**
 * 비밀번호를 바꾸고 토큰 버전을 올린다.
 * 계정이 없거나 비밀번호가 규칙에 맞지 않으면 아무것도 바꾸지 않고 예외를 던진다.
 */
async function resetPassword(User, email, password) {
  const check = validatePassword(password);
  if (!check.ok) throw new Error(check.error);

  const normalized = normalizeEmail(email);
  const user = await User.findOne({ email: normalized });
  if (!user) throw new Error(`'${normalized}' 계정을 찾을 수 없습니다.`);

  user.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  user.token_version += 1;
  await user.save();

  return { email: normalized };
}

module.exports = { resetPassword };

// ── 명령줄에서 직접 실행한 경우에만 DB에 붙는다 ────────
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const { User } = require('../app');

  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('사용법: node backend/scripts/reset-password.js <이메일> <새 비밀번호>');
    console.error('  비밀번호는 8자 이상이어야 합니다.');
    process.exit(1);
  }

  mongoose.connect(process.env.MONGODB_URI)
    .then(() => resetPassword(User, email, password))
    .then(({ email: changed }) => {
      console.log(`${changed}의 비밀번호를 재설정했습니다.`);
      console.log('그 계정의 기존 로그인은 모두 해제되었습니다. 새 비밀번호로 다시 로그인하세요.');
    })
    .catch(err => { console.error('실패:', err.message); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
