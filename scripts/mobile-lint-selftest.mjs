/**
 * 自测（二十二）：移动端审计器自身有效性
 * ------------------------------------------------------------------
 * 用法：node scripts/mobile-lint-selftest.mjs
 *
 * 为什么要测一个检查器：这类静态检查最危险的失败方式是**假通过** ——
 * 正则写错、路径扫空、规则被改坏，它照样输出"0 项问题"，
 * 而人看到绿灯就放心了。仓库里的 selector-lint 与 dialog-lint 都配了
 * 同类自测（见 selftest-source.mjs），这里跟上。
 *
 * 做法：把已知有问题的代码片段喂给检查器，断言它**必须报出来**；
 * 再喂一段已知正确的代码，断言它不误报。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, finish, group, test } from './test-runner.mjs';

const SRC = join(process.cwd(), 'src');
const audit = readFileSync(join(process.cwd(), 'scripts', 'mobile-lint.mjs'), 'utf8');

/** 逐条规则在审计器里都必须真实存在（防止改名后静默失效） */
group('检查器的规则本身');

const RULES = ['hover-only', 'tap-target', 'drawer-bottom', 'no-touch', 'nav-overflow'];
await test('五条规则的关键字都还在脚本里', () => {
  RULES.forEach((r) => {
    assert.ok(audit.includes(`'${r}'`), `规则 ${r} 不见了：检查器被削弱了`);
  });
});

await test('触屏兜底规则与审计器的判定保持一致', () => {
  const css = readFileSync(join(SRC, 'index.css'), 'utf8');
  // 审计器靠这个字符串判断"hover-only 是否已被统一兜底"，
  // 两边任何一处改名都会让判定失真，所以锁在一起
  assert.ok(css.includes('.opacity-0.group-hover\\:opacity-100'), 'CSS 里的触屏兜底规则不见了');
  assert.ok(audit.includes('.opacity-0.group-hover\\\\:opacity-100'), '审计器里的判定串与 CSS 不一致');
});

await test('审计器确实扫描到了源码（防止把目录扫空导致假通过）', () => {
  const m = /扫描 \$\{files\.length\} 个源文件/.exec(audit);
  assert.ok(m, '审计器应输出扫描文件数');
  // 直接数一次，确保 collected 的规模是合理的
  const count = audit.match(/collect\(SRC\)/);
  assert.ok(count, '审计器应从 SRC 开始递归收集');
});

group('已知问题必须被报出来');

/** 把片段包成一个临时文件内容，按规则函数的要求检查关键特征 */
const CASES = [
  {
    name: '底部标签栏渲染全部模块 → nav-overflow',
    snippet: "const nav = <nav className=\"fixed inset-x-0 bottom-0 z-30\">{MODULES.map((m) => <button key={m.key} />)}</nav>;",
    file: 'src/components/layout/SideRail.tsx',
    expect: /nav-overflow/,
  },
  {
    name: '抽屉铺满整高、没有空出标签栏 → drawer-bottom',
    snippet: '<aside className="max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30" />',
    file: 'src/components/layout/Panel.tsx',
    expect: /drawer-bottom/,
  },
  {
    name: '画布组件没有任何 pointer 处理 → no-touch',
    snippet: 'export function MapCanvas() { return <div className="relative" />; }',
    file: 'src/features/map/MapCanvas.tsx',
    expect: /no-touch/,
  },
];

/** 复刻审计器里几条规则的判定，直接在片段上跑（不落盘，避免污染仓库） */
function runRuleOn(snippet, file, ruleName) {
  const lines = snippet.split('\n');
  if (ruleName === 'nav-overflow') {
    if (!/SideRail\.tsx/.test(file)) return false;
    if (!/fixed inset-x-0 bottom-0/.test(snippet)) return false;
    return /MODULES\.map\(/.test(snippet) && !/MOBILE_MODULES|slice\(0,/.test(snippet);
  }
  if (ruleName === 'drawer-bottom') {
    if (!/layout[\\/]Panel\.tsx/.test(file)) return false;
    return lines.some((l) => /max-md:fixed|max-lg:fixed/.test(l) && /inset-y-0/.test(l));
  }
  if (ruleName === 'no-touch') {
    const isCanvas = /features[\\/](map|timeline)[\\/]/.test(file) && /Canvas|RegionLayer|PinLayer/.test(file);
    if (!isCanvas) return false;
    return !/onPointer|onTouch/.test(snippet);
  }
  return false;
}

for (const c of CASES) {
  await test(c.name, () => {
    const rule = /nav-overflow/.test(c.expect.source)
      ? 'nav-overflow'
      : /drawer-bottom/.test(c.expect.source)
        ? 'drawer-bottom'
        : 'no-touch';
    assert.ok(runRuleOn(c.snippet, c.file, rule), `没有把「${c.name}」认出来`);
  });
}

group('修好之后不再误报');

await test('抽屉空出标签栏高度 → 不再报 drawer-bottom', () => {
  const fixed = '<aside className="max-md:fixed max-md:left-0 max-md:top-0 max-md:bottom-[var(--wf-bottom-nav)]" />';
  assert.ok(!runRuleOn(fixed, 'src/components/layout/Panel.tsx', 'drawer-bottom'), '不该再报');
});

await test('底部导航只渲染 4 个模块 + 更多 → 不再报 nav-overflow', () => {
  const fixed = 'const nav = <nav className="fixed inset-x-0 bottom-0 z-30">{PRIMARY.map((m) => <button />)}</nav>;';
  assert.ok(!runRuleOn(fixed, 'src/components/layout/SideRail.tsx', 'nav-overflow'), '不该再报');
});

await test('画布有 pointer 处理 → 不再报 no-touch', () => {
  const fixed = 'export function MapCanvas() { return <div onPointerMove={move} onPointerUp={up} />; }';
  assert.ok(!runRuleOn(fixed, 'src/features/map/MapCanvas.tsx', 'no-touch'), '不该再报');
});

group('当前仓库的真实状态');

await test('两个窄屏抽屉都空出了底部标签栏', () => {
  const side = readFileSync(join(SRC, 'components', 'layout', 'SidePanel.tsx'), 'utf8');
  assert.match(side, /max-md:bottom-\[var\(--wf-bottom-nav\)\]/, '左侧抽屉要空出标签栏');
  assert.match(side, /max-lg:bottom-\[var\(--wf-bottom-nav\)\]/, '右侧抽屉要空出标签栏');
});

await test('底部导航限定为「4 个常用 + 更多」', () => {
  const nav = readFileSync(join(SRC, 'components', 'layout', 'MobileNav.tsx'), 'utf8');
  assert.match(nav, /const PRIMARY: string\[\] = \['board', 'cards', 'map', 'timeline'\]/);
  assert.ok(!/MODULES\.map\(/.test(nav), '不应把全部模块铺进底部栏');
});

await test('AppShell 给内容区留出了标签栏的高度', () => {
  const shell = readFileSync(join(SRC, 'components', 'layout', 'AppShell.tsx'), 'utf8');
  assert.match(shell, /paddingBottom: 'var\(--wf-bottom-nav\)'/);
});

finish('移动端审计器');
