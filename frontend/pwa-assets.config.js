import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// pwa-source.svg 하나로 favicon / apple-touch-icon / 192·512 PWA 아이콘 / maskable 아이콘까지
// 전부 만든다. 생성물은 원본 svg와 같은 폴더에 떨어지므로 원본을 public/ 에 둔다 —
// 경로를 'pwa-source.svg'로 적으면 frontend/ 루트에 생겨서 브라우저에 서빙되지 않는다.
// 아이콘 배경(그라디언트+체크)은 App.css의 --accent/--accent-hover 색과 맞춘다.
// 테마 색을 바꾸면 svg를 고치고 `npx pwa-assets-generator`를 다시 돌릴 것.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/pwa-source.svg'],
});
