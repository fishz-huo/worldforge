/**
 * 自测（三十五）：大纲状态配色与形态守卫
 * ------------------------------------------------------------------
 * 用法：node scripts/outline-status-selftest.mjs
 * 色号是 2026-10-16 用户看图拍板的（构思 amber / 写作中 blue / 已完成 emerald /
 * 已废弃 slate + 删除线，暗色各配一档）。这里把它焊成 golden 表：以后改色必须
 * 同步改这张表，免得顺手一改就悄悄丢掉暗色档或跌破对比度。
 * 后半段是形态守卫：图例不回侧栏、顶部不再有节点计数、色块必须只包文字。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const { statusStyle, nextStatus, CHIP_BASE } = await import('@/features/outline/outlineStatus.ts');
const { OUTLINE_STATUS } = await import('@/types');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** golden：状态 → 亮 / 暗两组类名（改这里＝改配色决策） */
const GOLDEN = {
  idea: { light: 'bg-amber-100 text-amber-900 ring-amber-300', dark: 'dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800' },
  draft: { light: 'bg-blue-100 text-blue-900 ring-blue-300', dark: 'dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800' },
  done: { light: 'bg-emerald-100 text-emerald-900 ring-emerald-300', dark: 'dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800' },
  cut: { light: 'bg-slate-100 text-slate-600 ring-slate-300', dark: 'dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600' },
};

group('色号 golden（亮暗两套逐字对齐）');

await test('四个状态的亮 / 暗色号与拍板值逐字一致', () => {
  OUTLINE_STATUS.forEach((s) => {
    const chip = statusStyle(s.status).chip;
    assert.ok(chip.includes(GOLDEN[s.status].light), `${s.label} 亮色不符：${chip}`);
    assert.ok(chip.includes(GOLDEN[s.status].dark), `${s.label} 暗色不符：${chip}`);
  });
});

await test('色块外壳：底色只包文字（box-decoration-clone）+ 1px 内描边', () => {
  assert.ok(CHIP_BASE.includes('box-decoration-clone'), '底色必须只覆盖文字');
  assert.ok(CHIP_BASE.includes('ring-1') && CHIP_BASE.includes('ring-inset'), '必须有 1px 内描边');
  OUTLINE_STATUS.forEach((s) => assert.ok(statusStyle(s.status).chip.startsWith(CHIP_BASE)));
});

await test('只有「已废弃」带删除线，其余三个状态不许有', () => {
  OUTLINE_STATUS.forEach((s) => {
    assert.equal(statusStyle(s.status).chip.includes('line-through'), s.status === 'cut', `${s.label} 的删除线不对`);
  });
});

await test('四个状态都有色点，且亮暗成对', () => {
  OUTLINE_STATUS.forEach((s) => {
    const dot = statusStyle(s.status).dot;
    assert.ok(/bg-\w+-\d00/.test(dot), `${s.label} 缺色点：${dot}`);
    assert.ok(dot.includes('dark:'), `${s.label} 色点缺暗色档`);
  });
});

group('回落与循环');

await test('未知 / 缺失状态回落到第一个（构思），老数据不会没有底色', () => {
  ['', undefined, 'nope'].forEach((v) => {
    assert.equal(statusStyle(v).status, OUTLINE_STATUS[0].status);
    assert.ok(statusStyle(v).chip.includes('bg-amber-100'));
  });
});

await test('点色点按 OUTLINE_STATUS 顺序循环，转一圈回到起点', () => {
  assert.equal(nextStatus(OUTLINE_STATUS[0].status), OUTLINE_STATUS[1].status);
  let cur = OUTLINE_STATUS[0].status;
  for (let i = 0; i < OUTLINE_STATUS.length; i++) cur = nextStatus(cur);
  assert.equal(cur, OUTLINE_STATUS[0].status);
});

group('文案与形态守卫');

await test('文案只有一处真相源：statusStyle 的 label 来自 types 的 OUTLINE_STATUS', () => {
  OUTLINE_STATUS.forEach((s) => assert.equal(statusStyle(s.status).label, s.label));
});

await test('色号只在 outlineStatus 一处定义，组件里不写 hex、不自己拼色名', () => {
  [
    'src/features/outline/OutlineStatusChip.tsx',
    'src/features/outline/OutlineLegend.tsx',
    'src/features/outline/OutlineTreeTitle.tsx',
  ].forEach((p) => {
    const src = read(p);
    assert.ok(!/#[0-9a-fA-F]{6}/.test(src), `${p} 里出现了 inline hex`);
    assert.ok(!/bg-(amber|blue|emerald|slate)-/.test(src), `${p} 里自己拼了色号`);
  });
});

await test('侧栏不再有「状态图例」，顶部不再有「N 个节点」，默认视图＝纯文本', () => {
  assert.ok(!read('src/features/outline/OutlineSidebar.tsx').includes('状态图例'));
  const mod = read('src/features/outline/OutlineModule.tsx');
  assert.ok(!mod.includes('个节点'), '顶部计数应已删除');
  assert.ok(mod.includes("useState<OutlineView>('text')"), '默认视图必须是纯文本');
});

await test('标题色块只经 OutlineStatusChip 渲染，且不再用旧的内联 color', () => {
  ['src/features/outline/OutlineTree.tsx', 'src/features/outline/OutlineTreeTitle.tsx', 'src/features/outline/OutlineMindmap.tsx']
    .forEach((p) => assert.ok(!read(p).includes('status.color'), `${p} 还在用旧的 inline color`));
  ['src/features/outline/OutlineTreeTitle.tsx', 'src/features/outline/OutlineMindmap.tsx']
    .forEach((p) => assert.ok(read(p).includes('OutlineStatusChip'), `${p} 没用色块组件`));
  assert.ok(read('src/features/outline/OutlineTree.tsx').includes('OutlineTreeTitle'), '树的标题要走可编辑组件');
});

finish('大纲状态配色');
