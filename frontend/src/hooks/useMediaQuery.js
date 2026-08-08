import { useCallback, useSyncExternalStore } from 'react';

const hasMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * 미디어쿼리를 React 상태처럼 읽는다.
 *
 * 레이아웃은 되도록 CSS로 처리하고, 이 훅은 CSS로는 못 하는 경우에만 쓴다
 * (같은 폼을 카드에 둘지 바텀 시트에 둘지처럼, DOM 구조 자체가 달라지는 경우).
 *
 * matchMedia가 없는 환경(jsdom)에서는 언제나 false다 — 즉 넓은 화면으로 그린다.
 * 테스트에서 모바일 레이아웃을 보려면 window.matchMedia를 직접 흉내내야 한다.
 */
export default function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (!hasMatchMedia()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => (hasMatchMedia() ? window.matchMedia(query).matches : false),
    [query]
  );

  // 세 번째 인자는 서버 렌더링용 기본값 — 여기서도 넓은 화면으로 본다.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
