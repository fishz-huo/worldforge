/**
 * 自测（三十六）：文稿标题同步（写作区顶部 ↔ 侧栏列表）
 * ------------------------------------------------------------------
 * 用法：node scripts/writer-title-selftest.mjs
 * 2026-10-16 的 P0：侧栏标题是 defaultValue（非受控，只在挂载时读一次）＋
 * onBlur 无条件把「自己显示的旧值」写回库 —— 于是「顶部改了标题，侧栏一失焦
 * 就把它改回去」。这里把修法焊死：
 *   ① 提交规则（trim / 空串不写 / 同值不写）—— 直接跑纯函数；
 *   ② 两侧共用同一个受控字段，写作区里不许再出现 defaultValue、
 *      也不许把 input 套在 button 里（那是「点行内空白就反写」的触发面）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const { normalizeTitle } = await import('@/features/writer/titleCommit.ts');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
/** 去掉注释，避免自己写的说明文字撞上守卫 */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

group('提交规则（normalizeTitle）');

await test('正常改名返回 trim 后的新标题', () => {
  assert.equal(normalizeTitle('第二章', '第一章'), '第二章');
  assert.equal(normalizeTitle('  第二章  ', '第一章'), '第二章');
});

await test('清空 / 只有空白 → null（一个字都不写，不会把标题清成空串）', () => {
  ['', ' ', '   ', '\n\t'].forEach((v) => assert.equal(normalizeTitle(v, '第一章'), null));
});

await test('与当前值相同 → null（无意义落库、也不会和另一侧互相回写）', () => {
  assert.equal(normalizeTitle('第一章', '第一章'), null);
  assert.equal(normalizeTitle('  第一章  ', '第一章'), null);
  assert.equal(normalizeTitle('第一章 ', ' 第一章'), null);
});

await test('只 trim 两端：标题中间的标点与空格不被吞', () => {
  assert.equal(normalizeTitle(' 第 一 章 ', '旧标题'), '第 一 章');
});

group('接线守卫（两侧共用同一个受控字段）');

await test('顶部标题与侧栏标题都用 DocTitleField', () => {
  ['src/features/writer/WriterModule.tsx', 'src/features/writer/WriterSidebar.tsx'].forEach((p) =>
    assert.ok(read(p).includes('<DocTitleField'), `${p} 没用共用的标题字段`),
  );
});

await test('标题字段是受控的：无 defaultValue，库里的值一变就同步进来', () => {
  // 注释里会提到 defaultValue（说明为什么不用它），所以守卫只看去掉注释后的代码
  const field = code('src/features/writer/DocTitleField.tsx');
  assert.ok(!field.includes('defaultValue'), '标题必须受控（defaultValue 只读一次＝P0 根因）');
  assert.ok(field.includes('value={draft}'), '输入框要绑本地草稿');
  assert.ok(field.includes('normalizeTitle(draft, value)'), '提交必须走 normalizeTitle');
  assert.ok(/useEffect\(\(\) => \{?\s*setDraft\(value\)/.test(field), '缺「外部改名 → 同步草稿」');
});

await test('写作区里没有 input 嵌在 button 内（否则点行内空白就反写）', () => {
  ['WriterSidebar.tsx', 'WriterModule.tsx', 'DocTitleField.tsx'].forEach((name) => {
    const src = code(`src/features/writer/${name}`);
    assert.ok(!/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<input\b/.test(src), `${name} 里 input 仍嵌在 button 内`);
  });
});

await test('侧栏不再自己 onBlur 写库，也不再出现 defaultValue', () => {
  const src = code('src/features/writer/WriterSidebar.tsx');
  assert.ok(!/onBlur=\{\(e\) => updateDoc/.test(src), '侧栏标题仍在自己 onBlur 里写库');
  assert.ok(!src.includes('defaultValue'), '侧栏标题必须受控');
});

finish('文稿标题同步');
