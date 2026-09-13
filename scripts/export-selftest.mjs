/**
 * 自测（十二）：文档导出 —— 采集与文本格式
 * ------------------------------------------------------------------
 * 用法：node scripts/export-selftest.mjs
 *
 * 导出是最怕「悄悄出错」的功能：少了几张卡片、正文被改了、条目顺序乱了，
 * 用户往往过很久才发现。所以采集与各格式渲染全部做成纯函数，这里逐项断言。
 * 打印用 HTML 与文件清单见 scripts/export-html-test.mjs，
 * Word 的 OOXML / ZIP 细节见 scripts/export-docx-test.mjs。
 */
import { assert, finish, group, test } from './test-runner.mjs';
import {
  FIXED_AT, areaById, collectAreas, getFieldsFor, makeCard, makeSource,
  markdownToPlainText, safeSegment, seedSource, splitFileName, summarizeAreas, areaToPlainText,
  areaToMarkdown, replaceImages,
} from './export-fixture.mjs';

group('采集：区域与条目');

await test('合成数据能采出四个区域，条目数与来源一致', () => {
  const areas = collectAreas(makeSource());
  assert.deepEqual(areas.map((a) => a.id), ['cards', 'manuscript', 'notes', 'outline']);
  assert.equal(areaById(areas, 'cards').items.length, 4, '卡片区应有 4 张卡片');
  assert.equal(areaById(areas, 'manuscript').items[0].title, '第一章');
  assert.equal(areaById(areas, 'notes').items[0].title, '设定笔记');
  assert.equal(areaById(areas, 'outline').items[0].title, '主线大纲');
});

await test('真实示例世界观也能全部采出来（防采集器对真实数据失效）', () => {
  const source = seedSource();
  const areas = collectAreas(source);
  assert.equal(areaById(areas, 'cards').items.length, source.cards.length, '每张卡片都要有条目');
  assert.ok(areaById(areas, 'manuscript').items.length >= 1, '示例世界应有正文');
  assert.ok(areaById(areas, 'outline').items.length >= 1, '示例世界应有大纲');
  const summary = summarizeAreas(makeSource()).find((a) => a.id === 'cards');
  assert.equal(summary.count, 4);
  assert.ok(summary.words > 0, '字数统计应大于 0');
});

await test('卡片条目带上字段标签、标签与关联', () => {
  const card = areaById(collectAreas(makeSource()), 'cards').items.find((i) => i.id === 'c1');
  const def = getFieldsFor('character')[0];
  assert.ok(card.meta.some((m) => m.label === '类型' && m.value === '角色'), '应有类型行');
  assert.ok(card.meta.some((m) => m.label === def.label), `应带上字段「${def.label}」`);
  assert.deepEqual(card.tags, ['守夜人']);
  assert.deepEqual(card.relations, ['→ 驻守：灰港']);
});

await test('卡片按「类型 → 标题」排序（同类型挨着，方便成书后查找）', () => {
  const titles = areaById(collectAreas(makeSource()), 'cards').items.map((i) => i.title);
  // 默认导出全部：四张卡片都要在。角色（内置类型里排第一）在前，地点在后；
  // 同类型内按拼音：分(fen) < 另(ling) < 云(yun)
  assert.deepEqual(titles, ['分支人物', '另一个分支人物', '云中君', '灰港']);
});

await test('顺序跟着卡片库的类型顺序走，不受类型名的拼音影响', () => {
  // 若按类型名拼音排序，「地点」会跑到「角色」前面
  const swapped = makeSource({ cards: [makeCard('x', '某地', { type: 'location' }), makeCard('y', '某人')] });
  assert.deepEqual(areaById(collectAreas(swapped), 'cards').items.map((i) => i.title), ['某人', '某地']);
});

await test('默认导出全部：其它分支的内容不会被悄悄漏掉', () => {
  const titles = areaById(collectAreas(makeSource()), 'cards').items.map((i) => i.title);
  assert.ok(titles.includes('另一个分支人物'), '没勾「只导出当前分支」时，别的分支也要导');
});

await test('勾了「只导出当前分支」时，其它分支的条目被排除', () => {
  const areas = collectAreas(makeSource(), { branchOnly: true });
  const titles = areaById(areas, 'cards').items.map((i) => i.title);
  assert.ok(titles.includes('云中君'), '主世界内容要保留');
  assert.ok(titles.includes('分支人物'), '当前分支（b1）内容要保留');
  assert.ok(!titles.includes('另一个分支人物'), '别的分支（b2）内容不该出现');
});

await test('大纲优先用节点树（带完成状态），没有节点才退回文稿正文', () => {
  const withNodes = areaById(collectAreas(makeSource()), 'outline').items[0];
  assert.match(withNodes.markdown, /# 第一幕/, '应以节点树为准');
  assert.match(withNodes.markdown, /已完成/, '应带上节点状态');
  assert.ok(withNodes.meta.some((m) => m.label === '节点数' && m.value === '1 个'));
  const noNodes = areaById(collectAreas(makeSource({ outlineNodes: [] })), 'outline').items[0];
  assert.match(noNodes.markdown, /旧的文本/, '没有节点时应退回文稿正文');
});

await test('区域没有内容时整块消失（不生成空文件）', () => {
  const areas = collectAreas(makeSource({ docs: [], outlineNodes: [] }));
  assert.deepEqual(areas.map((a) => a.id), ['cards']);
  const summary = summarizeAreas(makeSource({ docs: [] })).find((a) => a.id === 'notes');
  assert.equal(summary.count, 0);
});

group('Markdown 与纯文本');

const mdSource = makeSource();
const mdArea = areaById(collectAreas(mdSource), 'cards');
const md = areaToMarkdown(mdArea, mdSource);

await test('Markdown 抬头写清来源，正文原样保留', () => {
  assert.match(md, /^# 测试世界 · 卡片 Wiki/, '一级标题应是世界观 + 区域');
  assert.match(md, /由 WorldForge 导出 · 2025-03-04 10:09/);
  assert.match(md, /来源：卡片库里的全部设定卡片/);
  assert.match(md, /## 云中君/, '条目是二级标题');
  assert.match(md, /- \*\*类型\*\*：角色/, '属性写成列表');
  assert.match(md, /\*\*标签\*\*：#守夜人/);
  assert.match(md, /\[\[灰港\]\]/, '双链语法原样保留');
  // 正文不做标题降级（这是备份文件，要能原样回灌），所以正文的 `#` 仍是 `#`
  assert.ok(md.includes('# 生平\n\n他是**守夜人**，住在[[灰港]]。'), '正文应与用户写的一字不差');
});

await test('条目超过 8 条时插入目录', () => {
  const many = makeSource({ cards: Array.from({ length: 9 }, (_, i) => makeCard(`c${i}`, `卡片${i}`)) });
  const area = areaById(collectAreas(many), 'cards');
  assert.match(areaToMarkdown(area, many), /## 目录/);
  assert.ok(!/## 目录/.test(md), '条目少时不该有目录');
});

await test('纯文本去掉标记但保留结构，且不漏字', () => {
  const txt = areaToPlainText(mdArea, mdSource);
  assert.ok(!txt.includes('**'), '不该留下粗体标记');
  assert.ok(!txt.includes('[['), '不该留下双链标记');
  assert.match(txt, /- 出生在灰港/, '列表符号保留');
  assert.match(txt, /［图片：肖像］/, '图片换成文字说明');
  assert.match(txt, /他是守夜人/, '行内标记去掉后文字要完整');
  assert.match(txt, /云中君/);
  assert.match(txt, /标签：#守夜人/);
  assert.match(markdownToPlainText('> 引用一句'), /｜ 引用一句/);
  assert.match(markdownToPlainText('| a | b |\n| --- | --- |\n| 1 | 2 |'), /a \| b/);
  assert.ok(!markdownToPlainText('# 标题').includes('#'), '标题符号要去掉');
});

await test('文件名清洗与拆分序号', () => {
  assert.equal(safeSegment('a/b:c*d?e"f<g>h|i'), 'a_b_c_d_e_f_g_h_i');
  assert.equal(safeSegment('   '), '未命名');
  assert.equal(splitFileName(0, '第一章', 'md'), '01-第一章.md');
  assert.equal(splitFileName(9, '第十章', 'docx'), '10-第十章.docx');
  assert.equal(replaceImages('![图](asset:1)'), '［图片：图］');
  assert.equal(replaceImages('![](asset:1)'), '［图片］');
});

await test('导出时间戳进了文件名（可排序，且不会覆盖旧导出）', () => {
  assert.equal(new Date(FIXED_AT).getHours(), 10, '夹具时间固定，便于断言');
  assert.match(areaToMarkdown(mdArea, mdSource), /2025-03-04 10:09/);
});

finish('文档导出（采集与文本）');
