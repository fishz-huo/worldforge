/**
 * 核心逻辑自测（二）：查询、大纲转换、时间轴、示例数据
 * ------------------------------------------------------------------
 * 用法：node scripts/selftest-model.mjs
 * 这些都是「世界观软件的业务规则」，例如：
 * 主世界视图不显示分支独占卡片、标签筛选是 AND 语义、
 * 大纲文本与树的层级必须一致、角色年龄要能按刻度推算。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const { filterCards, buildTitleIndex, findMentionedCards, relationsOfCard } = await import('@/lib/query.ts');
const { parseOutlineText, headingsToNodes, outlineToMarkdown } = await import('@/lib/outline-text.ts');
const { ageAt, entrySpan, niceStep } = await import('@/types/timeline.ts');
const { buildOutlineTree } = await import('@/types/doc.ts');
const { buildSeed } = await import('@/lib/seed');

/* ------------------------------ 查询 ------------------------------ */

const cards = [
  { id: 'c1', title: '灵息', type: 'lore', branch_id: null, summary: '能量', body: '', fields: {}, pinned: 0 },
  { id: 'c2', title: '阿舒尔', type: 'character', branch_id: null, summary: '主角', body: '', fields: {}, pinned: 1 },
  { id: 'c3', title: '另一个阿舒尔', type: 'character', branch_id: 'b1', summary: '分支版本', body: '', fields: {}, pinned: 0 },
];
const cardTags = [
  { card_id: 'c1', tag_id: 't1' },
  { card_id: 'c2', tag_id: 't1' },
  { card_id: 'c2', tag_id: 't2' },
];

group('卡片查询与关联');

await test('分支可见性：主世界视图不显示分支独占卡片', () => {
  const visible = filterCards(cards, cardTags, { branchId: null, branchScope: 'current' });
  assert.deepEqual(visible.map((c) => c.id), ['c1', 'c2']);
});

await test('分支可见性：切到分支后主世界卡片仍可见', () => {
  const visible = filterCards(cards, cardTags, { branchId: 'b1', branchScope: 'current' });
  assert.deepEqual(visible.map((c) => c.id).sort(), ['c1', 'c2', 'c3']);
});

await test('标签筛选为 AND 语义', () => {
  assert.equal(filterCards(cards, cardTags, { tagIds: ['t1'] }).length, 2);
  assert.equal(filterCards(cards, cardTags, { tagIds: ['t1', 't2'] }).length, 1);
  assert.equal(filterCards(cards, cardTags, { tagIds: ['t1', 't9'] }).length, 0);
});

await test('类型 + 关键词 + 置顶筛选', () => {
  // 默认「当前分支（主世界）」口径，分支独占的角色卡 c3 不计入
  assert.equal(filterCards(cards, cardTags, { type: 'character' }).length, 1);
  assert.equal(filterCards(cards, cardTags, { type: 'character', branchScope: 'all' }).length, 2);
  assert.equal(filterCards(cards, cardTags, { search: '能量' }).length, 1);
  assert.equal(filterCards(cards, cardTags, { search: '主角' }).length, 1);
  assert.equal(filterCards(cards, cardTags, { pinnedOnly: true }).length, 1);
});

await test('标题索引支持去掉书名号', () => {
  const index = buildTitleIndex([{ ...cards[0], title: '《能源与文明》' }]);
  assert.ok(index.get('《能源与文明》'));
  assert.ok(index.get('能源与文明'));
});

await test('关键词命中按长标题优先，避免子串误伤', () => {
  const found = findMentionedCards('另一个阿舒尔走了过来', [{ ...cards[1] }, { ...cards[2] }]);
  assert.equal(found[0].id, 'c3', '应先命中更长的标题');
});

await test('关联双向反查', () => {
  const relations = [{ id: 'r1', from_id: 'c1', to_id: 'c2', label: '作用于', directed: 1 }];
  assert.equal(relationsOfCard('c2', relations)[0].direction, 'incoming');
  assert.equal(relationsOfCard('c1', relations)[0].direction, 'outgoing');
});

/* ------------------------------ 大纲 ------------------------------ */

group('大纲文本 ⇄ 树');

const outlineText = '# 第一幕\n开场说明\n## 小节 A\n- 事件\n## 小节 B\n### 更深\n# 第二幕\n';

await test('解析 Markdown 标题为层级结构', () => {
  const headings = parseOutlineText(outlineText);
  assert.deepEqual(headings.map((h) => h.level), [1, 2, 2, 3, 1]);
  assert.equal(headings[0].summary, '开场说明');
});

await test('转换为带父子关系的节点', () => {
  let n = 0;
  const nodes = headingsToNodes(parseOutlineText(outlineText), () => `n${(n += 1)}`, 'doc1');
  const tree = buildOutlineTree(nodes);
  assert.equal(tree.length, 2, '应有两个根节点');
  assert.equal(tree[0].children.length, 2);
  assert.equal(tree[0].children[1].children.length, 1, '三级标题应挂到二级下');
});

await test('树写回 Markdown', () => {
  let n = 0;
  const nodes = headingsToNodes(parseOutlineText(outlineText), () => `n${(n += 1)}`, 'doc1');
  const md = outlineToMarkdown(buildOutlineTree(nodes), (s) => s);
  assert.match(md, /^# 第一幕/m);
  assert.match(md, /^## 小节 A/m);
  assert.match(md, /^### 更深/m);
});

/* ------------------------------ 时间轴 ------------------------------ */

group('时间轴计算');

await test('角色年龄推算', () => {
  assert.equal(ageAt(221, 245), 24);
  assert.equal(ageAt(null, 245), null);
});

await test('瞬时事件给最小可见跨度', () => {
  const [from, to] = entrySpan({ start_t: 245, end_t: null, instant: 1 }, 0.5);
  assert.equal(from, 245);
  assert.equal(to, 245.5);
});

await test('刻度步长取 1/2/5 × 10ⁿ', () => {
  assert.equal(niceStep(100, 10), 10);
  assert.equal(niceStep(1000, 10), 100);
  assert.ok([1, 2, 5, 10, 20, 50].includes(niceStep(37, 10)));
});

/* ------------------------------ 示例数据 ------------------------------ */

group('示例世界观自洽性');

await test('示例数据内部引用完整（关联 / 标签 / 标记 / 条目 / 大纲）', () => {
  const seed = buildSeed();
  const ids = new Set(seed.cards.map((c) => c.id));
  assert.ok(seed.cards.length >= 8, '示例卡片数量应足够展示功能');
  assert.equal(new Set(seed.cards.map((c) => c.id)).size, seed.cards.length, '卡片 id 不应重复');
  seed.relations.forEach((r) => {
    assert.ok(ids.has(r.from_id) && ids.has(r.to_id), `关联「${r.label}」指向了不存在的卡片`);
  });
  seed.cardTags.forEach((ct) => assert.ok(ids.has(ct.card_id), '标签关联指向了不存在的卡片'));
  seed.pins.forEach((p) => {
    if (p.card_id) assert.ok(ids.has(p.card_id), '地图标记指向了不存在的卡片');
  });
  seed.entries.forEach((e) => {
    if (e.card_id) assert.ok(ids.has(e.card_id), '时间轴条目指向了不存在的卡片');
  });
  seed.outlineNodes.forEach((n) => {
    if (n.card_id) assert.ok(ids.has(n.card_id), '大纲节点指向了不存在的卡片');
  });
  assert.ok(seed.world.meta.time, '示例世界应带时间轴配置');
  assert.ok(seed.docs.some((d) => d.kind === 'outline'), '示例应包含大纲文稿');
  assert.ok(seed.docs.some((d) => d.kind === 'manuscript'), '示例应包含正文文稿');
  assert.ok(seed.regions.every((r) => r.points.length >= 3), '区域至少要有 3 个顶点');
});

finish('模型层');
