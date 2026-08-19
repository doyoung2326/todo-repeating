import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import CategoryManager from './CategoryManager';

const CATEGORIES = [
  { id: 'c1', name: '영어', color: 3 },
  { id: 'c2', name: '과제', color: 7 },
];

function renderManager({ categories = CATEGORIES, max, onCreate, onUpdate, onDelete } = {}) {
  const props = {
    onCreate: onCreate ?? vi.fn(),
    onUpdate: onUpdate ?? vi.fn(),
    onDelete: onDelete ?? vi.fn(),
  };
  const view = render(<CategoryManager categories={categories} max={max} {...props} />);
  return {
    ...props,
    user: userEvent.setup(),
    /** 서버 응답 뒤 목록이 바뀌어 다시 그려지는 상황. */
    showCategories: (next) =>
      view.rerender(<CategoryManager categories={next} max={max} {...props} />),
  };
}

describe('CategoryManager — 목록', () => {
  it('만든 성격들을 보여준다', () => {
    renderManager();
    expect(screen.getByText('영어')).toBeInTheDocument();
    expect(screen.getByText('과제')).toBeInTheDocument();
  });

  it('성격이 하나도 없으면 만들라고 알려준다', () => {
    renderManager({ categories: [] });
    expect(screen.getByText(/아직 만든 성격이 없습니다/)).toBeInTheDocument();
  });
});

describe('CategoryManager — 추가', () => {
  it('이름과 색을 고르고 추가하면 그대로 만들기를 요청한다', async () => {
    const { onCreate, user } = renderManager();

    await user.type(screen.getByLabelText(/새 성격 이름/), '시험');
    await user.click(screen.getByRole('radio', { name: /색 5번/ }));
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onCreate).toHaveBeenCalledWith({ name: '시험', color: 5 });
  });

  it('색을 고르지 않으면 첫 칸으로 만든다', async () => {
    const { onCreate, user } = renderManager();

    await user.type(screen.getByLabelText(/새 성격 이름/), '시험');
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onCreate).toHaveBeenCalledWith({ name: '시험', color: 1 });
  });

  it('이름이 비면 요청을 보내지 않고 이유를 알려준다', async () => {
    const { onCreate, user } = renderManager();

    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('성격 이름을 입력해 주세요');
  });

  // 이름 중복 같은 규칙은 서버만 안다. 그 말이 폼 안에 붙어야 고칠 수 있다.
  it('서버가 거절하면 그 이유를 폼 안에 보여주고 입력을 지우지 않는다', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('같은 이름의 성격이 이미 있습니다.'));
    const { user } = renderManager({ onCreate });

    await user.type(screen.getByLabelText(/새 성격 이름/), '영어');
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('같은 이름의 성격이 이미 있습니다');
    expect(screen.getByLabelText(/새 성격 이름/)).toHaveValue('영어');
  });

  it('추가에 성공하면 폼을 비워 다음 것을 받을 준비를 한다', async () => {
    const { user } = renderManager();

    await user.type(screen.getByLabelText(/새 성격 이름/), '시험');
    await user.click(screen.getByRole('button', { name: '추가하기' }));

    expect(await screen.findByLabelText(/새 성격 이름/)).toHaveValue('');
  });
});

describe('CategoryManager — 색 고르기', () => {
  it('여덟 칸을 각각 이름으로 구분할 수 있다', () => {
    renderManager();

    const swatches = screen.getAllByRole('radio');
    expect(swatches).toHaveLength(8);
    // 색은 낭독기에 보이지 않는다. 하나라도 이름이 없으면 고를 수가 없다.
    swatches.forEach(swatch => expect(swatch).toHaveAccessibleName());
  });

  it('색은 한 번에 하나만 골라진다', async () => {
    const { user } = renderManager();

    await user.click(screen.getByRole('radio', { name: /색 3번/ }));

    expect(screen.getByRole('radio', { name: /색 3번/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /색 1번/ })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('CategoryManager — 수정과 삭제', () => {
  it('수정을 고르면 폼에 원래 이름과 색이 채워진다', async () => {
    const { user } = renderManager();

    await user.click(screen.getByRole('button', { name: '영어 성격 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '수정' }));

    expect(screen.getByLabelText(/이름 수정/)).toHaveValue('영어');
    expect(screen.getByRole('radio', { name: /색 3번/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('수정한 내용을 그 성격의 id로 보낸다', async () => {
    const { onUpdate, user } = renderManager();

    await user.click(screen.getByRole('button', { name: '영어 성격 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '수정' }));
    await user.clear(screen.getByLabelText(/이름 수정/));
    await user.type(screen.getByLabelText(/이름 수정/), '영어 단어');
    await user.click(screen.getByRole('button', { name: '수정 완료' }));

    expect(onUpdate).toHaveBeenCalledWith('c1', { name: '영어 단어', color: 3 });
  });

  it('수정을 취소하면 다시 추가하는 폼으로 돌아온다', async () => {
    const { user } = renderManager();

    await user.click(screen.getByRole('button', { name: '영어 성격 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '수정' }));
    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByRole('button', { name: '추가하기' })).toBeInTheDocument();
    expect(screen.getByLabelText(/새 성격 이름/)).toHaveValue('');
  });

  it('삭제를 고르면 그 성격의 id로 삭제를 요청한다', async () => {
    const { onDelete, user } = renderManager();

    await user.click(screen.getByRole('button', { name: '과제 성격 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));

    expect(onDelete).toHaveBeenCalledWith('c2');
  });
});

describe('CategoryManager — 개수 제한', () => {
  const many = (count) =>
    Array.from({ length: count }, (_, i) => ({ id: `c${i}`, name: `성격${i}`, color: 1 }));

  it('한 자리 남았으면 아직 추가할 수 있다', () => {
    renderManager({ categories: many(11), max: 12 });
    expect(screen.getByRole('button', { name: '추가하기' })).toBeEnabled();
  });

  it('꽉 차면 추가할 수 없고 이유를 알려준다', () => {
    renderManager({ categories: many(12), max: 12 });
    expect(screen.getByRole('button', { name: '추가하기' })).toBeDisabled();
    expect(screen.getByText(/최대 12개까지/)).toBeInTheDocument();
  });

  // 없는 성격을 계속 고치고 있으면, 저장할 때 서버의 영어 404 문구가 폼에 그대로 뜬다
  it('고치던 성격이 사라지면 추가하는 폼으로 돌아간다', async () => {
    const { user, showCategories, onUpdate } = renderManager();

    await user.click(screen.getByRole('button', { name: '영어 성격 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '수정' }));
    expect(screen.getByRole('button', { name: '수정 완료' })).toBeInTheDocument();

    showCategories([CATEGORIES[1]]); // '영어'가 지워진 뒤

    expect(screen.getByRole('button', { name: '추가하기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '수정 완료' })).not.toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('꽉 찼어도 이미 있는 성격은 수정할 수 있다', async () => {
    const { onUpdate, user } = renderManager({ categories: many(12), max: 12 });

    await user.click(screen.getByRole('button', { name: '성격0 성격 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '수정' }));
    await user.clear(screen.getByLabelText(/이름 수정/));
    await user.type(screen.getByLabelText(/이름 수정/), '고친 이름');
    await user.click(screen.getByRole('button', { name: '수정 완료' }));

    expect(onUpdate).toHaveBeenCalledWith('c0', { name: '고친 이름', color: 1 });
  });
});
