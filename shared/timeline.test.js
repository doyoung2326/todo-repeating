import { describe, it, expect } from 'vitest';
import { layoutTimed, buildTimeAxis } from './timeline.js';

/** 타임라인 배치 계산. 시간이 겹치는 항목을 나란한 칸으로 나누는 부분이다. */

const item = (id, start_time, end_time = null) => ({ id, text: id, importance: 1, start_time, end_time });
const byId = (placed) => Object.fromEntries(placed.map(p => [p.t.id, p]));

describe('layoutTimed', () => {
  it('겹치지 않는 항목들은 각각 폭을 다 쓴다', () => {
    const placed = byId(layoutTimed([item('a', '09:00', '10:00'), item('b', '11:00', '12:00')]));

    expect(placed.a.lanes).toBe(1);
    expect(placed.b.lanes).toBe(1);
    expect(placed.a.lane).toBe(0);
    expect(placed.b.lane).toBe(0);
  });

  it('끝나는 시각과 시작하는 시각이 같으면 겹친 것으로 보지 않는다', () => {
    const placed = byId(layoutTimed([item('a', '09:00', '10:00'), item('b', '10:00', '11:00')]));

    expect(placed.a.lanes).toBe(1);
    expect(placed.b.lanes).toBe(1);
  });

  it('겹치는 두 항목은 칸을 나눠 서로 다른 자리에 놓인다', () => {
    const placed = byId(layoutTimed([item('a', '09:00', '11:00'), item('b', '10:00', '12:00')]));

    expect(placed.a.lanes).toBe(2);
    expect(placed.b.lanes).toBe(2);
    expect(placed.a.lane).not.toBe(placed.b.lane);
  });

  it('셋이 함께 겹치면 칸을 셋으로 나눈다', () => {
    const placed = layoutTimed([
      item('a', '09:00', '12:00'),
      item('b', '09:30', '12:00'),
      item('c', '10:00', '12:00'),
    ]);

    expect(placed.every(p => p.lanes === 3)).toBe(true);
    expect(new Set(placed.map(p => p.lane))).toEqual(new Set([0, 1, 2]));
  });

  it('앞 항목이 끝나면 그 칸을 뒤 항목이 다시 쓴다', () => {
    // a(09–10)와 b(09:30–11)는 겹치고, c(10:30–11:30)는 b와만 겹친다.
    // 셋이 한 묶음이지만 필요한 칸은 두 개뿐이다.
    const placed = byId(layoutTimed([
      item('a', '09:00', '10:00'),
      item('b', '09:30', '11:00'),
      item('c', '10:30', '11:30'),
    ]));

    expect(placed.a.lanes).toBe(2);
    expect(placed.c.lane).toBe(placed.a.lane);
    expect(placed.b.lane).not.toBe(placed.a.lane);
  });

  it('종료 시간이 없으면 한 시간짜리로 본다', () => {
    const [placed] = layoutTimed([item('a', '09:00')]);

    expect(placed.end - placed.start).toBe(60);
  });

  it('종료가 시작보다 빠르면 한 시간짜리로 본다', () => {
    // 잘못 입력된 값. 그대로 두면 높이가 음수가 되어 글자가 잘린다.
    const [placed] = layoutTimed([item('a', '21:51', '12:51')]);

    expect(placed.end - placed.start).toBe(60);
  });

  it('시작이 같아도 서로 다른 칸에 놓인다', () => {
    const placed = layoutTimed([item('a', '09:00', '10:00'), item('b', '09:00', '10:00')]);

    expect(new Set(placed.map(p => p.lane))).toEqual(new Set([0, 1]));
  });
});

/** 세로 축. 눈금은 다 남기되 빈 시간대의 높이만 접는다. */
const axisOf = (...times) => buildTimeAxis(layoutTimed(times.map(([s, e], i) => item(`i${i}`, s, e))));
const rowAt = (axis, hour) => axis.rows.find(r => r.hour === hour);

describe('buildTimeAxis', () => {
  it('06시부터 24시까지 눈금을 하나도 빼지 않는다', () => {
    const axis = axisOf(['19:00', '20:00']);

    expect(axis.rows.map(r => r.hour)).toEqual(
      Array.from({ length: 18 }, (_, i) => 6 + i)
    );
  });

  it('항목이 걸친 시간대만 제 높이를 갖고 나머지는 접힌다', () => {
    const axis = axisOf(['19:00', '20:00']);

    expect(rowAt(axis, 19).busy).toBe(true);
    expect(rowAt(axis, 19).height).toBe(52);
    expect(rowAt(axis, 9).busy).toBe(false);
    expect(rowAt(axis, 9).height).toBe(18);
  });

  it('저녁에만 일정이 있으면 전체 높이가 크게 줄어든다', () => {
    const full = 18 * 52;                       // 예전처럼 다 펼쳤을 때
    const axis = axisOf(['19:00', '20:00']);

    // 19시 한 칸만 52px, 나머지 17칸은 18px
    expect(axis.height).toBe(52 + 17 * 18);
    expect(axis.height).toBeLessThan(full / 2);
  });

  it('여러 시간에 걸친 항목은 걸친 시간대를 모두 펼친다', () => {
    const axis = axisOf(['19:55', '23:51']);

    [19, 20, 21, 22, 23].forEach(h => expect(rowAt(axis, h).busy).toBe(true));
    expect(rowAt(axis, 18).busy).toBe(false);
  });

  it('정각에 끝나는 항목은 그 시간대를 차지하지 않는다', () => {
    const axis = axisOf(['09:00', '10:00']);

    expect(rowAt(axis, 9).busy).toBe(true);
    expect(rowAt(axis, 10).busy).toBe(false);
  });

  it('블록의 위치와 길이를 축 위의 좌표로 바꿔준다', () => {
    const axis = axisOf(['19:00', '20:00']);
    const top    = axis.yOf(19 * 60);
    const bottom = axis.yOf(20 * 60);

    expect(top).toBe(rowAt(axis, 19).y);
    expect(bottom - top).toBe(52);
  });

  it('접힌 시간대 안에서도 비례해서 자리를 잡는다', () => {
    const axis = axisOf(['19:00', '20:00']);

    // 09:30은 접힌 09시 칸(18px)의 한가운데
    expect(axis.yOf(9 * 60 + 30) - rowAt(axis, 9).y).toBe(9);
  });

  it('06시 이전 항목이 있으면 축을 앞으로 늘린다', () => {
    const axis = axisOf(['05:00', '06:00']);

    expect(rowAt(axis, 5)).toBeDefined();
    expect(rowAt(axis, 5).busy).toBe(true);
    expect(axis.yOf(5 * 60)).toBe(0);
  });
});
