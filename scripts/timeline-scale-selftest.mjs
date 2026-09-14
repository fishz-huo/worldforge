/**
 * 自测（二十一）：时间轴坐标换算
 * ------------------------------------------------------------------
 * 用法：node scripts/timeline-scale-selftest.mjs
 *
 * 为什么这一层必须有自测：时间轴是「放大后要能滚动查看」的核心，
 * 而坐标算错的表现是"看着不太对"而不是报错 —— 刻度偏半格、
 * 缩小时鼠标下的位置跑掉、拖条目时长度变了，这些都不容易当场发现。
 *
 * 重点验四件事：
 *   1. 时间 ↔ 像素的往返一致；
 *   2. 缩放锚点不动（滚轮缩放时鼠标指着的那一刻不能跑）；
 *   3. 刻度步长随缩放变密变疏，且不会退化成 0 或无穷；
 *   4. 拖动吸附落在刻度上。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const S = await import('@/features/timeline/scale.ts');

group('时间 ↔ 像素');

const range = { min: 0, max: 100 };

await test('往返一致：toX 再 xToTime 回到原值', () => {
  [0, 1, 50, 99.5, 100].forEach((t) => {
    const x = S.timeToX(t, range, 12);
    assert.ok(Math.abs(S.xToTime(x, range, 12) - t) < 1e-9, `t=${t} 往返后不一致`);
  });
});

await test('内容宽度 = 跨度 × 比例尺，且不会退化成 0', () => {
  assert.equal(S.contentWidth(range, 10), 1000);
  assert.equal(S.contentWidth({ min: 5, max: 5 }, 10), 1, '零跨度也要给 1px，否则后面会除零');
});

await test('像素 → 时间长度（拖条目条用）', () => {
  assert.equal(S.pxToSpan(100, 20), 5);
  assert.equal(S.pxToSpan(0, 20), 0);
});

group('缩放锚点');

await test('缩放后鼠标指着的那一刻停在原地', () => {
  const pxPerUnit = 8;
  const viewportPx = 900;
  const scrollLeft = 1200;
  // 鼠标在视口内的第 300px 处
  const anchorPx = 300;
  const anchorTime = S.xToTime(scrollLeft + anchorPx, range, pxPerUnit);

  const zoomed = S.zoomBy(pxPerUnit, 1.5);
  const nextScroll = S.scrollLeftToKeep(anchorTime, anchorPx, range, zoomed);
  const afterTime = S.xToTime(nextScroll + anchorPx, range, zoomed);
  assert.ok(Math.abs(afterTime - anchorTime) < 1e-6,
    `锚点跑了：${anchorTime} → ${afterTime}`);
});

await test('缩小同样保持锚点（放大缩小是可逆的）', () => {
  const pxPerUnit = 30;
  const anchorPx = 150;
  const anchorTime = S.xToTime(900 + anchorPx, range, pxPerUnit);
  const back = S.zoomBy(S.zoomBy(pxPerUnit, 1 / S.ZOOM_STEP), S.ZOOM_STEP);
  assert.ok(Math.abs(back - pxPerUnit) < 1e-9, '放大再缩小应回到原比例尺');
  const scroll = S.scrollLeftToKeep(anchorTime, anchorPx, range, back);
  assert.ok(Math.abs(S.xToTime(scroll + anchorPx, range, back) - anchorTime) < 1e-9);
});

await test('比例尺被夹在合法区间内（不会出现 0 或无穷）', () => {
  assert.equal(S.zoomBy(5, 1e9), S.MAX_PX_PER_UNIT, '极大的倍数夹到上限');
  assert.equal(S.zoomBy(1e9, 4), S.MAX_PX_PER_UNIT, '已经很大的比例尺再放大仍夹在上限');
  assert.equal(S.zoomBy(1, 0), S.MIN_PX_PER_UNIT, '倍数为 0 视为缩到最小');
  assert.equal(S.zoomBy(1, -3), S.MIN_PX_PER_UNIT, '负数倍数同样缩到最小');
  // 倍数本身算坏（NaN / 无穷）时给中性值 1，而不是把界面缩到最小或顶到最大 ——
  // 用户看到的是"缩放没反应"，而不是"缩放按钮疯了"
  assert.equal(S.zoomBy(5, NaN), 1, '倍数 NaN → 中性比例尺');
  assert.equal(S.zoomBy(5, Infinity), 1, '倍数无穷 → 中性比例尺');
  assert.equal(S.clampPxPerUnit(NaN), 1, 'NaN 比例尺 → 中性值');
  assert.equal(S.clampPxPerUnit(Infinity), S.MAX_PX_PER_UNIT, '无穷大的比例尺 → 上限');
  assert.equal(S.clampPxPerUnit(-1), 1, '负数比例尺视为非法 → 中性值');
});

await test('居中定位：目标刻度落在视口正中', () => {
  const scroll = S.scrollLeftToCenter(50, 900, range, 10);
  const center = S.xToTime(scroll + 450, range, 10);
  assert.ok(Math.abs(center - 50) < 1e-9, `居中后中心是 ${center}`);
});

await test('适配全部条目：整段刚好铺满视口宽', () => {
  const px = S.fitPxPerUnit(range, 1000);
  assert.ok(Math.abs(S.contentWidth(range, px) - 1000) < 0.001, '内容宽度应等于视口宽');
});

group('刻度');

await test('步长永远是 1/2/5 × 10ⁿ', () => {
  [0.3, 3, 7, 40, 250, 8000].forEach((span) => {
    const step = S.niceStep(span, 8);
    const mantissa = step / 10 ** Math.floor(Math.log10(step));
    assert.ok([1, 2, 5, 10].some((m) => Math.abs(mantissa - m) < 1e-9),
      `span=${span} 得到不合规的步长 ${step}`);
  });
});

await test('放大时刻度变密（同一屏幕宽度里步长变小）', () => {
  const wide = S.visibleTicks(range, 2, 1000, 0).length;
  const zoomed = S.visibleTicks(range, 20, 1000, 0).length;
  assert.ok(zoomed >= wide, `放大后刻度数应不少于放大前：${wide} → ${zoomed}`);
  const stepWide = S.visibleTicks(range, 2, 1000, 0)[1] - S.visibleTicks(range, 2, 1000, 0)[0];
  const stepZoom = S.visibleTicks(range, 20, 1000, 0)[1] - S.visibleTicks(range, 20, 1000, 0)[0];
  assert.ok(stepZoom < stepWide, `放大后步长应变小：${stepWide} → ${stepZoom}`);
});

await test('刻度落在可见范围内，且是步长的整数倍', () => {
  const ticks = S.visibleTicks(range, 12, 800, 0);
  assert.ok(ticks.length > 0, '应该至少有一个刻度');
  ticks.forEach((t) => {
    assert.ok(t >= range.min - 1e-9 && t <= range.max + 1e-9, `刻度 ${t} 越界`);
  });
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 0;
  if (step > 0) {
    ticks.forEach((t) => {
      const k = t / step;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-6, `刻度 ${t} 不是步长 ${step} 的整数倍`);
    });
  }
});

await test('滚动到不同位置时刻度跟着变（不是固定画一份）', () => {
  const a = S.visibleTicks(range, 20, 400, 0);
  const b = S.visibleTicks(range, 20, 400, 400);
  assert.notDeepEqual(a, b, '滚动后可见刻度应该不同');
  assert.ok(b[0] > a[0], '往右滚动后第一个刻度应更大');
});

await test('极端缩放下刻度数量有上限（不会生成几十万个把界面拖死）', () => {
  const ticks = S.visibleTicks({ min: -1e6, max: 1e6 }, S.MIN_PX_PER_UNIT, 900, 0);
  assert.ok(ticks.length <= 500, `刻度数应被限制，实际 ${ticks.length}`);
});

group('拖动吸附');

await test('吸附到当前可见步长的整数倍', () => {
  const snapped = S.snapTime(37, range, 10, 900);
  const step = S.niceStep(900 / 10, 10);
  const k = snapped / step;
  assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `吸附结果 ${snapped} 不在步长 ${step} 的整数倍上`);
  assert.ok(Math.abs(snapped - 37) <= step, '吸附不该把值拉得太远');
});

group('全范围计算');

await test('条目与纪元都算进去，含负刻度', () => {
  const r = S.fullRangeOf(
    [{ start_t: -7, end_t: null }, { start_t: 4, end_t: 4.3 }],
    [{ start_t: -9, end_t: -1 }],
  );
  assert.equal(r.min, -9);
  assert.equal(r.max, 4.3);
});

await test('没有任何内容时给一个最小可画跨度', () => {
  const r = S.fullRangeOf([], []);
  assert.ok(r.max - r.min >= S.MIN_FULL_SPAN, `跨度太小：${r.max - r.min}`);
});

await test('只有一条瞬时条目时不会出现零宽度', () => {
  const r = S.fullRangeOf([{ start_t: 7, end_t: null }], []);
  assert.ok(r.max - r.min >= S.MIN_FULL_SPAN, `跨度太小：${r.max - r.min}`);
  assert.ok(r.min <= 7 && r.max >= 7, '那条条目要落在范围里');
});

await test('padRange 按比例外扩，范围仍然包含原值', () => {
  const r = S.padRange({ min: 0, max: 100 }, 0.1);
  assert.ok(r.min < 0 && r.max > 100, '应向外扩');
  assert.ok(Math.abs((r.max - r.min) - 120) < 1e-9, `扩后跨度应为 120，实际 ${r.max - r.min}`);
});

finish('时间轴坐标换算');
