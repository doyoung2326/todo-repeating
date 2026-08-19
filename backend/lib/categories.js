/**
 * 할 일 성격의 검사 규칙. DB도 Express도 모른다.
 *
 * 색은 색값이 아니라 **칸 번호(1~8)**다. 실제 색은 화면 쪽에만 있다
 * (웹은 App.css의 --cat-N, 앱은 mobile/src/constants/tokens.ts).
 * 그래야 색을 다시 맞춰도 이미 저장된 성격이 따라온다.
 */

/** 목록 줄에서 성격 칩은 중요도·시간·복습 칩과 한 줄을 나눠 쓴다.
 *  길이를 안 막으면 폰에서 그 줄이 세 줄로 터진다. */
const MAX_NAME_LENGTH = 12;

/** shared/labels.js의 CAT_SLOTS와 같은 수. 백엔드는 CommonJS라 그 파일(ESM)을
 *  가져오지 못해 여기에 한 번 더 적는다. 칸을 늘리면 양쪽을 같이 고친다. */
const COLOR_SLOTS = 8;

/** 고를 것이 너무 많으면 고르는 것 자체가 일이 된다. 화면(<select>)도 이 선에서 버틴다. */
const MAX_CATEGORIES = 12;

/**
 * @returns {{ ok: true, name: string, color: number } | { ok: false, error: string }}
 */
function validateCategory({ name, color } = {}) {
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, error: '성격 이름을 입력해 주세요.' };
  }

  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `성격 이름은 ${MAX_NAME_LENGTH}자 이내로 입력해 주세요.` };
  }

  // 색을 안 주면 첫 칸.
  if (color === undefined) return { ok: true, name: trimmed, color: 1 };

  // 폼이 문자열('3')로 보내므로 숫자·문자열만 Number를 태운다.
  // 그냥 Number(color)로 두면 null이 0, true가 1로 조용히 통과한다.
  const slot = typeof color === 'number' || typeof color === 'string' ? Number(color) : NaN;
  if (!Number.isInteger(slot) || slot < 1 || slot > COLOR_SLOTS) {
    return { ok: false, error: `색은 1~${COLOR_SLOTS} 중에서 골라 주세요.` };
  }

  return { ok: true, name: trimmed, color: slot };
}

module.exports = { validateCategory, MAX_NAME_LENGTH, COLOR_SLOTS, MAX_CATEGORIES };
