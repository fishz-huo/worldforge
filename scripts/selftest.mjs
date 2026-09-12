/**
 * 核心逻辑自测（一）：Markdown 解析与差异算法
 * ------------------------------------------------------------------
 * 用法：node scripts/selftest.mjs
 * 这些模块是纯函数、不依赖浏览器，但一旦写错就会静默出错，
 * 所以必须覆盖：HTML 转义防注入、协议白名单、双链、自动关联、行级 diff。
 * 模型层（查询 / 大纲 / 时间轴 / 示例数据）见 selftest-model.mjs。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const { renderMarkdown, stripMarkdown, countWords } = await import('@/lib/markdown/index.ts');
const { diffLines, diffStats } = await import('@/lib/diff.ts');
const { diffSnapshots } = await import('@/lib/snapshot-diff.ts');

group('Markdown 解析');

await test('标题 / 列表 / 引用 / 代码块', () => {
  const html = renderMarkdown('# 标题\n\n- a\n- b\n\n> 引用\n\n```js\nconst x = 1;\n```');
  assert.match(html, /<h1[^>]*>标题<\/h1>/);
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<pre><code data-lang="js">/);
});

await test('嵌套列表', () => {
  const html = renderMarkdown('- 一级\n  - 二级\n- 另一个一级');
  assert.match(html, /<ul><li>一级<ul><li>二级<\/li><\/ul><\/li><li>另一个一级<\/li><\/ul>/);
});

await test('表格', () => {
  const html = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');
  assert.match(html, /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead>/);
  assert.match(html, /<td>1<\/td>/);
});

await test('原始 HTML 被转义（防注入）', () => {
  const html = renderMarkdown('<script>alert(1)</script>');
  assert.ok(!html.includes('<script>'), '不应输出可执行脚本标签');
  assert.match(html, /&lt;script&gt;/);
});

await test('外链协议白名单', () => {
  const html = renderMarkdown('[点我](javascript:alert(1))');
  assert.ok(!html.includes('javascript:'), '危险协议应被丢弃');
});

await test('双链 [[标题]] 解析为可悬停预览的 span', () => {
  const index = new Map([['灵息', { id: 'c1', title: '灵息' }]]);
  const html = renderMarkdown('这里提到 [[灵息]] 与 [[不存在]]', { index });
  assert.match(html, /data-wiki-id="c1"/);
  assert.match(html, /class="wiki-link is-missing"/);
});

await test('正文出现卡片标题时自动关联', () => {
  const index = new Map([['焚天城', { id: 'c2', title: '焚天城' }]]);
  const html = renderMarkdown('他抬头望向焚天城的方向', { index });
  assert.match(html, /data-wiki-id="c2"/);
});

await test('自动关联不会污染代码块内部', () => {
  const index = new Map([['焚天城', { id: 'c2', title: '焚天城' }]]);
  const html = renderMarkdown('```\n焚天城\n```', { index });
  assert.ok(!html.includes('data-wiki-id'), '代码块内不应插入链接');
});

await test('纯文本抽取与字数统计', () => {
  assert.equal(stripMarkdown('# 标题\n\n**加粗** 与 [[灵息|它]]'), '标题 加粗 与 它');
  assert.equal(countWords('你好世界 hello world'), 4 + 2);
});

group('文本与快照 diff');

await test('行级差异统计', () => {
  const lines = diffLines('a\nb\nc', 'a\nB\nc');
  const stats = diffStats(lines);
  assert.equal(stats.added, 1);
  assert.equal(stats.removed, 1);
  assert.equal(stats.same, 2);
});

await test('超长文本退化为公共前后缀 + 整块替换（不卡死）', () => {
  const base = Array.from({ length: 3000 }, (_, i) => `line ${i}`);
  const before = base.join('\n');
  const after = [...base.slice(0, 2000), '新增一行', ...base.slice(2000)].join('\n');
  const stats = diffStats(diffLines(before, after));
  assert.equal(stats.added, 1, '应稳定输出 1 行新增');
});

await test('快照结构差异：新增 / 删除 / 修改', () => {
  const card = (id, title, body) => ({
    id, title, body, type: 'note', fields: {}, summary: '', subtitle: '',
    cover_asset: null, branch_id: null, pinned: 0,
  });
  const empty = {
    cards: [], tags: [], relations: [], maps: [], pins: [], regions: [],
    tracks: [], entries: [], eras: [], docs: [], outlineNodes: [], branches: [],
  };
  const before = { ...empty, cards: [card('a', 'A', 'x'), card('b', 'B', 'y')], tags: [{ id: 't1', name: '旧' }] };
  const after = { ...empty, cards: [card('a', 'A', 'x2'), card('c', 'C', 'z')], tags: [{ id: 't2', name: '新' }] };

  const diff = diffSnapshots(before, after);
  assert.equal(diff.cards.added.length, 1, '应检出 1 张新增卡片');
  assert.equal(diff.cards.removed.length, 1, '应检出 1 张删除卡片');
  assert.equal(diff.cards.changed.length, 1, '应检出 1 张修改卡片');
  assert.deepEqual(diff.cards.changed[0].fields, ['body']);
  assert.deepEqual(diff.tags.added, ['新']);
  assert.deepEqual(diff.tags.removed, ['旧']);
});

finish('核心逻辑');
