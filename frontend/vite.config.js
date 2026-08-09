import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
import { resolveApiUrl } from './src/config/apiUrl.js';

// 이 설정 파일은 loadEnv와 마찬가지로 프로젝트 폴더에서 실행되는 것을 전제한다.
const CSS_PATH   = path.resolve(process.cwd(), 'src/App.css');
const START_MARK = '/* theme:start';
const END_MARK   = '/* theme:end */';

/**
 * 개발 서버에서만 도는 작은 엔드포인트.
 *
 * 화면 조정 패널(src/components/ThemePanel.jsx)이 "확정"을 누르면 여기로 보내고,
 * App.css의 theme:start ~ theme:end 구간에 있는 토큰 값을 실제로 고쳐 쓴다.
 * 그래야 화면에서 맞춘 값이 다음 사람에게도, 운영 빌드에도 그대로 간다.
 *
 * 표시선 사이만 건드리고, 패널이 보낸 이름 중 이미 그 구간에 있는 것만 바꾼다.
 * 없는 이름은 새로 만들지 않는다 — 오타 하나로 파일이 늘어나면 안 된다.
 */
function themeWriter() {
  return {
    name: 'study-todo-theme-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__theme', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
          const reply = (status, body) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
          };

          try {
            const { tokens } = JSON.parse(raw || '{}');
            if (!tokens || typeof tokens !== 'object') {
              return reply(400, { error: '고칠 값이 없습니다.' });
            }

            const css   = fs.readFileSync(CSS_PATH, 'utf8');
            const start = css.indexOf(START_MARK);
            const end   = css.indexOf(END_MARK);
            if (start === -1 || end === -1 || end < start) {
              return reply(500, { error: 'App.css에서 theme:start / theme:end 표시선을 찾지 못했습니다.' });
            }

            let block = css.slice(start, end);
            let written = 0;

            for (const [name, value] of Object.entries(tokens)) {
              // 토큰 이름과 값은 우리가 아는 모양일 때만 받는다
              if (!/^--[a-z0-9-]+$/.test(name)) continue;
              if (typeof value !== 'string' || !/^[#a-z0-9 .,()%-]+$/i.test(value)) continue;

              const line = new RegExp(`(^[ \\t]*${name}:)([^;\\n]*)(;)`, 'm');
              if (!line.test(block)) continue;

              // 원래 줄의 정렬(콜론 뒤 공백)을 그대로 둔다
              block = block.replace(line, (_, head, old, tail) => {
                const spacing = old.match(/^\s*/)[0] || ' ';
                return `${head}${spacing}${value}${tail}`;
              });
              written += 1;
            }

            if (written === 0) return reply(400, { error: '고칠 수 있는 토큰이 없었습니다.' });

            fs.writeFileSync(CSS_PATH, css.slice(0, start) + block + css.slice(end), 'utf8');
            reply(200, { written });
          } catch (e) {
            reply(500, { error: e.message });
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // VITE_API_URL이 비었거나 상대 경로면 여기서 빌드가 멈춘다.
  // 그냥 두면 빌드·배포는 성공하고 브라우저에서만 404가 나서 원인 찾기가 어렵다.
  resolveApiUrl(loadEnv(mode, process.cwd(), 'VITE_'), mode);

  return {
    plugins: [
      react(),
      themeWriter(),
      VitePWA({
        // 새 버전이 나와도 스스로 나서지 않고 대기한다. 언제 바꿀지는 사용자가 정한다
        // (src/registerServiceWorker.js + components/UpdatePrompt.jsx).
        // 자동으로 갈아끼우면 할 일을 적던 도중에 화면이 다시 읽혀 입력이 날아간다.
        registerType: 'prompt',
        // 등록은 우리가 직접 한다 — 플러그인이 넣어주는 스크립트는 등록만 하고
        // 새 버전이 준비된 것을 알려주지 않는다.
        injectRegister: null,
        // API 응답은 워크박스가 캐시하지 않는다 — 할 일 데이터는 항상 최신이어야 하므로
        // 여기서 캐시하는 건 앱 셸(정적 자산)뿐이다. 오프라인에서도 화면은 뜨지만
        // 목록 갱신은 네트워크가 있어야 된다.
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'pwa-source.svg'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          // 알림 처리는 워크박스가 만든 워커 위에 얹는다.
          // strategies를 injectManifest로 바꾸면 precache와 SKIP_WAITING 처리까지 직접 떠안게 되고,
          // registerServiceWorker.js의 갱신 약속이 깨진다.
          importScripts: ['/push-sw.js'],
          // 위에서 직접 불러오므로 프리캐시 목록에 또 넣지 않는다
          globIgnores: ['push-sw.js'],
          // 제목용 명조는 외부에서 받아오므로 앱 셸 프리캐시에 들어가지 않는다.
          // 한 번 받은 뒤에는 여기에 저장해 둬서 오프라인에서도 고딕으로 떨어지지 않게 한다.
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-css' },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-files',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                // 글꼴은 CORS 없이 오는 불투명 응답(status 0)일 수 있다
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: '공부 할 일 관리',
          short_name: '공부투두',
          description: '공부 할 일 관리 + 망각곡선 복습(1·3·7·16·30일) 웹앱',
          theme_color: '#4d6b57',
          background_color: '#f1f3ef',
          lang: 'ko',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    server: { port: 5173 },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './vitest.setup.js',
      include: ['src/**/*.test.{js,jsx}'],
    },
  };
});
