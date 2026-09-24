/**
 * 自测（二十六）：地图视口与浮窗摆位
 * ------------------------------------------------------------------
 * 用法：node scripts/map-viewport-selftest.mjs
 *
 * 为什么这一层必须有自测：底图缩放/平移算错的表现是「看着有点别扭」
 * 而不是报错 —— 滚轮放大后光标指着的位置跑掉、拖到边界露出空白、
 * 「适应屏幕」之后图还是偏的、浮窗贴到屏幕边缘被切掉一半。
 * 这些都没法用 typecheck 或肉眼稳定验收，只能把数学抽出来逐条验。
 *
 * 重点验六件事：
 *   1. 适应屏幕：整张底图刚好完整可见并居中；
 *   2. 缩放锚点不动（光标指着的那一刻不能跑）+ 上下限；
 *   3. 平移边界：拖不出空白、留白那一轴强制居中；
 *   4. 窗口改尺寸时中心不跳（scale 被夹时才需要按中心换算）；
 *   5. 归一化 ↔ 屏幕往返一致、换底图分辨率不错位；
 *   6. 浮窗边缘翻转与夹取。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const V = await import('@/features/map/mapViewport.ts');
const O = await import('@/features/map/mapOverlay.ts');

const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${msg}（实际 ${a}，期望 ${b}）`);
const box = { w: 900, h: 600 };
const square = { w: 4096, h: 4096 };

/* ------------------------------ 适应屏幕 ------------------------------ */
group('适应屏幕');

await test('方图放进 3:2 窗口：上下顶满，左右留白居中', () => {
  const vp = V.fitViewport(box, square);
  near(vp.scale, 600 / 4096, 'scale 由高度决定');
  near(vp.tx, 150, '左右各留 150px');
  near(vp.ty, 0, '高度刚好顶满');
});

await test('适应屏幕后底图完整落在窗口内，且百分比是 100%', () => {
  const vp = V.fitViewport(box, square);
  assert.ok(vp.tx >= 0 && vp.ty >= 0, '左上不能跑到窗口外');
  assert.ok(vp.tx + square.w * vp.scale <= box.w + 1e-6, '右边不能超出');
  assert.ok(vp.ty + square.h * vp.scale <= box.h + 1e-6, '下边不能超出');
  assert.equal(V.zoomPercent(vp, V.fitScale(box, square)), 100);
});

await test('底图比窗口还小也照样居中（不会偏到角上）', () => {
  const vp = V.fitViewport({ w: 2000, h: 1000 }, { w: 100, h: 100 });
  near(vp.scale, 10, '由较小的那一轴放大');
  near(vp.tx, (2000 - 1000) / 2, '横向居中');
  near(vp.ty, 0, '纵向顶满');
});

/* ------------------------------ 缩放锚点 ------------------------------ */
group('缩放锚点与上下限');

await test('滚轮放大：光标下的世界点一动不动', () => {
  const world = { w: 800, h: 600 };
  const vp = { scale: 1, tx: 10, ty: 20 };
  const next = V.zoomAt(vp, 2, 310, 220, box, world);
  const [sx, sy] = V.toScreen(next, 300 / 800, 200 / 600, world);
  near(sx, 310, '锚点 x 不变', 1e-9);
  near(sy, 220, '锚点 y 不变', 1e-9);
});

await test('缩到下限就是「适应屏幕」，缩不出空白', () => {
  let vp = V.fitViewport(box, square);
  for (let i = 0; i < 10; i += 1) vp = V.zoomAt(vp, 0.8, 450, 300, box, square);
  near(vp.scale, V.fitScale(box, square), '不能小于适应屏幕');
  assert.equal(V.zoomPercent(vp, V.fitScale(box, square)), 100);
});

await test('放大到上限 6 倍就停住', () => {
  let vp = V.fitViewport(box, square);
  for (let i = 0; i < 30; i += 1) vp = V.zoomAt(vp, 1.25, 450, 300, box, square);
  assert.equal(V.zoomPercent(vp, V.fitScale(box, square)), V.MAX_ZOOM * 100);
});

await test('滚轮位移 → 倍率：方向正确、极端值被夹住', () => {
  assert.ok(V.wheelFactor(-100) > 1, '向上滚 = 放大');
  assert.ok(V.wheelFactor(100) < 1, '向下滚 = 缩小');
  assert.equal(V.wheelFactor(0), 1, '没位移就不缩放');
  assert.equal(V.wheelFactor(-100000), 2, '极端值夹到 2');
  assert.equal(V.wheelFactor(100000), 0.5, '极端值夹到 0.5');
});

/* ------------------------------ 平移边界 ------------------------------ */
group('平移边界');

await test('底图比窗口大：往右下拖到底也不能露出空白', () => {
  const world = { w: 800, h: 600 };
  const vp = V.zoomAt({ scale: 1, tx: 10, ty: 20 }, 2, 310, 220, box, world);
  const far = V.panBy(vp, 10000, 10000, box, world);
  near(far.tx, 0, '左边界贴住窗口左边');
  near(far.ty, 0, '上边界贴住窗口上边');
  const back = V.panBy(vp, -10000, -10000, box, world);
  near(back.tx, box.w - world.w * back.scale, '右边界贴住窗口右边');
  near(back.ty, box.h - world.h * back.scale, '下边界贴住窗口下边');
});

await test('留白那一轴强制居中，怎么拖都不动', () => {
  const world = { w: 400, h: 600 };
  const vp = V.clampViewport({ scale: 1, tx: -999, ty: 0 }, box, world);
  near(vp.tx, (900 - 400) / 2, '横向居中');
  near(V.panBy(vp, 500, 0, box, world).tx, vp.tx, '拖了也不动');
});

await test('窗口改尺寸被夹放大时，窗口中心那块地图不跳走', () => {
  const world = { w: 4000, h: 4000 };
  const small = { w: 800, h: 800 };
  const vp = { scale: 3, tx: -1000, ty: -1000 };
  const before = (small.w / 2 - vp.tx) / vp.scale;
  const after = V.clampViewport(vp, small, world);
  near((small.w / 2 - after.tx) / after.scale, before, '中心对应的世界坐标不变', 1e-6);
});

/* ------------------------------ 坐标换算 ------------------------------ */
group('坐标换算');

await test('归一化 → 屏幕 → 归一化 往返一致', () => {
  const world = { w: 800, h: 600 };
  const vp = { scale: 2, tx: -290, ty: -180 };
  const [x, y] = V.toScreen(vp, 0.5, 0.5, world);
  near(x, 510, '横向像素');
  near(y, 420, '纵向像素');
  near((x - vp.tx) / vp.scale / world.w, 0.5, '反算回归一化');
  near((y - vp.ty) / vp.scale / world.h, 0.5, '反算回归一化');
});

await test('换底图分辨率不错位：同一归一化坐标落在同一屏幕位置', () => {
  const big = { w: 4096, h: 4096 };
  const half = { w: 2048, h: 2048 };
  const a = V.toScreen(V.fitViewport(box, big), 0.25, 0.25, big);
  const b = V.toScreen(V.fitViewport(box, half), 0.25, 0.25, half);
  near(a[0], b[0], '横向一致');
  near(a[1], b[1], '纵向一致');
});

await test('世界尺寸优先级：资源表元数据 > 实测 > 4:3 默认', () => {
  assert.deepEqual(V.resolveWorldSize({ width: 4096, height: 2048 }, { w: 100, h: 100 }), { w: 4096, h: 2048 });
  assert.deepEqual(V.resolveWorldSize({ width: 0, height: 0 }, { w: 800, h: 600 }), { w: 800, h: 600 });
  assert.deepEqual(V.resolveWorldSize(null, null), V.DEFAULT_WORLD);
});

await test('退化输入不产生 NaN（窗口还没量出来 / 尺寸为 0）', () => {
  const zero = { w: 0, h: 0 };
  assert.deepEqual(V.fitViewport(zero, square), { scale: 1, tx: 0, ty: 0 });
  assert.equal(V.fitScale(zero, square), 1);
  const vp = V.zoomAt(V.fitViewport(box, square), 1.25, 0, 0, zero, square);
  assert.ok(Number.isFinite(vp.scale) && Number.isFinite(vp.tx) && Number.isFinite(vp.ty), '全部是有限数');
  const pan = V.panBy(V.fitViewport(box, square), NaN, 5, box, square);
  assert.ok(Number.isFinite(pan.tx), 'NaN 位移被忽略');
});

/* ------------------------------ 浮窗摆位 ------------------------------ */
group('浮窗边缘碰撞');

const screen = { width: 1280, height: 648 };

await test('默认落在锚点正下方、水平居中对齐', () => {
  const p = O.placeOverlay({ left: 400, top: 100, width: 24, height: 24 }, { width: 320, height: 300 }, screen);
  assert.equal(p.side, 'bottom');
  near(p.top, 100 + 24 + O.OVERLAY_GAP, '下方留 8px 空隙');
  near(p.left, 400 + 12 - 160, '按锚点中线对齐');
});

await test('靠近屏幕下边缘 → 翻到锚点上方', () => {
  const p = O.placeOverlay({ left: 400, top: 600, width: 24, height: 24 }, { width: 320, height: 300 }, screen);
  assert.equal(p.side, 'top');
  near(p.top, 600 - O.OVERLAY_GAP - 300, '翻到上方');
  assert.ok(p.top >= O.OVERLAY_MARGIN, '仍然在屏幕内');
});

await test('靠近右边缘 → 往左收，不越界', () => {
  const p = O.placeOverlay({ left: 1260, top: 100, width: 24, height: 24 }, { width: 320, height: 300 }, screen);
  near(p.left, 1280 - 320 - O.OVERLAY_MARGIN, '贴住右边距');
  assert.ok(p.left >= O.OVERLAY_MARGIN, '不该变成负数');
});

await test('卡片比屏幕还大时也只贴边距，不出现负坐标', () => {
  const p = O.placeOverlay({ left: 640, top: 320, width: 24, height: 24 }, { width: 1400, height: 700 }, screen);
  assert.equal(p.left, O.OVERLAY_MARGIN);
  assert.equal(p.top, O.OVERLAY_MARGIN);
});

await test('锚点在左下角（小窗口手机）也不会被切掉', () => {
  const phone = { width: 360, height: 640 };
  const p = O.placeOverlay({ left: 4, top: 620, width: 24, height: 24 }, { width: 320, height: 400 }, phone);
  assert.equal(p.side, 'top');
  assert.ok(p.left >= O.OVERLAY_MARGIN && p.left + 320 <= 360, '横向完整');
  assert.ok(p.top >= O.OVERLAY_MARGIN && p.top + 400 <= 640, '纵向完整');
});

finish('地图视口与浮窗摆位');
