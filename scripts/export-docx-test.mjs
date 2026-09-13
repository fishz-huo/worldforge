/**
 * 自测（十）：Markdown → Word 文档
 * ------------------------------------------------------------------
 * 用法：node scripts/export-docx-test.mjs
 *
 * 校验 src/lib/export/md-blocks.ts（Markdown → 文档块）与 docx.ts（OOXML 部件 → ZIP 字节）。
 * ZIP 结构本身由 scripts/export-zip-test.mjs 守着，这里复用 scripts/zip-read.mjs 的解析器，
 * 把 .docx 当 ZIP 拆开逐个部件检查：部件清单、关系 id、XML 转义、分页、样式表与「不漏字」。
 * 最后往**系统临时目录**写一份真实样例，供人工用 Expand-Archive + [xml] 或 Word / WPS
 * 双击复核（自测不该往仓库里丢产物，所以不写在仓库里）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assert, finish, group, test } from './test-runner.mjs';
import { json, partText, readZip } from './zip-read.mjs';

register('./alias-hook.mjs', import.meta.url);
const { parseSpans, toDocBlocks } = await import('@/lib/export/md-blocks.ts');
const { buildDocx } = await import('@/lib/export/docx.ts');

/** 样例正文：两三层标题、两种列表（含缩进子项）、引用、表格、代码块、分隔线、行内格式、中文 */
const SAMPLE_MD = `# 云中界
云中界共有 **三重天**，彼此靠两界通道相连，_历来如此_。
## 地理
1. 东荒
2. 西泽
> 太初历三千年，赤霄剑现世。
- 上层：云海
- 中层：人间
  - 附：守夜人驻地
### 势力
| 名称 | 首领 | 备注 |
| --- | --- | --- |
| 天枢阁 | 云中君 | 掌历法 |
| 守夜人 | 无名 | 守两界通道 |
\`\`\`ts
const realm = '云中界';
\`\`\`
---
见 [[云中君]] 与 \`两界通道\`、[设定页](https://example.test)，~~已废弃~~ 归一。
`;

/** 把一个文档里所有块的文字拼起来（校验「不漏字」用） */
const allText = (blocks) => blocks.map((block) => {
  if (block.kind === 'code') return block.text;
  const spans = block.kind === 'divider' ? [] : block.kind === 'list' ? block.items.flat()
    : block.kind === 'table' ? [...block.header, ...block.rows].flat(2) : block.spans;
  return spans.map((span) => span.text).join('');
}).join('');

group('parseSpans：行内语法');
await test('粗体 / 斜体 / 行内代码（含 **粗 _斜_** 两层嵌套）', () => {
  assert.deepEqual(json(parseSpans('前 **粗** 中 _斜_ 后 `code`')), [
    { text: '前 ' }, { text: '粗', bold: true }, { text: ' 中 ' }, { text: '斜', italic: true },
    { text: ' 后 ' }, { text: 'code', code: true },
  ]);
  assert.deepEqual(json(parseSpans('**粗 _斜_**')), [
    { text: '粗 ', bold: true }, { text: '斜', bold: true, italic: true },
  ]);
});

await test('链接保留文字丢地址；双链保留显示名；反斜杠转义；删除线当普通文字', () => {
  assert.deepEqual(json(parseSpans('见 [官方设定](https://x.test/a) 与 [[云中君]]、[[云中君|国主]]')), [
    { text: '见 官方设定 与 云中君、国主' },
  ]);
  assert.deepEqual(json(parseSpans('\\*不是斜体\\* 和 ~~删除线~~')), [{ text: '*不是斜体* 和 删除线' }]);
});

await test('不成对的标记原样保留，绝不吞字', () => {
  assert.deepEqual(json(parseSpans('**没闭合 还有 *号')), [{ text: '**没闭合 还有 *号' }]);
  // 乘号、snake_case 这类「看着像斜体」的文本不该被格式化，且一个字符都不能少
  const chars = (spans) => spans.map((span) => span.text).join('');
  for (const src of ['2 * 3 = 6 和 4 * 5 = 20', 'some_var_name_here', '落单的 * 星号']) {
    assert.equal(chars(parseSpans(src)), src, `「${src}」的字符被吞或改写了`);
    assert.equal(parseSpans(src).filter((span) => span.italic).length, 0, `「${src}」被误判成斜体`);
  }
});

group('toDocBlocks：块级解析');
await test('标题层级；连续非空行合并成一段；\\r\\n 归一化', () => {
  const blocks = toDocBlocks('# 一级\n\n## 二级\r\n正文第一行\n正文第二行\n\n### 三级\n');
  assert.deepEqual(blocks.map((block) => block.kind), ['heading', 'heading', 'para', 'heading']);
  assert.deepEqual(blocks.filter((block) => block.kind === 'heading').map((block) => block.level), [1, 2, 3]);
  assert.equal(blocks[2].spans.length, 1);
  assert.equal(blocks[2].spans[0].text, '正文第一行\n正文第二行');
});

await test('列表（缩进子项并入同一串 items）/ 引用合并 / 代码块保留空行与缩进 / 分隔线', () => {
  const unordered = toDocBlocks('- 甲\n- 乙\n  - 乙之子\n');
  assert.deepEqual(unordered.map((block) => block.kind), ['list']);
  assert.equal(unordered[0].ordered, false);
  assert.deepEqual(json(unordered[0].items), [[{ text: '甲' }], [{ text: '乙' }], [{ text: '乙之子' }]]);
  const ordered = toDocBlocks('1. 一\n2. 二\n');
  assert.equal(ordered[0].ordered, true);
  assert.deepEqual(json(ordered[0].items), [[{ text: '一' }], [{ text: '二' }]]);
  const [quote] = toDocBlocks('> 第一句\n> 第二句\n\n正文');
  assert.equal(quote.kind, 'quote');
  assert.equal(quote.spans[0].text, '第一句 第二句');
  const blocks = toDocBlocks('```ts\nconst a = 1;\n\n  const b = 2;\n```\n\n---\n');
  assert.deepEqual(blocks.map((block) => block.kind), ['code', 'divider']);
  assert.equal(blocks[0].text, 'const a = 1;\n\n  const b = 2;');
});

await test('表格：表头 + 数据行 + 单元格里的行内格式', () => {
  const [table] = toDocBlocks('| 名称 | 身份 |\n| --- | --- |\n| 云中君 | **国主** |\n');
  assert.equal(table.kind, 'table');
  assert.deepEqual(json(table.header), [[{ text: '名称' }], [{ text: '身份' }]]);
  assert.equal(table.rows.length, 1);
  assert.deepEqual(json(table.rows[0][1]), [{ text: '国主', bold: true }]);
});

await test('不漏字：所有块的文字拼起来覆盖原文全部关键词', () => {
  const blocks = toDocBlocks(SAMPLE_MD);
  assert.ok(blocks.length >= 8, `只解析出 ${blocks.length} 个块，样例没被完整解析`);
  const text = allText(blocks);
  for (const key of ['云中界', '两界通道', '赤霄剑', '太初历', '守夜人', '归一', "const realm = '云中界';"]) {
    assert.ok(text.includes(key), `导出的块里丢了「${key}」`);
  }
});

group('buildDocx：OOXML 产物');
const INPUT = {
  title: 'A & B <C>',
  subtitle: '副标题',
  meta: ['导出于 2025-01-01', '共 2 条'],
  blocks: toDocBlocks(SAMPLE_MD),
  pageBreakBeforeHeadings: true,
};
const entries = await readZip(await buildDocx(INPUT));

await test('合法 ZIP：7 个部件齐全且 [Content_Types].xml 在第一位；类型与关系 id 对得上', async () => {
  assert.deepEqual(entries.map((entry) => entry.name), [
    '[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels',
    'word/styles.xml', 'docProps/core.xml', 'docProps/app.xml',
  ]);
  const types = await partText(entries, '[Content_Types].xml');
  assert.ok(types.includes('wordprocessingml.document.main+xml'), 'docx 主部件类型不对');
  assert.ok(types.includes('wordprocessingml.styles+xml'), 'styles 部件类型不对');
  assert.ok(types.includes('core-properties+xml') && types.includes('extended-properties+xml'));
  const rels = await partText(entries, '_rels/.rels');
  for (const id of ['rId1', 'rId2', 'rId3']) assert.ok(rels.includes(`Id="${id}"`), `缺少关系 ${id}`);
  assert.ok(rels.includes('Target="word/document.xml"'));
  assert.ok((await partText(entries, 'word/_rels/document.xml.rels')).includes('Target="styles.xml"'));
});

await test('document.xml：XML 声明 / w:document / A4 与页边距 / 第一个一级标题也分页 / 转义', async () => {
  const doc = await partText(entries, 'word/document.xml');
  assert.ok(doc.startsWith('<?xml') && doc.includes('<w:document'));
  assert.ok(doc.includes('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'), 'A4 纸张尺寸不对');
  assert.ok(doc.includes('<w:pgMar w:top="1440" w:right="1701" w:bottom="1440" w:left="1701"'), '页边距不对');
  assert.ok(doc.includes('<w:pStyle w:val="Heading1"/>'), '一级标题段落没生成');
  const firstH1 = doc.indexOf('w:val="Heading1"');
  const firstBreak = doc.indexOf('<w:pageBreakBefore/>');
  assert.ok(firstBreak > firstH1 && firstBreak - firstH1 < 120, '第一个一级标题没有分页');
  assert.ok(doc.includes('A &amp; B &lt;C&gt;'), '特殊字符没有被转义');
  assert.ok(!doc.includes('A & B <C>'), '出现了未转义的裸字符');
  assert.ok(!/<w:t>/.test(doc), '有 run 缺少 xml:space="preserve"');
});

await test('正文结构：行内格式 / 表格 / 引用 / 代码块 / 两种列表前缀；styles.xml 与 core.xml', async () => {
  const doc = await partText(entries, 'word/document.xml');
  assert.ok(doc.includes('<w:b/>') && doc.includes('<w:i/>') && doc.includes('Consolas'), '行内格式没生成');
  assert.ok(doc.includes('<w:tbl>') && doc.includes('<w:tblBorders>'), '表格没生成');
  assert.ok(doc.includes('<w:pStyle w:val="Quote"/>') && doc.includes('<w:pStyle w:val="Code"/>'));
  assert.ok(doc.includes('• ') && doc.includes('1. '), '无序 / 有序列表前缀没生成');
  const styles = await partText(entries, 'word/styles.xml');
  for (const id of ['Normal', 'Title', 'Subtitle', 'Heading1', 'Heading2', 'Heading3', 'Heading4', 'Quote', 'Code', 'Meta']) {
    assert.ok(styles.includes(`w:styleId="${id}"`), `styles.xml 缺少 ${id}`);
  }
  assert.ok(styles.includes('w:eastAsia="宋体"') && styles.includes('Calibri'));
  assert.ok(styles.includes('<w:sz w:val="21"/>'), 'Normal 应是 10.5pt（半磅 21）');
  assert.ok(styles.includes('<w:sz w:val="44"/>'), 'Title 应是 22pt（半磅 44）');
  assert.ok(styles.includes('w:line="360"') && styles.includes('F2F2F2') && styles.includes('Consolas'));
  const core = await partText(entries, 'docProps/core.xml');
  assert.ok(core.includes('<dc:title>A &amp; B &lt;C&gt;</dc:title>'), 'core.xml 的标题没转义或缺失');
  assert.ok(core.includes('dcterms:created'), 'core.xml 缺少 dcterms:created');
});

await test('写出一份真实样例，供外部工具解压 / Word 打开复核', async () => {
  const sample = await buildDocx({
    title: '云中界 · 世界设定集',
    subtitle: 'WorldForge 导出样例',
    meta: [`导出于 ${new Date().toISOString().slice(0, 10)}`, '共 3 张卡片 · 本文件由自测脚本生成'],
    blocks: toDocBlocks(SAMPLE_MD),
    pageBreakBeforeHeadings: true,
  });
  // 写到系统临时目录：想在 Word / WPS 里复核时直接双击这个文件即可
  const outDir = join(tmpdir(), 'worldforge-export-docx');
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, 'sample.docx');
  writeFileSync(file, sample);
  assert.deepEqual([...sample.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'ZIP 魔数不对');
  assert.ok(sample.length > 2000, `样例只有 ${sample.length} 字节，太小了`);
  console.log(`    → ${file}（${sample.length} 字节，${entries.length} 个部件，可直接双击复核）`);
});

finish('Markdown → Word 文档');
