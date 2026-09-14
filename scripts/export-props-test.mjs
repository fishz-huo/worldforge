/**
 * 自测（十九）：导出里的属性区
 * ------------------------------------------------------------------
 * 用法：node scripts/export-props-test.mjs
 *
 * 守三件事：
 *   1. 卡片条目在 Markdown 里带一段属性区（标签 / 结构化字段 / 关联都在里面）；
 *   2. 那段文本与**界面「属性区」页签渲染出来的完全一致** ——
 *      两条路走的是同一个渲染器，否则用户从导出文件里抄回来就对不上卡片了；
 *   3. 从导出文件里把属性区粘回来，字段值与类型逐个相等（真往返）。
 */
import { assert, finish, group, test } from './test-runner.mjs';
import { makeSource, collectAreas, areaToMarkdown, FIXED_AT } from './export-fixture.mjs';

const { renderPropsBlock, parseProps } = await import('@/lib/markdown/index.ts');
const { propsResolver, itemToMarkdown } = await import('@/lib/export/render-md.ts');
const { cardPropsBlock } = await import('@/lib/export/props.ts');
const { joinRelations } = await import('@/lib/markdown/props-format.ts');
const { tagsOf } = await import('@/types/index.ts');

group('条目带上卡片标记');

const source = makeSource();
const areas = collectAreas(source, {});
const cards = areas.find((a) => a.id === 'cards');
await test('卡片区域的条目都标了 kind=card', () => {
  assert.ok(cards, '应有卡片区域');
  assert.ok(cards.items.every((it) => it.kind === 'card'), '卡片条目应标 kind=card');
});

await test('文稿与大纲条目标了 doc / outline（它们没有属性区）', () => {
  const ms = areas.find((a) => a.id === 'manuscript');
  const ol = areas.find((a) => a.id === 'outline');
  assert.ok(ms.items.every((it) => it.kind === 'doc'));
  assert.ok(ol.items.every((it) => it.kind === 'outline'));
});

group('Markdown 里的属性区');

const md = areaToMarkdown(cards, source, propsResolver(source));

await test('围栏成对出现：每个卡片条目两行 `---`', () => {
  const fences = md.split('\n').filter((l) => l.trim() === '---').length;
  assert.equal(fences, cards.items.length * 2, `条目 ${cards.items.length} 条，围栏行 ${fences}`);
});

await test('属性区里带注释、标题与类型名（给别的工具读）', () => {
  assert.match(md, /# 以下为 WorldForge 属性区/);
  assert.match(md, /^title: /m);
  assert.match(md, /^typeName: /m);
});

await test('标签与关联不再以「**标签**：」「**关联**：」重复出现', () => {
  assert.ok(!md.includes('**标签**：'), '属性区已经写了标签，不该再重复一遍');
  assert.ok(!md.includes('**关联**：'), '属性区已经写了关联，不该再重复一遍');
});

group('两条路渲染出的属性区完全一致（界面 ↔ 导出）');

/** 把导出里的属性区文本按条目切出来 */
function fenceOf(title) {
  const at = md.indexOf(`## ${title}`);
  assert.ok(at >= 0, `导出里找不到条目「${title}」`);
  const from = md.indexOf('\n---\n', at);
  const to = md.indexOf('\n---\n', from + 5);
  return md.slice(from + 5, to);
}

await test('导出里的属性区 == 界面属性区渲染器输出', () => {
  const card = source.cards.find((c) => c.title === '云中君');
  const titleOf = (id) => source.cards.find((c) => c.id === id)?.title ?? '（已删除的卡片）';
  const mine = source.relations.filter((r) => r.from_id === card.id || r.to_id === card.id);
  const ui = renderPropsBlock({
    card,
    tags: tagsOf(card.id, source.cardTags, source.tags).map((t) => t.name),
    relations: joinRelations(mine, card.id, titleOf),
  });
  // 导出那一路多两行头部注释与 title / typeName，其余部分必须逐字相同
  const exported = fenceOf('云中君');
  const core = exported.split('\n').filter((l) => !l.startsWith('# ') && !l.startsWith('title:') && !l.startsWith('typeName:'));
  const uiCore = ui.split('\n').filter((l) => l !== '---');
  assert.deepEqual(core, uiCore);
});

group('往返（导出文本 → 卡片）');

await test('把属性区粘回来，字段值与类型逐个相等', () => {
  const card = source.cards.find((c) => c.title === '云中君');
  const parsed = parseProps(fenceOf('云中君'));
  assert.equal(parsed.type, 'character');
  assert.equal(parsed.subtitle, card.subtitle);
  assert.equal(parsed.summary, card.summary);
  assert.deepEqual(parsed.tags, ['守夜人']);
  // 字段：源卡片的每个非空字段都要在解析结果里且相等
  const filled = Object.entries(card.fields).filter(([k, v]) => k !== '__type' && k !== 'typeLabel' && v !== '' && v !== undefined && v !== null);
  assert.ok(filled.length > 0, '夹具卡片应有字段');
  filled.forEach(([key, value]) => {
    assert.deepEqual(parsed.fields[key], value, `字段 ${key} 往返后不一致`);
  });
  assert.equal(parsed.relations.length, 1);
  assert.equal(parsed.relations[0].label, '驻守');
  assert.equal(parsed.relations[0].title, '灰港');
  assert.equal(parsed.relations[0].id, 'c2');
});

await test('cardPropsBlock 与 itemToMarkdown 组合后仍是可解析的完整条目', () => {
  const card = source.cards.find((c) => c.title === '云中君');
  const item = cards.items.find((it) => it.id === card.id);
  const block = itemToMarkdown(item, 2, propsResolver(source));
  assert.ok(block.startsWith('## 云中君'));
  const parsed = parseProps(block);
  assert.equal(parsed.type, 'character');
  assert.equal(parsed.relations[0].title, '灰港');
  void FIXED_AT;
  void cardPropsBlock;
});
