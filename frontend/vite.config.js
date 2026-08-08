import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveApiUrl } from './src/config/apiUrl.js';

export default defineConfig(({ mode }) => {
  // VITE_API_URL이 비었거나 상대 경로면 여기서 빌드가 멈춘다.
  // 그냥 두면 빌드·배포는 성공하고 브라우저에서만 404가 나서 원인 찾기가 어렵다.
  resolveApiUrl(loadEnv(mode, process.cwd(), 'VITE_'), mode);

  return {
    plugins: [react()],
    server: { port: 5173 },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './vitest.setup.js',
      include: ['src/**/*.test.{js,jsx}'],
    },
  };
});
