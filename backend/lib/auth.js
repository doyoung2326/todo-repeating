// 인증 관련 순수 로직. DB·Express에 의존하지 않으므로 단위 테스트 대상.

const jwt = require('jsonwebtoken');

const MIN_PASSWORD_LENGTH = 8;
const TOKEN_EXPIRES_IN = '30d';

// 완벽한 이메일 검증은 불가능하다. 오타를 거르는 수준으로만 본다.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 같은 사람이 대소문자·공백만 다르게 입력해도 같은 계정으로 취급되도록 정규화한다. */
function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * 회원가입 입력을 검증한다.
 * 통과하면 { ok: true, email }(정규화된 이메일), 아니면 { ok: false, error }(한국어 메시지).
 */
function validateCredentials(email, password) {
  const normalized = normalizeEmail(email);

  if (!normalized) return { ok: false, error: '이메일을 입력해 주세요.' };
  if (!EMAIL_RE.test(normalized)) return { ok: false, error: '이메일 형식이 올바르지 않습니다.' };
  if (typeof password !== 'string' || !password) {
    return { ok: false, error: '비밀번호를 입력해 주세요.' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` };
  }
  return { ok: true, email: normalized };
}

/** 사용자 식별자만 담은 토큰을 만든다. 비밀번호 등 민감한 값은 넣지 않는다. */
function signToken(userId, secret, { expiresIn = TOKEN_EXPIRES_IN } = {}) {
  return jwt.sign({ sub: String(userId) }, secret, { expiresIn });
}

/** 유효하면 userId, 위조·만료·형식 오류면 null. 호출부에서 try/catch 하지 않아도 되게 감싼다. */
function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret).sub;
  } catch {
    return null;
  }
}

/** "Bearer <token>" 헤더에서 토큰만 꺼낸다. 형식이 다르면 null. */
function extractBearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  validateCredentials,
  signToken,
  verifyToken,
  extractBearerToken,
};
