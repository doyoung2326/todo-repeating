import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// pwa-source.svg 하나로 favicon / apple-touch-icon / 192·512 PWA 아이콘 / maskable 아이콘까지
// 전부 public/ 에 생성한다. 아이콘 배경(그라디언트+체크)은 App.css의 --primary/--primary-dark 색과 맞춤.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['pwa-source.svg'],
});
