import { useEffect, useState } from 'react';
import { watchForUpdate, applyUpdate } from '../registerServiceWorker';

/**
 * 새 버전이 준비되면 아래에 띄우는 안내.
 *
 * 홈 화면에 설치한 앱은 캐시에서 뜨기 때문에, 배포한 내용이 저절로 보이지 않는다.
 * 자동으로 새로고침하면 적던 내용이 날아갈 수 있어서 누를지 말지는 사용자가 정한다.
 */
export default function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => watchForUpdate(setWaitingWorker), []);

  if (!waitingWorker) return null;

  return (
    <div className="update-prompt" role="status">
      <span className="update-prompt-text">새 버전이 있습니다</span>
      <button type="button" className="update-prompt-apply"
              onClick={() => applyUpdate(waitingWorker)}>
        새로고침
      </button>
      {/* 닫아도 워커는 계속 기다린다 — 다음에 앱을 열면 새 버전으로 뜬다 */}
      <button type="button" className="update-prompt-close" aria-label="나중에"
              onClick={() => setWaitingWorker(null)}>
        ✕
      </button>
    </div>
  );
}
