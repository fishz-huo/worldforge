/**
 * 自测（六）：源码静态检查
 * ------------------------------------------------------------------
 * 用法：node scripts/selftest-source.mjs
 *
 * 这些规则 typecheck / 构建 / 运行时测试都管不到，但违反代价很高：
 *   1. zustand selector 里写 .filter() → 无限重渲染 → 整个应用白屏；
 *   2. 单个源码文件超过 200 行 → 违反「清晰易读」的代码规范。
 * 检查器本身先用真实样本验证有效性，再扫描全量源码要求零违规。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, finish, group, test } from './test-runner.mjs';
import { lintSelectorSource } from './selector-lint.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 违规样本：必须被检出（前两条是真实发生过的白屏 bug） */
const BAD = [
  ['MapOverview 白屏 bug 原文', `const regions = useStore((s) => s.regions.filter((r) => r.map_id === mapId));`],
  ['BoardPanels 白屏 bug 原文', `const cards = useStore((s) => s.cards.filter((c) => c.type === 'lore'));`],
  ['跨行书写的 selector', `const regions = useStore(\n  (s) => s.regions.filter((r) => r.map_id === mapId),\n);`],
  ['返回对象字面量', `const x = useStore((s) => ({ a: s.a, b: s.b }));`],
  ['slice 拷贝', `const x = useStore((s) => s.list.slice(0, 3));`],
  ['数组展开', `const x = useStore((s) => [...s.a, ...s.b]);`],
  ['兜底空数组', `const x = useStore((s) => s.list || []);`],
  ['就地排序', `const x = useStore((s) => s.list.sort());`],
  ['聚合计算', `const x = useStore((s) => s.list.reduce((a, b) => a + b, 0));`],
  ['new Set', `const x = useStore((s) => new Set(s.ids));`],
];

/** 安全样本：不得被误报 */
const GOOD = [
  ['直接取字段', `const cards = useStore((s) => s.cards);`],
  ['find 返回既有引用', `const card = useStore((s) => s.cards.find((c) => c.id === cardId));`],
  ['可选链 + 兜底原始值', `const unit = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId)?.meta?.time?.unit ?? '年');`],
  ['布尔比较', `const selected = useStore((s) => s.selectedCardId === cardId);`],
  ['条件返回既有引用', `const card = useStore((s) => (node.card_id ? s.cards.find((c) => c.id === node.card_id) : undefined));`],
  ['some 返回布尔', `const exists = useStore((s) => (s.selectedCardId ? s.cards.some((c) => c.id === s.selectedCardId) : false));`],
  ['显式传 useShallow 比较器', `const x = useStore((s) => s.list.filter(Boolean), useShallow);`],
  ['显式传 shallow 比较器', `const x = useStore((s) => s.list.slice(0, 3), shallow);`],
  ['传外部函数引用（本文件无法分析）', `const x = useStore(selectVisibleCards);`],
  ['注释里出现的反例不该误判', `const x = useStore((s) =>\n  // 千万别写 s.cards.filter(...)\n  s.cards,\n);`],
];

group('selector 检查器自身有效性');

for (const [name, code] of BAD) {
  await test(`能检出：${name}`, () => {
    const found = lintSelectorSource(code);
    assert.equal(found.length, 1, `期望检出 1 处，实际 ${found.length} 处`);
    assert.ok(found[0].reasons.length > 0, '应当给出违规原因');
  });
}

for (const [name, code] of GOOD) {
  await test(`不误报：${name}`, () => {
    const found = lintSelectorSource(code);
    assert.equal(found.length, 0, `不该报违规，却报了：${JSON.stringify(found)}`);
  });
}

/** 递归收集源码文件（跳过依赖与构建产物目录） */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'src-tauri', '.git']);
function collect(dir, out = []) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(item.name)) continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) collect(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(item.name)) out.push(full);
  }
  return out;
}

/**
 * 可靠的行数统计。
 * ⚠️ 不要用 PowerShell 的 `Get-Content` 或 `Measure-Object -Line`：
 * PS 5.1 读取无 BOM 的 UTF-8 文件时按 ANSI 解码，中文注释多的文件行数会偏少，
 * 曾把一个 201 行的文件误判成 184 行，导致超长文件被漏掉。
 */
function countLines(file) {
  const text = readFileSync(file, 'utf8');
  const segments = text.split('\n').length;
  return text.endsWith('\n') ? segments - 1 : segments;
}

const allFiles = collect(ROOT);
const srcFiles = allFiles.filter((f) => f.startsWith(join(ROOT, 'src')));

group('全量源码扫描');

const violations = [];
for (const file of srcFiles) {
  const src = readFileSync(file, 'utf8');
  for (const hit of lintSelectorSource(src)) {
    violations.push({ file: relative(ROOT, file), ...hit });
  }
}

await test(`扫描 ${srcFiles.length} 个源文件，useStore selector 零违规`, () => {
  const detail = violations
    .map((v) => `\n    ${v.file}:${v.line}\n      ${v.text}\n      → ${v.reasons.join('；')}`)
    .join('');
  assert.equal(violations.length, 0, `发现 ${violations.length} 处违规 selector：${detail}`);
});

await test('扫描确实作用到了源码（防止把目录扫空导致假通过）', () => {
  assert.ok(srcFiles.length > 100, `只扫到 ${srcFiles.length} 个文件，路径可能不对`);
  const withStore = srcFiles.filter((f) => readFileSync(f, 'utf8').includes('useStore('));
  assert.ok(withStore.length > 20, `只扫到 ${withStore.length} 个使用 useStore 的文件，检查器可能失效`);
});

const tooLong = allFiles
  .map((f) => ({ file: relative(ROOT, f), lines: countLines(f) }))
  .filter((x) => x.lines > 200)
  .sort((a, b) => b.lines - a.lines);

await test(`全部 ${allFiles.length} 个源码文件均不超过 200 行`, () => {
  const detail = tooLong.map((x) => `\n    ${x.file} — ${x.lines} 行`).join('');
  assert.equal(tooLong.length, 0, `有 ${tooLong.length} 个文件超长：${detail}`);
});

await test('行数统计本身可信（能算出已知长度文件的行数）', () => {
  const self = fileURLToPath(import.meta.url);
  assert.equal(countLines(self), readFileSync(self, 'utf8').split('\n').length - 1);
  assert.ok(countLines(self) > 50, '本文件本身应有不少行，统计结果偏小说明方法有问题');
});

finish('源码静态检查');
