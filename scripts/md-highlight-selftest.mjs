/**
 * 自测（三十三）：编辑器语法着色的解析
 * ------------------------------------------------------------------
 * 用法：node scripts/md-highlight-selftest.mjs
 *
 * 硬契约只有一条：**区间只切分，绝不增删字符** —— 字符数一变，折行点就变，
 * 叠在 textarea 上的渲染层立刻错位（表现为"字重影/光标飘"，很难归因到某个正则）。
 * 第二条：不该着色的地方别碰（行内代码、围栏块、双链、图片、表格、引用、分隔线）。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const { parseHighlight } = await import('@/lib/markdown/highlight.ts');

/** 把区间切出来的片段拼回去，必须与原文逐字相同（唯一的"零变化"证明） */
function rejoin(line) {
  let out = '';
  let cursor = 0;
  for (const t of line.tokens) {
    out += line.text.slice(cursor, t.start);
    out += line.text.slice(t.start, t.end);
    cursor = t.end;
  }
  return out + line.text.slice(cursor);
}

const SAMPLES = [
  '# 一级标题',
  '#没有空格不是标题',
  '####### 七个井号不是标题',
  '**加粗** 与 *斜体* 混排',
  '- 列表项 **要点** 与 *补充*',
  '1. 有序项',
  '   2. 缩进有序项 **粗**',
  '* 星号子弹',
  '   - 缩进子弹',
  '> 引用里的 **加粗**',
  '| 表头 | 另一列 |',
  '| --- | --- |',
  '普通段落，含 [[CHR-001|艾拉]] 双链与 ![图](asset:abc) 图片',
  '行内 `**代码里的加粗**` 不着色',
  '```js',
  'const a = "# 不是标题"; // **不是加粗**',
  '```',
  '***',
  '---',
  '没有闭合的 **加粗',
  '* 未闭合的斜体',
  '结尾有空格的加粗 **粗** ',
  '',
].join('\n');

group('硬契约：区间只切分，字符零变化');

await test('所有样例：区间切出来再拼回去 = 原文', () => {
  const lines = parseHighlight(SAMPLES);
  const raw = SAMPLES.split('\n');
  assert.equal(lines.length, raw.length, '行数必须与 split("\\n") 一致');
  lines.forEach((line, i) => {
    assert.equal(line.text, raw[i], `第 ${i + 1} 行文本被改动了`);
    assert.equal(rejoin(line), line.text, `第 ${i + 1} 行拼接后与原文不符：${line.text}`);
  });
});

await test('区间合法：0 <= start < end <= 行长，按 start 升序且互不重叠', () => {
  parseHighlight(SAMPLES).forEach((line, i) => {
    let prev = 0;
    line.tokens.forEach((t) => {
      assert.ok(t.start >= prev, `第 ${i + 1} 行区间重叠或未排序：${JSON.stringify(t)}`);
      assert.ok(t.start < t.end, `第 ${i + 1} 行空区间：${JSON.stringify(t)}`);
      assert.ok(t.end <= line.text.length, `第 ${i + 1} 行区间越界：${JSON.stringify(t)}`);
      prev = t.end;
    });
  });
});

group('四类语法');

await test('标题：整行一个 heading 区间（含 # 与空格）', () => {
  const [line] = parseHighlight('# 一级标题');
  assert.equal(line.kind, 'heading');
  assert.deepEqual(line.tokens, [{ start: 0, end: 6, kind: 'heading' }]);
});

await test('标题：# 后没有空格不算（与 renderMarkdown 口径一致）', () => {
  assert.equal(parseHighlight('#没有空格不是标题')[0].kind, 'plain');
  assert.equal(parseHighlight('####### 七个井号不是标题')[0].kind, 'plain');
  assert.equal(parseHighlight('###### 六级标题')[0].kind, 'heading');
});

await test('加粗与斜体：区间含两端的标记', () => {
  const [line] = parseHighlight('**加粗** 与 *斜体* 混排');
  assert.deepEqual(line.tokens, [
    { start: 0, end: 6, kind: 'bold' },
    { start: 9, end: 13, kind: 'italic' },
  ]);
});

await test('标记内侧是空格就不算强调（避免吃掉列表符号与分隔线）', () => {
  const [line] = parseHighlight('文字 * 空格 * 文字');
  assert.deepEqual(line.tokens, []);
});

await test('***组合按 ** 优先切一刀（已知简化，行为固定住）', () => {
  const [line] = parseHighlight('***x***');
  assert.deepEqual(line.tokens, [{ start: 0, end: 6, kind: 'bold' }]);
});

await test('列表：行首 * 是 marker，不会被当成斜体', () => {
  const [line] = parseHighlight('* 星号子弹');
  assert.equal(line.kind, 'ul');
  assert.deepEqual(line.tokens, [{ start: 0, end: 1, kind: 'marker' }]);
});

await test('列表：有序项 kind=ol，缩进项的 marker 起点跟着缩进', () => {
  const ordered = parseHighlight('1. 有序项')[0];
  assert.equal(ordered.kind, 'ol');
  assert.deepEqual(ordered.tokens, [{ start: 0, end: 2, kind: 'marker' }]);
  const nested = parseHighlight('   2. 缩进有序项 **粗**')[0];
  assert.equal(nested.tokens[0].start, 3, '缩进后 marker 从第 4 个字符开始');
  assert.equal(nested.tokens[1].kind, 'bold');
});

await test('列表：正文整体算列表行，符号与正文用两种颜色', () => {
  const [line] = parseHighlight('- 列表项 **要点** 与 *补充*');
  assert.equal(line.kind, 'ul');
  assert.equal(line.tokens[0].kind, 'marker');
  assert.deepEqual(
    line.tokens.slice(1).map((t) => t.kind),
    ['bold', 'italic'],
  );
});

group('不该着色的地方一律原样');

await test('行内代码整段跳过', () => {
  const [line] = parseHighlight('行内 `**代码里的加粗**` 不着色');
  assert.deepEqual(line.tokens, []);
  // 反引号没闭合时也不能把后面的 ** 吃掉
  const [dangling] = parseHighlight('没闭合的反引号 ` 后面 **粗**');
  assert.deepEqual(dangling.tokens, [{ start: 13, end: 18, kind: 'bold' }]);
});

await test('围栏代码块：连围栏行本身也不着色，块后恢复', () => {
  const lines = parseHighlight(['```js', '# 不是标题', '**不是加粗**', '```', '# 是标题'].join('\n'));
  lines.slice(0, 4).forEach((line, i) => {
    assert.deepEqual(line.tokens, [], `第 ${i + 1} 行在代码块里不该着色`);
  });
  assert.equal(lines[4].kind, 'heading', '围栏闭合后应恢复着色');
});

await test('围栏没闭合：其后全部不着色（与 textarea 里看到的一致）', () => {
  const lines = parseHighlight(['```', '# 不是标题'].join('\n'));
  assert.deepEqual(lines[1].tokens, []);
});

await test('双链、图片、表格、引用、分隔线都不着色', () => {
  const stripped = [
    '含 [[CHR-001|艾拉]] 与 ![图](asset:abc) 的段落',
    '| 表头 | 另一列 |',
    '> 引用里没有标记',
    '***',
    '---',
    '没有闭合的 **加粗',
    '未闭合的斜体 *后面没闭合',
  ];
  stripped.forEach((text) => {
    assert.deepEqual(parseHighlight(text)[0].tokens, [], `不该着色：${text}`);
  });
});

group('行结构契约（两层对齐的前提）');

await test('结尾换行会多出一行空行（textarea 也给它留高度）', () => {
  const lines = parseHighlight('一行\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[1].text, '');
  assert.deepEqual(lines[1].tokens, []);
});

await test('空文本是一行；连续空行逐行保留', () => {
  assert.equal(parseHighlight('').length, 1);
  const lines = parseHighlight('a\n\n\nb');
  assert.equal(lines.length, 4);
  assert.deepEqual(lines[1].tokens, []);
  assert.deepEqual(lines[2].tokens, []);
});

await test('CRLF 不会被当成两个换行（textarea 的 value 里也只按 \\n 分）', () => {
  const lines = parseHighlight('a\r\nb');
  assert.equal(lines.length, 2, '\\r\\n 只能算一个换行');
  assert.equal(lines[0].text, 'a\r', '\\r 留在行内，不额外多出一行');
  assert.equal(rejoin(lines[0]), lines[0].text);
});

finish('语法着色解析');
