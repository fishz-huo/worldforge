/**
 * 时间轴对齐自测
 * ==================================================================
 * 覆盖的是"看着不对但说不出哪不对"的那一类：刻度、条目、游标必须在
 * 同一个坐标系里。v0.2 的用户反馈就是「泳道和刻度对不齐、游标也不在
 * 刻度上」，根因有两个，这里各锁一条：
 *
 *   1. 适配（fit）时没扣掉泳道名称列的宽度 → 内容比可视区宽一条名称列，
 *      横向明明还能滚，看起来就是"差一格"；
 *   2. 泳道里的绝对定位以泳道自身为基准，而泳道的左边缘在名称列右边 →
 *      条目与游标整体多偏一个名称列。修法是统一用 `toLaneX = toX - gutter`。
 *
 * 这两条都是纯算术，可以在这里反复验；真机上的像素级验证见
 * scripts/ui-probe.mjs（用无头 Chrome 量刻度与游标的实际屏幕坐标）。
 */
import { register } from 'node:module';
import { group, test, assert, finish } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const S = await import('@/features/timeline/scale.ts');
const V = await import('@/features/timeline/useTimelineView.ts');
const { LABEL_COL, LABEL_COL_NARROW } = V;

group('时间轴对齐');

/** 与 TimelineCanvas 完全一致的换算（改动这里必须同步改那里） */
const toX = (t, range, pxPerUnit) => (t - range.min) * pxPerUnit;
const toLaneX = (t, range, pxPerUnit, gutter) => toX(t, range, pxPerUnit) - gutter;

await test('名称列宽度：宽屏 144、窄屏 80，且都与常量一致', () => {
  assert.equal(LABEL_COL, 144);
  assert.equal(LABEL_COL_NARROW, 80);
});

await test('适配后内容宽度不超过可视宽度（否则横向会冒出多余的滚动条）', () => {
  const viewport = 1000;
  const gutter = LABEL_COL;
  const range = S.padRange({ min: 0, max: 330 }, 0.06, 0.12);
  const px = S.fitPxPerUnit(range, viewport - gutter);
  const width = S.contentWidth(range, px);
  assert.ok(
    width <= viewport - gutter + 0.5,
    `内容宽 ${width.toFixed(1)} 应不超过可用宽度 ${viewport - gutter}`,
  );
  // 也不能缩得太狠：至少要占满九成，否则"适配全部"之后右边空一大片
  assert.ok(width > (viewport - gutter) * 0.9, `内容宽 ${width.toFixed(1)} 缩得太小了`);
});

await test('刻度与条目落在同一屏幕位置：扣掉名称列之后相等', () => {
  const range = { min: -19.8, max: 349.8 };
  const pxPerUnit = 3.28;
  const gutter = LABEL_COL;
  [0, 50, 100, 245, 330].forEach((t) => {
    const axisScreen = toX(t, range, pxPerUnit);          // 刻度尺从内容左端开始
    const laneScreen = gutter + toLaneX(t, range, pxPerUnit, gutter); // 泳道左边缘 = 名称列右边
    assert.equal(Math.round(axisScreen * 100), Math.round(laneScreen * 100));
  });
});

await test('不扣名称列就会错开整整一个名称列（回归防护）', () => {
  const range = { min: 0, max: 100 };
  const pxPerUnit = 8;
  const gutter = LABEL_COL;
  const right = gutter + toLaneX(50, range, pxPerUnit, gutter);
  const wrong = gutter + toX(50, range, pxPerUnit);
  assert.equal(wrong - right, gutter, '这正是用户看到的"差一格"');
});

await test('游标换算与渲染互为逆运算（点哪里就是哪里）', () => {
  const range = { min: -19.8, max: 349.8 };
  const pxPerUnit = 3.28;
  const scrollLeft = 240;
  // 模拟：在刻度尺上点击视口内第 317 像素处
  const contentX = scrollLeft + 317;
  const t = S.xToTime(contentX, range, pxPerUnit);
  assert.equal(Math.round(S.timeToX(t, range, pxPerUnit) * 100), Math.round(contentX * 100));
});

await test('缩放锚点补偿：缩放前后同一时刻停在视口同一像素', () => {
  const range = { min: -19.8, max: 349.8 };
  const anchorPx = 400;
  const before = 2.5;
  const after = 2.5 * 1.25;
  const scrollBefore = 120;
  const anchorTime = S.xToTime(scrollBefore + anchorPx, range, before);
  const scrollAfter = S.scrollLeftToKeep(anchorTime, anchorPx, range, after);
  const screenAfter = S.timeToX(anchorTime, range, after) - scrollAfter;
  assert.equal(Math.round(screenAfter), anchorPx);
});

finish();
