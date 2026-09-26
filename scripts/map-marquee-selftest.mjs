/**
 * 自测（三十一）：地图框选（CAD 式窗选 / 交叉选）的几何、起手判定与选择集
 * ------------------------------------------------------------------
 * 用法：node scripts/map-marquee-selftest.mjs
 *
 * 为什么这一层必须有自测：框选算错了都不会报错，只会"手感不对"——窗选与交叉选
 * 判反了（框到的东西忽多忽少）、贴边不算命中（明明框住了却不选中）、大区域包住
 * 小框时一个都选不上、打点工具下拖一下反而开始框选（本该落标记）。typecheck 与
 * 肉眼都拦不住，只能把几何与起手条件抽成纯函数逐条验。
 *
 * 坐标全是**客户端像素**（与运行时一致）；形状投影（24px 标记方盒 / 旋转正方形
 * 地形 / 区域多边形）另有一组专门验。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const M = await import('@/features/map/mapMarquee.ts');
const T = await import('@/features/map/mapMarqueeTargets.ts');
const S = await import('@/features/map/mapSelection.ts');

const near = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${msg}（实际 ${a}，期望 ${b}）`);
const item = (kind, id) => ({ kind, id });
/** 24px 的标记方盒（默认中心 200,200） */
const pinAt = (id, cx, cy) => ({ kind: 'pin', id, points: T.rectPoints(cx, cy, 24, 24) });
/** 屏幕空间的大方块区域 */
const boxRegion = (id, l, t, r, b) => ({ kind: 'region', id, points: [[l, t], [r, t], [r, b], [l, b]] });

const inside = M.boxOf(150, 150, 250, 250); // 能把中心那个标记整个框住
const offset = M.boxOf(210, 150, 300, 250); // 只压住中心标记的右半边

group('方向语义（CAD 习惯）');
await test('左→右 = 窗选，右→左 = 交叉选；原地算窗选，差 1px 就翻转', () => {
  assert.equal(M.marqueeMode(100, 300), 'window');
  assert.equal(M.marqueeMode(300, 100), 'crossing');
  assert.equal(M.marqueeMode(200, 200), 'window');
  assert.equal(M.marqueeMode(200, 199), 'crossing');
});

group('矩形规范化');
await test('往反方向拖也得到 left ≤ right、top ≤ bottom 的正矩形', () => {
  assert.deepEqual(M.boxOf(300, 200, 100, 50), { left: 100, top: 50, right: 300, bottom: 200 });
  assert.deepEqual(M.boxOf(100, 50, 300, 200), { left: 100, top: 50, right: 300, bottom: 200 });
  assert.deepEqual(M.boxOf(7, 7, 7, 7), { left: 7, top: 7, right: 7, bottom: 7 });
});

group('起手判定');
/** 能起框的基准：编辑模式 + 选择工具 + 空白 + 左键 + 无修饰键 */
const OK = {
  viewMode: 'edit', tool: 'select', panMode: false, brushActive: false, onSpot: false,
  button: 0, ctrlKey: false, metaKey: false, altKey: false,
};
await test('编辑模式 + 选择工具 + 空白左键 → 能起框', () => {
  assert.equal(M.marqueeEligible(OK), true);
});
await test('区域工具不再起框（空白拖动改成拉出一个新区域了，2026-09-26 问题二）', () => {
  assert.equal(M.marqueeEligible({ ...OK, tool: 'region' }), false);
});
await test('预览模式不起框（那里左键拖空白是平移画布）', () => {
  assert.equal(M.marqueeEligible({ ...OK, viewMode: 'preview' }), false);
});
await test('打点 / 平移工具不起框（拖空白＝落标记或平移）', () => {
  assert.equal(M.marqueeEligible({ ...OK, tool: 'pin' }), false);
  assert.equal(M.marqueeEligible({ ...OK, tool: 'pan' }), false);
});
await test('平移态（按住空格）与画笔刷时让路', () => {
  assert.equal(M.marqueeEligible({ ...OK, panMode: true }), false);
  assert.equal(M.marqueeEligible({ ...OK, brushActive: true }), false);
});
await test('按在对象 / 顶点 / 手柄上不起框（那是选中或拖动，会写库）', () => {
  assert.equal(M.marqueeEligible({ ...OK, onSpot: true }), false);
});
await test('中键右键与鼠标其它键都不起框', () => {
  for (const button of [1, 2, 3, -1]) assert.equal(M.marqueeEligible({ ...OK, button }), false, `button=${button}`);
});
await test('Ctrl / ⌘ / Alt 都不参与（加顶点、减顶点让给它们）', () => {
  assert.equal(M.marqueeEligible({ ...OK, ctrlKey: true }), false);
  assert.equal(M.marqueeEligible({ ...OK, metaKey: true }), false);
  assert.equal(M.marqueeEligible({ ...OK, altKey: true }), false);
  assert.equal(M.marqueeEligible({ ...OK, ctrlKey: true, metaKey: true, altKey: true }), false);
});
await test('阈值与平移同一口径：4px', () => assert.equal(M.MARQUEE_THRESHOLD, 4));

group('窗选（完全框住才算）');
await test('整个标记在框里 → 命中；压住一半 → 不命中', () => {
  assert.deepEqual(M.hitsOf([pinAt('p1', 200, 200)], inside, 'window'), [{ kind: 'pin', id: 'p1' }]);
  assert.deepEqual(M.hitsOf([pinAt('p1', 200, 200)], offset, 'window'), []);
});
await test('边界正好贴住 → 算命中（闭区间，那 1px 也不放过）', () => {
  const box = M.boxOf(188, 188, 212, 212); // 与 24px 方盒的四个角严格重合
  assert.deepEqual(M.hitsOf([pinAt('p1', 200, 200)], box, 'window'), [{ kind: 'pin', id: 'p1' }]);
});
await test('区域只框进一部分 → 不命中；整个框进 → 命中', () => {
  const region = boxRegion('r1', 100, 100, 300, 300);
  assert.deepEqual(M.hitsOf([region], M.boxOf(100, 100, 250, 300), 'window'), []);
  assert.deepEqual(M.hitsOf([region], M.boxOf(50, 50, 350, 350), 'window'), [item('region', 'r1')]);
});

group('交叉选（碰到就算）');
await test('压住一半 → 命中（与窗选的差别就在这里）；完全在框外 → 不命中', () => {
  assert.deepEqual(M.hitsOf([pinAt('p1', 200, 200)], offset, 'crossing'), [{ kind: 'pin', id: 'p1' }]);
  assert.deepEqual(M.hitsOf([pinAt('p1', 600, 600)], offset, 'crossing'), []);
});
await test('顶点都在框外、只有一条边穿过框 → 命中', () => {
  const wide = boxRegion('r1', 50, 150, 350, 160); // 横穿框的长条
  assert.deepEqual(M.hitsOf([wide], M.boxOf(120, 100, 250, 220), 'crossing'), [item('region', 'r1')]);
});
await test('大区域整个包住小框（顶点都在框外、边也不穿）→ 命中', () => {
  const big = boxRegion('r1', 0, 0, 400, 400);
  assert.deepEqual(M.hitsOf([big], inside, 'crossing'), [item('region', 'r1')]);
});
await test('只擦到一条边（共线贴边）→ 命中', () => {
  const face = boxRegion('r1', 250, 100, 400, 300); // 左边正好压在框的右边上
  assert.deepEqual(M.hitsOf([face], inside, 'crossing'), [item('region', 'r1')]);
});
await test('旋转过的地形按真实四角算，不是按外接矩形', () => {
  const rotated = { kind: 'terrain', id: 't1', points: T.rectPoints(200, 200, 24, 24, 45) };
  const cornerOnly = M.boxOf(211, 211, 219, 219); // 落在外接盒右上角、真实形状之外
  assert.deepEqual(M.hitsOf([rotated], cornerOnly, 'crossing'), []);
  assert.deepEqual(M.hitsOf([rotated], M.boxOf(190, 190, 210, 210), 'crossing'), [item('terrain', 't1')]);
});

group('命中清单的输出');
await test('顺序＝候选顺序（标记 → 地形 → 区域），一次框多个也是这个序', () => {
  const candidates = [pinAt('p1', 200, 200), pinAt('p2', 210, 210), boxRegion('r1', 180, 180, 220, 220)];
  assert.deepEqual(M.hitsOf(candidates, M.boxOf(150, 150, 260, 260), 'crossing'), [
    item('pin', 'p1'), item('pin', 'p2'), item('region', 'r1'),
  ]);
});
await test('同一个对象在候选里出现两次也只出一条', () => {
  assert.deepEqual(M.hitsOf([pinAt('p1', 200, 200), pinAt('p1', 200, 200)], inside, 'window'), [item('pin', 'p1')]);
});
await test('没有顶点的候选（脏数据）不命中也不抛错', () => {
  assert.deepEqual(M.hitsOf([{ kind: 'region', id: 'r1', points: [] }], inside, 'crossing'), []);
});

group('候选几何的屏幕投影');
const RECT = { left: 100, top: 50, width: 400, height: 300 };
await test('标记：24px 方盒，中心落在归一化坐标投影出来的位置', () => {
  const [c] = T.buildCandidates(RECT, [{ id: 'p1', x: 0.5, y: 0.5 }], [], []);
  assert.deepEqual(c.points, [[288, 188], [312, 188], [312, 212], [288, 212]]);
});
await test('区域：归一化顶点原样投影（0,0 → 世界层左上角）', () => {
  const [c] = T.buildCandidates(RECT, [], [], [{ id: 'r1', points: [[0, 0], [1, 1]] }]);
  assert.deepEqual(c.points, [[100, 50], [500, 350]]);
});
await test('地形：边长 = 底图宽 ×6% × size，旋转角跟着 meta 走', () => {
  const meta = { kind: 'terrain', symbol: 'forest', size: 1, rotation: 0 };
  const [flat] = T.buildCandidates(RECT, [], [{ id: 't1', x: 0.5, y: 0.5, meta }], []);
  near(flat.points[0][0], 288, '边长 400×6% = 24，方盒左边界');
  const [turned] = T.buildCandidates(RECT, [], [{ id: 't1', x: 0.5, y: 0.5, meta: { ...meta, rotation: 45 } }], []);
  near(turned.points[0][1], 200 - 12 * Math.SQRT2, '转 45° 后顶点抬到外接盒之外');
});
await test('meta 坏了的地形行不出候选（宁可漏一个，也别按奇怪形状命中）', () => {
  const bad = { id: 't1', x: 0.5, y: 0.5, meta: { kind: 'terrain', symbol: '__nope__' } };
  assert.deepEqual(T.buildCandidates(RECT, [], [bad], []), []);
  assert.deepEqual(T.buildCandidates(RECT, [], [{ id: 't2', x: 0.5, y: 0.5 }], []), []);
});

group('选择集（数量 / 去重 / 追加）');
await test('按种类清点：检查器那行数字就是它算的', () => {
  assert.deepEqual(S.selectionCounts([item('pin', 'p1'), item('pin', 'p2'), item('region', 'r1')]), {
    total: 3, pin: 2, region: 1, terrain: 0,
  });
  assert.deepEqual(S.selectionCounts([]), { total: 0, pin: 0, region: 0, terrain: 0 });
});
await test('去重按 kind+id：同 id 的标记与地形是两条', () => {
  assert.equal(S.selectionKey(item('pin', 'x')), 'pin:x');
  assert.deepEqual(S.dedupeItems([item('pin', 'x'), item('terrain', 'x'), item('pin', 'x')]),
    [item('pin', 'x'), item('terrain', 'x')]);
});
await test('Shift 追加：原有的排在前，重叠的只留一条', () => {
  const prev = [item('pin', 'p1'), item('region', 'r1')];
  assert.deepEqual(S.mergeItems(prev, [item('region', 'r1'), item('pin', 'p2')], true),
    [item('pin', 'p1'), item('region', 'r1'), item('pin', 'p2')]);
});
await test('不按 Shift：整体替换（框到 0 个就是清空）', () => {
  assert.deepEqual(S.mergeItems([item('pin', 'p1')], [item('region', 'r2')], false), [item('region', 'r2')]);
  assert.deepEqual(S.mergeItems([item('pin', 'p1')], [], false), []);
});
await test('不修改传进来的数组（图层靠引用对比决定要不要重画）', () => {
  const prev = [item('pin', 'p1')];
  const next = [item('pin', 'p2')];
  S.mergeItems(prev, next, true);
  assert.deepEqual(prev, [item('pin', 'p1')]);
  assert.deepEqual(next, [item('pin', 'p2')]);
});

finish('地图框选几何');
