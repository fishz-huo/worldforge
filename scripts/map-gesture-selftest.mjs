/**
 * 自测（二十七）：地图第三轮的交互数学
 * ------------------------------------------------------------------
 * 用法：node scripts/map-gesture-selftest.mjs
 *
 * 为什么这一层必须有自测：这一轮加的东西算错了都不会报错，只会「手感不对」——
 * 平移工具下拖标记反而把标记拖走、区域整体移动被边界挤变形、Ctrl 加的顶点
 * 插到了末尾让多边形自交、空格在输入框里打不出来。这些 typecheck 与肉眼都
 * 拦不住，只能把判定与几何抽成纯函数逐条验。
 *
 * 重点验四件事：1 让路判定（中键恒平移、左键只在平移态、输入框里空格不抢）；
 * 2 整体位移（按包围盒夹取、不变形、不出 0~1）；3 边缘命中（屏幕像素下取最近边、
 * 阈值外不命中、退化输入无 NaN）；4 加顶点（插在最近边起点之后，落点在边上）。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const P = await import('@/features/map/mapPan.ts');
const G = await import('@/features/map/mapRegionEdit.ts');

const near = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${msg}（实际 ${a}，期望 ${b}）`);

/** 正方形区域：归一化 [[0,0],[1,0],[1,1],[0,1]]，边 0=上 1=右 2=下 3=左 */
const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
/** 铺满画布的正方形挪不动（位移被夹成 0），整体移动的用例要用这个「内部」区域 */
const inner = [[0.3, 0.3], [0.6, 0.3], [0.6, 0.6], [0.3, 0.6]];
const BOX = { w: 400, h: 300 };

/* ------------------------------ 让路判定 ------------------------------ */
group('平移让路判定');

await test('中键：任何模式、任何工具都平移', () => {
  assert.equal(P.isPanPress(1, false), true, '编辑模式非平移态也要平移');
  assert.equal(P.isPanPress(1, true), true);
});

await test('左键：只有平移态（平移工具 / 按住空格 / 预览）才平移', () => {
  assert.equal(P.isPanPress(0, true), true);
  assert.equal(P.isPanPress(0, false), false, '选择/打点工具下左键不能平移');
});

await test('右键与其它键不平移（右键要留给系统菜单）', () => {
  assert.equal(P.isPanPress(2, true), false);
  assert.equal(P.isPanPress(3, true), false);
  assert.equal(P.isPanPress(-1, true), false);
});

await test('输入框内空格不抢：input / textarea / select / contentEditable 都算可编辑', () => {
  assert.equal(P.isEditableTarget({ tagName: 'INPUT' }), true);
  assert.equal(P.isEditableTarget({ tagName: 'textarea' }), true, '标签名大小写不敏感');
  assert.equal(P.isEditableTarget({ tagName: 'SELECT' }), true);
  assert.equal(P.isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
});

await test('普通元素与空目标不算可编辑（否则空格平移会失效）', () => {
  assert.equal(P.isEditableTarget({ tagName: 'DIV' }), false);
  assert.equal(P.isEditableTarget({ tagName: 'BUTTON' }), false);
  assert.equal(P.isEditableTarget(null), false);
  assert.equal(P.isEditableTarget({}), false, '事件目标没有标签名时也不能抛错');
});

/* ------------------------------ 整体位移 ------------------------------ */
group('区域整体位移');

await test('随便挪一点：位移原样通过', () => {
  const [dx, dy] = G.clampShift(inner, 0.1, -0.2);
  near(dx, 0.1, 'dx');
  near(dy, -0.2, 'dy');
});

await test('铺满画布的区域挪不动：位移被夹成 0（也不会变形）', () => {
  const [dx, dy] = G.clampShift(square, 0.1, -0.2);
  near(dx, 0, '四条边已经贴着边界');
  near(dy, 0, '四条边已经贴着边界');
});

await test('往右下拖到很远：贴住右下边界就停，不会拖出 0~1', () => {
  const [dx, dy] = G.clampShift(square, 5, 5);
  near(dx, 0, '已经顶满右边，不能再往右');
  near(dy, 0, '已经顶满下边，不能再往右');
  const half = G.clampShift([[0.4, 0.4], [0.6, 0.6]], 5, 5);
  near(half[0], 0.4, '小区域能挪到右下角');
  near(half[1], 0.4, '小区域能挪到右下角');
});

await test('往左上拖到很远：贴住左上边界就停', () => {
  const [dx, dy] = G.clampShift(square, -5, -5);
  near(dx, 0, '已经贴住左边');
  near(dy, 0, '已经贴住上边');
  const half = G.clampShift([[0.4, 0.1], [0.6, 0.2]], -5, -5);
  near(half[0], -0.4, '横向最多到 0');
  near(half[1], -0.1, '纵向最多到 0');
});

await test('夹取按整个包围盒算：拖到边界时形状一点不变形', () => {
  const region = [[0.2, 0.3], [0.5, 0.25], [0.6, 0.5], [0.3, 0.6]];
  const [dx, dy] = G.clampShift(region, 9, 9);
  const moved = G.shiftPoints(region, dx, dy);
  near(dx, 0.4, '横向最多贴到 1');
  near(dy, 0.4, '纵向最多贴到 1');
  for (let i = 0; i < region.length; i += 1) {
    const j = (i + 1) % region.length;
    near(moved[j][0] - moved[i][0], region[j][0] - region[i][0], `第 ${i} 条边的横向长度不变`);
    near(moved[j][1] - moved[i][1], region[j][1] - region[i][1], `第 ${i} 条边的纵向长度不变`);
  }
});

await test('空顶点数组不炸（新建了区域又立刻删掉的情形）', () => {
  assert.deepEqual(G.clampShift([], 1, 1), [0, 0]);
});

/* ------------------------------ 边缘命中 ------------------------------ */
group('边缘命中（屏幕像素）');

const screen = G.pointsToScreen(square, BOX.w, BOX.h);

await test('归一化 → 像素换算', () => {
  assert.deepEqual(screen[2], [400, 300], '右下角');
  assert.deepEqual(G.pointsToScreen([[0.5, 0.5]], 400, 300), [[200, 150]], '中心');
});

await test('点在右边附近：命中的是右边，t 是投影位置', () => {
  const hit = G.nearestEdge(screen, 405, 150, 8);
  assert.ok(hit, '应当命中');
  assert.equal(hit.index, 1, '第 1 条边 = 右边');
  near(hit.t, 0.5, '投影在边的中间');
  near(hit.dist, 5, '距离 5px');
  assert.deepEqual(G.hitPoint(square, hit), [1, 0.5], '落点在归一化空间的右边中点');
});

await test('点在最后一条边（左）附近：索引是 3，插入会在末尾追加', () => {
  const hit = G.nearestEdge(screen, 2, 150, 8);
  assert.ok(hit);
  assert.equal(hit.index, 3, '最后一条边绕回起点');
  const next = G.insertOnEdge(square, hit);
  assert.equal(next.length, 5, '顶点数 +1');
  near(next[4][0], 0, '新顶点追加在末尾');
  near(next[4][1], 0.5, '位置在左边中点');
  assert.equal(square.length, 4, '原数组不能被改动');
});

await test('点在中间那条边附近：插在边的起点之后（不是追加到末尾）', () => {
  const hit = G.nearestEdge(screen, 300, 305, 8);
  assert.ok(hit);
  assert.equal(hit.index, 2, '第 2 条边 = 下边');
  const next = G.insertOnEdge(square, hit);
  assert.equal(next.length, 5);
  near(next[3][0], 0.75, '新顶点插在下边起点之后');
  near(next[3][1], 1, '落点仍在下边上');
  assert.deepEqual(next[4], [0, 1], '原来的第 3 个顶点被挤到后面，顺序不乱');
});

await test('离所有边都超过阈值：不命中（改选中而不是加顶点）', () => {
  assert.equal(G.nearestEdge(screen, 200, 150, 8), null, '区域正中间');
  assert.equal(G.nearestEdge(screen, 409, 150, 8), null, '右边外侧 9px');
});

await test('顶点少于 3 个、或退化线段：不抛错也不产生 NaN', () => {
  assert.equal(G.nearestEdge([[0, 0], [10, 10]], 5, 5, 8), null, '两点不成面');
  const seg = G.pointSegDistance(5, 5, 0, 0, 0, 0);
  near(seg.dist, Math.hypot(5, 5), '退化成点时按点到点算');
  assert.ok(Number.isFinite(seg.t), 't 不能是 NaN');
});

await test('端点外侧：投影参数夹在 0~1，距离按端点算', () => {
  const beyond = G.pointSegDistance(-10, 0, 0, 0, 100, 0);
  near(beyond.t, 0, '投影夹到起点');
  near(beyond.dist, 10, '距离按起点算');
});

/* ------------------------------ 顶点增删 ------------------------------ */
group('顶点增删');

await test('插入顶点返回新数组，不改动原数据（store 靠这个对比更新）', () => {
  const before = square.map((p) => [...p]);
  const next = G.insertVertex(square, { index: 0, t: 0.5, dist: 0 }, [0.5, 0]);
  assert.equal(next.length, 5);
  assert.deepEqual(square, before, '原数组逐点不变');
  assert.deepEqual(next[1], [0.5, 0], '插在第 0 条边的起点之后');
});

await test('连续加两个顶点：顺序保持，仍是简单多边形（不自交）', () => {
  const a = G.insertOnEdge(square, G.nearestEdge(screen, 200, -3, 8));
  const b = G.insertOnEdge(a, G.nearestEdge(G.pointsToScreen(a, BOX.w, BOX.h), 403, 150, 8));
  assert.equal(b.length, 6);
  near(b[1][0], 0.5, '第一个新点插在上边中点（第 1 位，不是末尾）');
  near(b[1][1], 0, '第一个新点仍在上边上');
  near(b[3][0], 1, '第二个新点在右边上');
  near(b[3][1], 0.5, '第二个新点插在右边中点（第 3 位）');
  // 相邻顶点之间不能出现「跨过其它顶点」的边：用有向面积符号一致性粗验
  const area = b.reduce((sum, [x, y], i) => {
    const [nx, ny] = b[(i + 1) % b.length];
    return sum + (x * ny - nx * y);
  }, 0);
  assert.ok(Math.abs(area) > 0.5, `多边形面积不该塌掉（实际 ${area}）`);
});

finish('地图第三轮交互数学');
