/**
 * 새 버전이 준비되면 알려주고, 사용자가 누를 때 갱신한다.
 *
 * 자동으로 새로고침하면 할 일을 적던 도중에 폼이 비워질 수 있어서, 언제 바꿀지는
 * 사용자가 정하게 한다. 그래서 서비스 워커는 `registerType: 'prompt'`로 만든다 —
 * 새 워커가 설치돼도 스스로 나서지 않고 대기(waiting) 상태로 기다린다.
 *
 * 흐름:
 *   1. 새 워커가 설치되고 기존 워커가 화면을 잡고 있으면 → onUpdateReady(worker)
 *   2. 사용자가 "새로고침"을 누르면 → applyUpdate(worker)
 *   3. 대기 중이던 워커가 자리를 넘겨받으면(controllerchange) 화면을 다시 읽는다
 */

const SW_URL = '/sw.js';

/**
 * 새 버전이 준비되면 onUpdateReady(worker)를 부른다.
 * 정리 함수를 돌려준다.
 */
export function watchForUpdate(onUpdateReady) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  let cancelled = false;
  const cleanups = [];

  const announce = (worker) => { if (!cancelled && worker) onUpdateReady(worker); };

  navigator.serviceWorker.register(SW_URL, { scope: '/' })
    .then(registration => {
      if (cancelled) return;

      // 지난번에 안내를 닫았거나 새로고침하지 않았다면 이미 기다리고 있을 수 있다
      if (registration.waiting && navigator.serviceWorker.controller) {
        announce(registration.waiting);
      }

      const onUpdateFound = () => {
        const installing = registration.installing;
        if (!installing) return;
        const onStateChange = () => {
          // controller가 없으면 첫 설치다 — 지금 화면이 이미 최신이라 알릴 게 없다
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            announce(installing);
          }
        };
        installing.addEventListener('statechange', onStateChange);
        cleanups.push(() => installing.removeEventListener('statechange', onStateChange));
      };

      registration.addEventListener('updatefound', onUpdateFound);
      cleanups.push(() => registration.removeEventListener('updatefound', onUpdateFound));
    })
    .catch(() => {
      // 등록 실패는 앱 동작과 무관하다. 오프라인 캐시만 없을 뿐이다.
    });

  return () => {
    cancelled = true;
    cleanups.forEach(fn => fn());
  };
}

/**
 * 대기 중인 워커에게 자리를 넘겨받으라고 하고, 넘겨받으면 화면을 다시 읽는다.
 * (워크박스가 만든 워커는 SKIP_WAITING 메시지를 받으면 skipWaiting을 부른다)
 */
export function applyUpdate(worker) {
  if (!worker) { window.location.reload(); return; }

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  worker.postMessage({ type: 'SKIP_WAITING' });
}
