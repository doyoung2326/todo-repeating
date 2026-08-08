// 재시도 로직 (타이머·DB에 의존하지 않도록 sleep을 주입받으므로 단위 테스트 대상)

const DEFAULT_BASE = 1000;
const DEFAULT_MAX = 30000;

const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** attempt(0부터)번째 재시도 전에 기다릴 시간(ms). 2배씩 늘어나되 max에서 멈춘다. */
function nextDelay(attempt, { base = DEFAULT_BASE, max = DEFAULT_MAX } = {}) {
  return Math.min(base * 2 ** Math.max(attempt, 0), max);
}

/**
 * connect가 성공할 때까지 재시도한다. 첫 시도는 대기 없이 실행한다.
 * maxAttempts를 지정하면 그 횟수만큼만 시도하고 마지막 에러를 그대로 던진다.
 */
async function connectWithRetry(connect, { sleep = defaultSleep, onError, base, max, maxAttempts = Infinity } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await connect();
    } catch (err) {
      // 로깅이 실패했다고 재연결까지 포기하면 안 된다
      if (onError) {
        try { onError(err, attempt); } catch { /* 무시 */ }
      }
      if (attempt >= maxAttempts) throw err;
      await sleep(nextDelay(attempt - 1, { base, max }));
    }
  }
}

module.exports = { nextDelay, connectWithRetry };
