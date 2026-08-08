import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { saveSession } from './auth/session';

/**
 * 좁은 화면(폰)에서만 달라지는 것들.
 *
 * jsdom에는 matchMedia가 없어서 useMediaQuery가 항상 false를 준다 — 즉 기본은
 * 넓은 화면이다. 여기서는 matchMedia를 흉내내서 좁은 화면 쪽을 확인한다.
 */

const SESSION = { token: 'tok.en.abc', user: { id: '1', email: 'a@example.com' } };

const TODO = {
  id: 't1', text: '수학 문제집', importance: 1, deadline: null, perform_date: null,
  needs_review: 0, progress: null, start_time: null, end_time: null,
  completed: 0, completed_at: null, created_at: '2026-06-01', activeReview: null,
};

const res = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/** 좁은 화면인 척한다. App.css의 첫 브레이크포인트와 같은 700px 경계를 쓴다. */
function pretendNarrowScreen() {
  vi.stubGlobal('matchMedia', (query) => ({
    media: query,
    matches: query.includes('max-width: 699px'),
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  localStorage.clear();
  saveSession(SESSION);
  vi.stubGlobal('fetch', vi.fn(async () => res(200, [TODO])));
  pretendNarrowScreen();
});

afterEach(() => vi.unstubAllGlobals());

/** 하단 탭바 안에서만 찾는다 — '목록'은 오늘 할 일 카드의 보기 전환에도 있다. */
const tab = (name) =>
  within(screen.getByRole('navigation', { name: '화면 전환' })).getByRole('button', { name });

describe('좁은 화면 — 하단 탭', () => {
  it('오늘·목록·복습 탭을 보여주고 처음에는 오늘이 선택돼 있다', async () => {
    render(<App />);
    await screen.findByText('수학 문제집');

    expect(tab('오늘')).toHaveAttribute('aria-current', 'page');
    expect(tab('목록')).not.toHaveAttribute('aria-current');
    expect(tab('복습')).toBeInTheDocument();
  });

  it('탭을 누르면 선택 표시가 옮겨간다', async () => {
    render(<App />);
    await screen.findByText('수학 문제집');

    await userEvent.setup().click(tab('복습'));

    expect(tab('복습')).toHaveAttribute('aria-current', 'page');
    expect(tab('오늘')).not.toHaveAttribute('aria-current');
  });
});

describe('좁은 화면 — 할 일 추가 시트', () => {
  it('추가 폼은 화면을 상시 차지하지 않는다', async () => {
    render(<App />);
    await screen.findByText('수학 문제집');

    expect(screen.queryByRole('heading', { name: '할 일 추가' })).not.toBeInTheDocument();
  });

  it('추가 버튼을 누르면 시트가 열리고 그 안에 폼이 있다', async () => {
    render(<App />);
    await screen.findByText('수학 문제집');

    await userEvent.setup().click(screen.getByRole('button', { name: '할 일 추가' }));

    const sheet = screen.getByRole('dialog', { name: '할 일 추가' });
    expect(sheet).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '할 일 추가' })).toBeInTheDocument();
  });

  it('취소하면 시트가 닫힌다', async () => {
    render(<App />);
    await screen.findByText('수학 문제집');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '할 일 추가' }));
    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('항목을 수정하려 하면 같은 시트가 수정 모드로 열린다', async () => {
    render(<App />);
    await screen.findByText('수학 문제집');
    const user = userEvent.setup();

    // 좁은 화면에서는 부가 동작이 ⋯ 메뉴 안에 들어간다
    await user.click(screen.getByRole('button', { name: '수학 문제집 항목 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '수정' }));

    expect(screen.getByRole('dialog', { name: '할 일 수정' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('수학 문제집')).toBeInTheDocument();
  });
});

describe('좁은 화면 — 계정 메뉴', () => {
  it('로그아웃은 계정 메뉴를 열어야 나온다', async () => {
    render(<App />);
    await screen.findByText('수학 문제집');

    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: '계정 메뉴' }));

    expect(screen.getByRole('menuitem', { name: '로그아웃' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '비밀번호 변경' })).toBeInTheDocument();
  });
});
