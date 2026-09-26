/**
 * 自测（三十二）：地图拖拽的合帧提交、拉框建区域与落点防重叠
 * ------------------------------------------------------------------
 * 用法：node scripts/map-drag-selftest.mjs
 *
 * 为什么这三样必须有自测：
 *   - 合帧写库（mapDragFrame）出错的表面现象是"松手后位置差一截"或"拖了不动"，
 *     肉眼几乎判断不出来，只能把 rAF 换成假时钟，逐条验 push / flush / cancel；
 *   - 拉框建区域（rectPolygon / rectDrawable）算错就是"拖出来的区域是歪的"或
 *     "明明拖了却没建出来"；
 *   - 落点防重叠（pinNear）算错要么叠出看不见的标记、要么正常落点被误吞。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const F = await import('@/features/map/mapDragFrame.ts');
const E = await import('@/features/map/mapRegionEdit.ts');
const T = await import('@/features/map/mapMarqueeTargets.ts');

/** 假 rAF：request 只记回调、cancel 把那一格清掉、fire 才真的跑 */
function fakeClock() {
  const slots = [];
  return {
    slots,
    request(cb) { slots.push(cb); return slots.length; },
    cancel(handle) { slots[handle - 1] = null; },
    fire() { slots.splice(0).forEach((cb) => cb && cb()); },
  };
}

group('拖拽合帧提交（每一次 pointermove 都要写回，但一帧只写一次）');
await test('同一帧里连推三次 → 只排一帧，提交的是最后一次', () => {
  const clock = fakeClock();
  const got = [];
  const commit = F.createFrameCommit((v) => got.push(v), clock);
  commit.push(1);
  commit.push(2);
  commit.push(3);
  assert.equal(clock.slots.length, 1, '只排了一帧');
  assert.deepEqual(got, [], '帧还没到，先不提交');
  clock.fire();
  assert.deepEqual(got, [3]);
});
await test('松手 flush：立刻提交最后一次，并取消已排的帧（不会又提交一遍）', () => {
  const clock = fakeClock();
  const got = [];
  const commit = F.createFrameCommit((v) => got.push(v), clock);
  commit.push(7);
  commit.flush();
  assert.deepEqual(got, [7], 'flush 当场提交');
  assert.equal(clock.slots[0], null, '已排的那一帧被取消');
  clock.fire();
  assert.deepEqual(got, [7], '不会再提交一次');
});
await test('cancel：丢掉待提交的值，帧到了也不提交（指针取消 / 切模式）', () => {
  const clock = fakeClock();
  const got = [];
  const commit = F.createFrameCommit((v) => got.push(v), clock);
  commit.push(1);
  commit.cancel();
  clock.fire();
  assert.deepEqual(got, []);
});
await test('没有待提交时 flush 不调用 commit（只是点一下、没移动）', () => {
  const clock = fakeClock();
  let calls = 0;
  const commit = F.createFrameCommit(() => { calls += 1; }, clock);
  commit.flush();
  assert.equal(calls, 0);
});
await test('flush 之后还能继续 push：拖拽没结束时的下一次移动照常提交', () => {
  const clock = fakeClock();
  const got = [];
  const commit = F.createFrameCommit((v) => got.push(v), clock);
  commit.push(1);
  commit.flush();
  commit.push(2);
  clock.fire();
  assert.deepEqual(got, [1, 2]);
});

group('拉框建区域的矩形（mapRegionEdit）');
await test('四个顶点与拖动方向无关：左上→右下、右下→左上，结果完全一样', () => {
  assert.deepEqual(E.rectPolygon([0.2, 0.3], [0.6, 0.8]), E.rectPolygon([0.6, 0.8], [0.2, 0.3]));
});
await test('顶点顺序固定为 左上 → 右上 → 右下 → 左下', () => {
  assert.deepEqual(E.rectPolygon([0.6, 0.8], [0.2, 0.3]), [[0.2, 0.3], [0.6, 0.3], [0.6, 0.8], [0.2, 0.8]]);
});
await test('够不够大：两条边都要过 0.01，一条线或原地不动都不建', () => {
  assert.equal(E.MIN_DRAW_SIZE, 0.01);
  assert.equal(E.rectDrawable([0.5, 0.5], [0.52, 0.52]), true, '比阈值大：建');
  assert.equal(E.rectDrawable([0.5, 0.5], [0.505, 0.52]), false, '只有阈值的一半：不建');
  assert.equal(E.rectDrawable([0.2, 0.2], [0.5, 0.205]), false, '只是一条横线');
  assert.equal(E.rectDrawable([0.3, 0.3], [0.3, 0.3]), false, '原地没动');
});

group('落点防重叠（pinNear）');
const RECT = { left: 0, top: 0, width: 100, height: 100 };
const pin = (id, x, y) => ({ id, x, y });
await test('中心距小于半个命中盒（12px）算"同一个地方"', () => {
  assert.equal(T.pinNear([pin('a', 0.5, 0.5)], RECT, 0.5, 0.5)?.id, 'a', '正中心');
  assert.equal(T.pinNear([pin('a', 0.5, 0.5)], RECT, 0.61, 0.5)?.id, 'a', '11px');
  assert.equal(T.pinNear([pin('a', 0.5, 0.5)], RECT, 0.63, 0.5), null, '13px 就放过');
});
await test('换算按世界层矩形走：同一个归一化点，在更大的矩形上算得更远', () => {
  const big = { left: 0, top: 0, width: 1000, height: 1000 };
  assert.equal(T.pinNear([pin('a', 0.5, 0.5)], big, 0.52, 0.5), null, '0.02 × 1000 = 20px');
  assert.equal(T.pinNear([pin('a', 0.5, 0.5)], big, 0.51, 0.5)?.id, 'a', '0.01 × 1000 = 10px');
});
await test('多个候选取最近的；空列表返回 null', () => {
  const list = [pin('far', 0.5, 0.5), pin('near', 0.52, 0.5)];
  assert.equal(T.pinNear(list, RECT, 0.515, 0.5)?.id, 'near');
  assert.equal(T.pinNear([], RECT, 0.5, 0.5), null);
});

finish('地图拖拽与建区域');
