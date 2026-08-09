import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationSettings from './NotificationSettings';

// 브라우저 API 자체는 push.test.js가 본다. 여기서는 분기와 서버 호출만 확인한다.
const push = vi.hoisted(() => ({
  isPushSupported: vi.fn(() => true),
  isStandalone: vi.fn(() => true),
  isIos: vi.fn(() => false),
  permissionState: vi.fn(() => 'default'),
  getExistingSubscription: vi.fn(async () => null),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(async () => null),
}));

vi.mock('../push', () => push);

const SUBSCRIPTION = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/device-a',
  toJSON: () => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/device-a',
    keys: { p256dh: 'p', auth: 'a' },
  }),
};

let apiCall;

beforeEach(() => {
  vi.clearAllMocks();
  push.isPushSupported.mockReturnValue(true);
  push.isStandalone.mockReturnValue(true);
  push.isIos.mockReturnValue(false);
  push.permissionState.mockReturnValue('default');
  push.getExistingSubscription.mockResolvedValue(null);
  push.subscribe.mockResolvedValue(SUBSCRIPTION);
  push.unsubscribe.mockResolvedValue(null);

  apiCall = vi.fn(async (url) => {
    if (url.endsWith('/push/public-key')) return { publicKey: 'test-public-key' };
    return { success: true };
  });
});

const setup = () => render(<NotificationSettings api="/api" apiCall={apiCall} />);
const toggle = () => screen.getByRole('checkbox', { name: /매일 아침 복습 알림/ });

/** 첫 렌더의 구독 확인이 끝나 토글을 누를 수 있게 될 때까지 기다린다. */
const readyToggle = async () => {
  await waitFor(() => expect(toggle()).toBeEnabled());
  return toggle();
};

describe('NotificationSettings', () => {
  it('알림을 지원하지 않는 브라우저에는 토글을 보여주지 않는다', () => {
    push.isPushSupported.mockReturnValue(false);
    setup();

    expect(screen.getByText(/알림을 지원하지 않습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('iOS에서 홈 화면에 설치하지 않았으면 설치를 먼저 안내한다', () => {
    push.isIos.mockReturnValue(true);
    push.isStandalone.mockReturnValue(false);
    setup();

    expect(screen.getByText(/홈 화면에 추가한 뒤에/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('브라우저가 알림을 차단했으면 푸는 방법을 알려준다', () => {
    push.permissionState.mockReturnValue('denied');
    setup();

    expect(screen.getByText(/알림이 차단되어 있습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('구독이 없으면 꺼진 상태로 열린다', async () => {
    setup();

    expect(await readyToggle()).not.toBeChecked();
    expect(apiCall).not.toHaveBeenCalled();
  });

  it('이미 구독 중이면 켜진 상태로 열고 서버와 다시 맞춘다', async () => {
    push.getExistingSubscription.mockResolvedValue(SUBSCRIPTION);
    setup();

    expect(await readyToggle()).toBeChecked();
    expect(apiCall).toHaveBeenCalledWith('/api/push/subscribe', expect.objectContaining({ method: 'POST' }));
  });

  it('토글을 켜면 공개키를 받아 구독하고 서버에 올린다', async () => {
    setup();
    await userEvent.setup().click(await readyToggle());

    await waitFor(() => expect(toggle()).toBeChecked());
    expect(apiCall).toHaveBeenCalledWith('/api/push/public-key');
    expect(push.subscribe).toHaveBeenCalledWith('test-public-key');
    expect(apiCall).toHaveBeenCalledWith('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: SUBSCRIPTION.toJSON() }),
    });
  });

  it('권한을 거부하면 이유를 보여주고 꺼진 채로 둔다', async () => {
    push.subscribe.mockRejectedValue(new Error('알림 권한이 허용되지 않았습니다.'));
    setup();

    await userEvent.setup().click(await readyToggle());

    expect(await screen.findByRole('alert')).toHaveTextContent('알림 권한이 허용되지 않았습니다.');
    expect(toggle()).not.toBeChecked();
  });

  it('토글을 끄면 브라우저 구독을 끊고 서버에도 알린다', async () => {
    push.getExistingSubscription.mockResolvedValue(SUBSCRIPTION);
    push.unsubscribe.mockResolvedValue(SUBSCRIPTION.endpoint);
    setup();

    const box = await readyToggle();
    expect(box).toBeChecked();
    apiCall.mockClear();

    await userEvent.setup().click(box);

    await waitFor(() => expect(toggle()).not.toBeChecked());
    expect(push.unsubscribe).toHaveBeenCalled();
    expect(apiCall).toHaveBeenCalledWith('/api/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: SUBSCRIPTION.endpoint }),
    });
  });

  it('끄는 도중 서버 요청이 실패해도 꺼진 것으로 둔다', async () => {
    push.getExistingSubscription.mockResolvedValueOnce(SUBSCRIPTION).mockResolvedValue(null);
    push.unsubscribe.mockResolvedValue(SUBSCRIPTION.endpoint);
    setup();

    const box = await readyToggle();
    apiCall.mockRejectedValue(new Error('서버 오류'));

    await userEvent.setup().click(box);

    await waitFor(() => expect(toggle()).not.toBeChecked());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('켜져 있을 때만 테스트 알림을 보낼 수 있다', async () => {
    setup();
    await readyToggle();

    expect(screen.queryByRole('button', { name: '테스트 알림 보내기' })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(toggle());
    await waitFor(() => expect(toggle()).toBeChecked());

    await user.click(screen.getByRole('button', { name: '테스트 알림 보내기' }));

    expect(apiCall).toHaveBeenCalledWith('/api/push/test', { method: 'POST' });
    expect(await screen.findByRole('status')).toHaveTextContent('테스트 알림을 보냈습니다.');
  });
});
