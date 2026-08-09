import { useEffect, useState } from 'react';
import {
  isPushSupported, isStandalone, isIos, permissionState,
  getExistingSubscription, subscribe, unsubscribe,
} from '../push';

/**
 * 알림 켜기/끄기 패널. 계정 메뉴에서 열리고 BottomSheet 안에 들어간다.
 *
 * 기준은 서버가 아니라 브라우저다 — 이 기기에 구독이 있으면 켜진 것으로 본다.
 * 시트를 열 때 그 구독을 서버로 한 번 다시 올려서(upsert) 양쪽을 맞춘다.
 */
export default function NotificationSettings({ api, apiCall }) {
  const supported = isPushSupported();
  const needsInstall = isIos() && !isStandalone();
  const blocked = permissionState() === 'denied';

  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(supported);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;
    (async () => {
      try {
        const subscription = await getExistingSubscription();
        if (cancelled) return;
        setEnabled(Boolean(subscription));

        // 서버 쪽 기록이 사라졌을 수도 있다. 같은 endpoint면 갱신이라 여러 번 올려도 안전하다.
        if (subscription) {
          await apiCall(`${api}/push/subscribe`, {
            method: 'POST',
            body: JSON.stringify({ subscription: subscription.toJSON() }),
          });
        }
      } catch {
        // 확인에 실패해도 화면은 막지 않는다. 켜는 순간 다시 시도한다.
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function turnOn() {
    const { publicKey } = await apiCall(`${api}/push/public-key`);
    const subscription = await subscribe(publicKey);
    await apiCall(`${api}/push/subscribe`, {
      method: 'POST',
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
  }

  async function turnOff() {
    // 브라우저 쪽을 먼저 끊는다 — 서버에 알리지 못해도 알림은 확실히 멈춘다.
    const endpoint = await unsubscribe();
    if (!endpoint) return;
    try {
      await apiCall(`${api}/push/subscribe`, { method: 'DELETE', body: JSON.stringify({ endpoint }) });
    } catch {
      // 서버에 남은 구독은 다음 발송 때 만료로 정리된다
    }
  }

  async function toggle(next) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (next) await turnOn(); else await turnOff();
      setEnabled(next);
    } catch (e) {
      setError(e.message);
      setEnabled(Boolean(await getExistingSubscription()));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiCall(`${api}/push/test`, { method: 'POST' });
      setNotice('테스트 알림을 보냈습니다.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card">
      <h2 className="form-title">알림 설정</h2>

      {!supported && (
        <p className="notify-desc">이 브라우저는 알림을 지원하지 않습니다.</p>
      )}

      {supported && needsInstall && (
        <p className="notify-desc">
          홈 화면에 추가한 뒤에 알림을 켤 수 있습니다. 공유 버튼에서 &ldquo;홈 화면에 추가&rdquo;를 누른 다음,
          홈 화면의 아이콘으로 다시 열어 주세요.
        </p>
      )}

      {supported && !needsInstall && blocked && (
        <p className="notify-desc">
          이 브라우저에서 알림이 차단되어 있습니다. 주소창의 자물쇠 아이콘에서 이 사이트의 알림을 허용한 뒤
          다시 열어 주세요.
        </p>
      )}

      {supported && !needsInstall && !blocked && (
        <>
          <label className="review-toggle">
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy}
              onChange={e => toggle(e.target.checked)}
            />
            <span className="review-toggle-label">
              매일 아침 복습 알림 받기
              <span className="review-toggle-hint"> — 오전 9시에 그날 복습할 항목을 알려줍니다</span>
            </span>
          </label>

          {enabled && (
            <div className="form-actions">
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={sendTest}>
                테스트 알림 보내기
              </button>
            </div>
          )}

          <p className="notify-desc">
            알림은 이 기기에만 설정됩니다. 다른 기기에서도 받으려면 그 기기에서 따로 켜 주세요.
          </p>
        </>
      )}

      {error  && <p className="field-error" role="alert">{error}</p>}
      {notice && <p className="notify-notice" role="status">{notice}</p>}
    </div>
  );
}
