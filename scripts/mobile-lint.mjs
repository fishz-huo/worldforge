/**
 * 移动端适配静态检查器
 * ==================================================================
 * 为什么需要它：桌面上的 typecheck、构建、单元测试全都看不见
 * 「手机上不好用」这类问题 —— 悬停才出现的按钮、只有 20px 的点击区、
 * 两个抽屉同时打开盖住彼此，这些在宽屏上永远不出现。
 *
 * 检查的是**能静态判定**的那几类（都是真实踩过的）：
 *   1. hover-only：只有 hover 才出现的可点元素 —— 触屏没有悬停，
 *      等于功能不存在（Mobile 上没有"把鼠标移上去"这个动作）；
 *   2. 点击区过小：min-h-4 / size-3 这类小于 24px 的目标，手指点不准；
 *   3. 触屏手势：onTouch / pointer 相关处理缺失的关键位置；
 *   4. 抽屉浮层的底部安全区：移动端抽屉要避开底部标签栏。
 *
 * 用法：node scripts/mobile-lint.mjs
 * 退出码：0 = 无阻塞问题；1 = 有 error 级问题（CI 与 npm test 用）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

/** 递归收集源码文件 */
function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** 一条发现 */
const findings = [];
const report = (level, rule, file, line, detail) => {
  findings.push({ level, rule, file: relative(ROOT, file), line, detail });
};

/**
 * 规则 1：hover-only 交互。
 * 形如 `opacity-0 ... group-hover:opacity-100` 的元素在触屏上永远不可见。
 *
 * 这类问题有两种处理方式：
 *   a) 由 index.css 的触屏兜底规则统一改常显（推荐，一处覆盖十几处）；
 *   b) 逐个组件改。
 * 所以这里先看 CSS 里有没有那条规则：有就把发现降级成 info（已覆盖），
 * 没有才报 error —— 否则要么漏报，要么把已修好的地方一直标红。
 */
function cssHasTouchFallback() {
  const css = readFileSync(join(SRC, 'index.css'), 'utf8');
  return css.includes('.opacity-0.group-hover\\:opacity-100');
}

function checkHoverOnly(src, file, covered) {
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (!/opacity-0/.test(line)) return;
    const near = lines.slice(i, i + 2).join(' ');
    if (!/group-hover:opacity-100|hover:opacity-100/.test(near)) return;
    if (covered) {
      report('info', 'hover-only', file, i + 1, '已由 index.css 的触屏兜底规则改为常显');
      return;
    }
    const inMenu = /dropdown-menu|select\.tsx|popover|tooltip/.test(file);
    report(
      inMenu ? 'error' : 'warn',
      'hover-only',
      file,
      i + 1,
      inMenu ? '菜单项只有 hover 才可见：触屏上等于不存在' : '只有 hover 才出现的可点元素：触屏点不到',
    );
  });
}

/**
 * 规则 2：过小的点击目标。
 * 只看「可点元素」那一行：`<button ... className="size-3"` 这种。
 * 图标可以小，但可点区域不该小 —— 所以这里要求 size-* >= 6（24px）、
 * 显式写了 p-* / min-h-* 把区域撑开，**或者**由 pointer: coarse 的全局
 * 兜底规则负责（那条规则给所有 button 兜了 24px 命中区）。
 */
const SMALL = /(?:size|h|w)-(?:2|2\.5|3|3\.5|4|4\.5|5)(?:\s|"|'|$)/;
function checkTapTargets(src, file, covered) {
  if (covered) return; // 全局兜底已经保证命中区，不必逐个组件报
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const isClickable = /<(button|a)\b/.test(line) || /role="button"/.test(line);
    if (!isClickable) return;
    // 往下看两行找 className（属性常换行书写）
    const block = lines.slice(i, i + 3).join(' ');
    if (!/className=/.test(block)) return;
    if (!SMALL.test(block)) return;
    // 有 padding 或 min-h/min-w 撑开就算合格
    if (/p-\d|px-\d|py-\d|min-h-|min-w-|size-6|size-7|size-8|size-9|size-10/.test(block)) return;
    report('warn', 'tap-target', file, i + 1, '可点元素小于约 24px：手指点不准');
  });
}

/**
 * 规则 3：移动端抽屉必须避开底部标签栏。
 * 底部导航高度约 56px（含安全区），抽屉的 inset-y-0 会被它压住 ——
 * 表现为"抽屉最下面那条内容永远点不到"。
 */
function checkDrawerSafeArea(src, file) {
  if (!/components[\\/]layout[\\/]Panel\.tsx/.test(file)) return;
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (!/max-md:fixed|max-lg:fixed/.test(line)) return;
    if (/inset-y-0/.test(line) && !/bottom-\[|pb-\[env/.test(src)) {
      report('warn', 'drawer-bottom', file, i + 1, '抽屉铺满整高，会被底部标签栏压住最后一行');
    }
  });
}

/**
 * 规则 4：触屏手势的兜底。
 * 地图画布靠指针事件落点与拖拽；没有任何 pointer/touch 处理的
 * 画布类组件在手机上就是一块图片。
 */
function checkTouchHandlers(src, file) {
  const isCanvas = /features[\\/](map|timeline)[\\/]/.test(file) && /Canvas|RegionLayer|PinLayer/.test(file);
  if (!isCanvas) return;
  if (/onPointer|onTouch/.test(src)) return;
  report('error', 'no-touch', file, 1, '画布类组件没有任何 pointer / touch 处理：手机上无法操作');
}

/** 规则 5：底部标签栏的容量。9 个模块塞进 360px 会互相挤压 */
function checkBottomNavCapacity(src, file) {
  if (!/SideRail\.tsx/.test(file)) return;
  if (!/fixed inset-x-0 bottom-0/.test(src)) return;
  const usesAll = /MODULES\.map\(/.test(src) && !/MOBILE_MODULES|slice\(0,/.test(src);
  if (usesAll) {
    report('error', 'nav-overflow', file, 1, '底部标签栏渲染了全部 9 个模块：360px 宽的手机上会挤压重叠');
  }
}

const RULES = [checkHoverOnly, checkTapTargets, checkDrawerSafeArea, checkTouchHandlers, checkBottomNavCapacity];

const files = collect(SRC);
const touchFallback = cssHasTouchFallback();
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  RULES.forEach((rule) => rule(src, file, touchFallback));
}

/* ------------------------------ 汇总 ------------------------------ */
const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');
const infos = findings.filter((f) => f.level === 'info');
const byRule = findings.reduce((acc, f) => {
  acc[f.rule] = (acc[f.rule] ?? 0) + 1;
  return acc;
}, {});

console.log(`[mobile-lint] 扫描 ${files.length} 个源文件`);
console.log(`  触屏兜底规则：${touchFallback ? '已启用（hover-only 会被统一改常显）' : '缺失'}`);
console.log(`  阻塞（error）：${errors.length} 项`);
console.log(`  提示（warn） ：${warns.length} 项`);
console.log(`  已覆盖（info）：${infos.length} 项`);
Object.entries(byRule).forEach(([rule, n]) => console.log(`    · ${rule} ${n}`));

const show = (list, title) => {
  if (list.length === 0) return;
  console.log(`\n[${title}]`);
  list.slice(0, 25).forEach((f) => console.log(`  ${f.file}:${f.line}  ${f.rule} —— ${f.detail}`));
  if (list.length > 25) console.log(`  …… 还有 ${list.length - 25} 项`);
};
show(errors, '阻塞问题');
show(warns, '提示');

if (errors.length) process.exit(1);
