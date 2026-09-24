/**
 * 自测（十七）：界面布局偏好
 * ------------------------------------------------------------------
 * 用法：node scripts/layout-selftest.mjs
 *
 * 为什么这几行纯函数值得单独测：
 * 面板宽度与界面缩放都落在 localStorage 里，而 localStorage 是**用户可以手改**
 * 的地方（也可能是旧版本、别的分支写脏的）。一旦宽度被写成 0、缩放被写成 0，
 * 界面会直接看不见面板或整片空白 —— 而「设置」也在那个空白界面里，
 * 用户自己修不回来。所以入口的钳制与档位校验必须锁死。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

register('./alias-hook.mjs', import.meta.url);

/**
 * 最小 localStorage 桩。
 * prefs.ts 只在函数里访问 localStorage，模块顶层不碰，所以在这里装即可。
 */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
// 必须先清空：下面 import 的 store 会在模块初始化时调用 loadPrefs()，
// 带着上一轮的脏数据进模块会污染断言。
localStorage.clear();

const { clampWidth, DEFAULT_PREFS, loadPrefs, savePrefs, sanitizePrefs, UI_SCALE_OPTIONS, WIDTH_LIMITS } =
  await import('@/store/prefs.ts');
const { SIDEBAR_LIMITS, INSPECTOR_LIMITS } = await import('@/lib/layout-sync.ts');

const KEY = 'worldforge.prefs';
/** 写一份「脏」偏好，模拟旧版本或用户手改的结果 */
const writeRaw = (obj) => localStorage.setItem(KEY, JSON.stringify(obj));

group('宽度钳制');

await test('正常值原样通过（保留两位小数，避免拖拽产生 16.003333）', () => {
  assert.equal(clampWidth(16, WIDTH_LIMITS.sidebar), 16);
  assert.equal(clampWidth(16.0033, WIDTH_LIMITS.sidebar), 16);
  assert.equal(clampWidth(16.126, WIDTH_LIMITS.sidebar), 16.13);
  assert.equal(clampWidth(20, WIDTH_LIMITS.inspector), 20);
});

await test('越界值被夹到极限，而不是被丢弃', () => {
  assert.equal(clampWidth(0, WIDTH_LIMITS.sidebar), WIDTH_LIMITS.sidebar.min);
  assert.equal(clampWidth(-5, WIDTH_LIMITS.sidebar), WIDTH_LIMITS.sidebar.min);
  assert.equal(clampWidth(999, WIDTH_LIMITS.inspector), WIDTH_LIMITS.inspector.max);
});

await test('非数字：Infinity 夹到上限，NaN 回落下限，绝不写出 NaNrem', () => {
  assert.equal(clampWidth(NaN, WIDTH_LIMITS.sidebar), WIDTH_LIMITS.sidebar.min);
  assert.equal(clampWidth(Infinity, WIDTH_LIMITS.sidebar), WIDTH_LIMITS.sidebar.max);
  assert.equal(clampWidth(-Infinity, WIDTH_LIMITS.sidebar), WIDTH_LIMITS.sidebar.min);
  assert.ok(Number.isFinite(clampWidth(Number('abc'), WIDTH_LIMITS.inspector)));
});

group('偏好净化');

await test('脏数据：宽度 0、缩放 0.01 都被修回合法值', () => {
  const fixed = sanitizePrefs({ ...DEFAULT_PREFS, sidebarWidth: 0, inspectorWidth: 999, uiScale: 0.01 });
  assert.equal(fixed.sidebarWidth, WIDTH_LIMITS.sidebar.min);
  assert.equal(fixed.inspectorWidth, WIDTH_LIMITS.inspector.max);
  assert.equal(fixed.uiScale, DEFAULT_PREFS.uiScale, '非法档位必须回落到默认档');
});

await test('四个合法档位都被接受', () => {
  for (const opt of UI_SCALE_OPTIONS) {
    assert.equal(sanitizePrefs({ ...DEFAULT_PREFS, uiScale: opt.value }).uiScale, opt.value);
  }
});

await test('loadPrefs 读脏数据不抛错，且结果永远合法', () => {
  writeRaw({ sidebarWidth: 'x', inspectorWidth: null, uiScale: 2.5, theme: 'light' });
  const prefs = loadPrefs();
  assert.equal(prefs.theme, 'light', '合法字段应被保留');
  assert.equal(prefs.sidebarWidth, WIDTH_LIMITS.sidebar.min);
  assert.equal(prefs.inspectorWidth, WIDTH_LIMITS.inspector.min);
  assert.equal(prefs.uiScale, DEFAULT_PREFS.uiScale);
});

await test('loadPrefs 遇到坏 JSON 回落默认值', () => {
  localStorage.setItem(KEY, '{不是 JSON');
  assert.deepEqual(loadPrefs(), DEFAULT_PREFS);
});

await test('savePrefs 合并部分字段，且写出去的也是合法值', () => {
  localStorage.clear();
  savePrefs({ sidebarWidth: 22 });
  savePrefs({ inspectorWidth: 999 });
  const saved = JSON.parse(localStorage.getItem(KEY));
  assert.equal(saved.sidebarWidth, 22, '先写的宽度不能被后一次写入冲掉');
  assert.equal(saved.inspectorWidth, WIDTH_LIMITS.inspector.max, '越界值写盘前就被夹住');
});

group('默认值与旧界面一致');

await test('默认宽度等于改造前的硬编码 w-64 / w-80（老用户升级不跳变）', () => {
  assert.equal(DEFAULT_PREFS.sidebarWidth, 16, 'w-64 = 16rem');
  assert.equal(DEFAULT_PREFS.inspectorWidth, 20, 'w-80 = 20rem');
  assert.equal(DEFAULT_PREFS.uiScale, 1);
});

await test('CSS 兜底默认值与 JS 默认值一致（两处写错会首帧闪一下）', () => {
  const css = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8');
  assert.match(css, /--wf-sidebar-w:\s*16rem/, 'index.css 的侧栏默认宽度应与 prefs 一致');
  assert.match(css, /--wf-inspector-w:\s*20rem/, 'index.css 的检查器默认宽度应与 prefs 一致');
  assert.match(css, /--wf-ui-scale:\s*1[,;)]/, 'index.css 的缩放默认值应为 1');
});

await test('layout-sync 转发的是 prefs 里的同一份极限值', () => {
  assert.deepEqual(SIDEBAR_LIMITS, WIDTH_LIMITS.sidebar);
  assert.deepEqual(INSPECTOR_LIMITS, WIDTH_LIMITS.inspector);
});

group('窗口收进屏幕的计算（1080p 缩放问题）');

const { computeWindowFit, fitWindowToScreen } = await import('@/lib/window-fit.ts');

await test('1080p 125% 缩放：1360×880 的窗口被收进 1536×816 的工作区', () => {
  // 宽 1360 <= 1536-16=1520 → 宽度不动；高 880 > 816-16=800 → 高度收到 800
  assert.deepEqual(computeWindowFit(1360, 880, 1536, 816), { width: 1360, height: 800 });
});

await test('1080p 150% 缩放：1280×800 收到 1264×656（两侧都要让出 16px）', () => {
  assert.deepEqual(computeWindowFit(1280, 800, 1280, 672), { width: 1264, height: 656 });
});

await test('屏幕够大就一个字都不动（默认窗口不放大、不改用户尺寸）', () => {
  assert.equal(computeWindowFit(1280, 800, 1920, 1040), null);
  assert.equal(computeWindowFit(900, 600, 1920, 1040), null);
  assert.equal(computeWindowFit(1280, 784, 1920, 800), null, '正好等于工作区减留白时不该动');
});

await test('屏幕小到离谱时也算不出 0 或负数（不能把窗口设没）', () => {
  const fit = computeWindowFit(1280, 800, 10, 10);
  assert.ok(fit && fit.width >= 1 && fit.height >= 1, `算出来是 ${JSON.stringify(fit)}`);
});

await test('浏览器/Node 环境里什么都不做（没有窗口可调）', async () => {
  assert.equal(await fitWindowToScreen(), false);
});

await test('tauri.conf.json 的默认与最小尺寸能放进 1024×700（用户点不到按钮的根因）', () => {
  const conf = JSON.parse(readFileSync(fileURLToPath(new URL('../src-tauri/tauri.conf.json', import.meta.url)), 'utf8'));
  const win = conf.app.windows[0];
  assert.ok(win.minWidth <= 1024, `minWidth=${win.minWidth} 大于 1024：小屏上缩不下去`);
  assert.ok(win.minHeight <= 700, `minHeight=${win.minHeight} 大于 700：小屏上缩不下去`);
  // 1080p@125% 的工作区约 1536×816：默认窗口必须放得下，否则启动就露不出底边
  assert.ok(win.width <= 1536 && win.height <= 816, `默认 ${win.width}×${win.height} 放不进 1536×816`);
});

await test('用户实机 1920×1080 @145%：工作区 1326×706，默认窗口要一次放得下', () => {
  /*
   * 这台机器的真实数字（用 DPI-unaware 的 PowerShell 量到）：
   *   Bounds 1326×746、WorkingArea 1326×706（任务栏 40px）。
   * 旧的默认 1360×880 两个方向都超屏 —— 这正是「有些按钮点不到」的根因。
   */
  const conf = JSON.parse(readFileSync(fileURLToPath(new URL('../src-tauri/tauri.conf.json', import.meta.url)), 'utf8'));
  const win = conf.app.windows[0];
  assert.ok(win.width <= 1326 - 16, `默认宽 ${win.width} 超过工作区 1326 减留白`);
  assert.ok(win.height <= 706 - 16, `默认高 ${win.height} 超过工作区 706 减留白`);
  assert.equal(computeWindowFit(win.width, win.height, 1326, 706), null, '默认尺寸应当不需要自适应去收');
  // 万一默认值被改大，自适应也要能收进屏幕
  assert.deepEqual(computeWindowFit(1360, 880, 1326, 706), { width: 1310, height: 690 });
  assert.deepEqual(computeWindowFit(1280, 800, 1326, 706), { width: 1280, height: 690 });
});

finish('界面布局偏好');
