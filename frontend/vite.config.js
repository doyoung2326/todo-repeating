import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolveApiUrl } from './src/config/apiUrl.js';

export default defineConfig(({ mode }) => {
  // VITE_API_URL이 비었거나 상대 경로면 여기서 빌드가 멈춘다.
  // 그냥 두면 빌드·배포는 성공하고 브라우저에서만 404가 나서 원인 찾기가 어렵다.
  resolveApiUrl(loadEnv(mode, process.cwd(), 'VITE_'), mode);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // API 응답은 워크박스가 캐시하지 않는다 — 할일 데이터는 항상 최신이어야 하므로
        // 여기서 캐시하는 건 앱 셸(정적 자산)뿐이다. 오프라인에서도 화면은 뜨지만
        // 목록 갱신은 네트워크가 있어야 된다.
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'pwa-source.svg'],
        manifest: {
          name: '공부 할일 관리',
          short_name: '공부투두',
          description: '공부 할일 관리 + 망각곡선 복습(1·3·7·16·30일) 웹앱',
          theme_color: '#6366f1',
          background_color: '#f1f5f9',
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
