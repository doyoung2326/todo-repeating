/* eslint-env serviceworker */
// 워크박스가 만든 서비스 워커(dist/sw.js)가 importScripts로 불러온다.
// 여기서는 리스너만 더한다 — 캐시나 SKIP_WAITING 처리는 워크박스 쪽 그대로 둔다.

const FALLBACK_TITLE = '공부 할 일 관리';

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // 형식이 다른 알림이 와도 조용히 기본 문구로 띄운다
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || FALLBACK_TITLE, {
      body: payload.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'ko',
      // 하루 한 건이므로 새 알림이 옛 알림을 덮어쓰게 둔다
      tag: 'study-todo-review',
      renotify: true,
      data: { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // 이미 열려 있는 창이 있으면 새로 띄우지 않고 그 창을 앞으로 가져온다
      const open = windows.find(w => w.url.startsWith(self.location.origin));
      if (open) return open.focus();
      return self.clients.openWindow('/');
    })
  );
});
