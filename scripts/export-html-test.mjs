/**
 * 自测（十三）：文档导出 —— 打印用 HTML 与文件清单
 * ------------------------------------------------------------------
 * 用法：node scripts/export-html-test.mjs
 *
 * PDF 走的是「把导出内容渲染成 HTML → 交给系统打印」，所以这段 HTML 里
 * 有三件事必须守住：转义（防注入）、标题降级（层级不乱）、图片处理（不留死链）。
 * 文件清单这一组则守住需求本身：一个区域一份文件、不合并、命名可辨认、
 * 拆分时带序号与子目录。
 */
import { assert, finish, group, test } from './test-runner.mjs';
import {
  areaById, areaToPrintHtml, buildExportFiles, collectAreas, makeCard, makeSource, shiftHeadings,
} from './export-fixture.mjs';

const source = makeSource();
const area = areaById(collectAreas(source), 'cards');
const html = areaToPrintHtml(area, source);

group('打印用 HTML（PDF 出口）');

await test('HTML 含抬头、条目与预览同款的 .md-body 正文', () => {
  assert.match(html, /class="wf-doc"/);
  assert.match(html, /wf-doc-title">测试世界</);
  assert.match(html, /wf-item-title">云中君</);
  assert.match(html, /class="md-body"/, '正文必须复用预览样式，PDF 才与预览一致');
  assert.match(html, /2025-03-04 10:09/);
});

await test('正文标题降级到条目标题之下，且不会超过 h6', () => {
  assert.match(html, /<h3 id="h-生平"/, '正文的 # 应变成 h3');
  assert.equal(shiftHeadings('<h5>x</h5>'), '<h6>x</h6>', '降到 h6 就封顶，闭标签也要跟着改');
  assert.equal(shiftHeadings('<h1>a</h1>'), '<h3>a</h3>');
  assert.equal(shiftHeadings('<h5>x</h5>', 0), '<h5>x</h5>');
  assert.ok(!/<h1[^>]*id="h-/.test(html), '正文里不该再有一级标题');
});

await test('标题与正文都做了 HTML 转义（防注入）', () => {
  const evil = makeSource({ cards: [makeCard('x', '<script>alert(1)</script>')] });
  const out = areaToPrintHtml(areaById(collectAreas(evil), 'cards'), evil);
  assert.ok(!out.includes('<script>'), '不该出现裸标签');
  assert.match(out, /&lt;script&gt;/);
});

await test('图库图片换成文字说明，外链图片仍然保留', () => {
  assert.match(html, /wf-img-note/);
  assert.ok(!html.includes('src="asset:'), '本地图片不该留下死链');
  const ext = makeSource({ cards: [makeCard('x', '图', { body: '![a](https://example.com/a.png)' })] });
  assert.match(areaToPrintHtml(areaById(collectAreas(ext), 'cards'), ext), /<img src="https:\/\/example.com\/a.png"/);
});

await test('按章节分页的区域带上 wf-pages 标记（正文每章另起一页）', () => {
  const areas = collectAreas(source);
  assert.match(areaToPrintHtml(areaById(areas, 'manuscript'), source), /class="wf-doc wf-pages"/);
  assert.ok(!/wf-pages/.test(html), '卡片区不该强制分页');
});

await test('条目多时 HTML 里也带目录，且目录后另起一页', () => {
  const many = makeSource({ cards: Array.from({ length: 9 }, (_, i) => makeCard(`c${i}`, `卡片${i}`)) });
  const out = areaToPrintHtml(areaById(collectAreas(many), 'cards'), many);
  assert.match(out, /class="wf-toc"/);
  const chapters = makeSource({ docs: Array.from({ length: 9 }, (_, i) => ({
    id: `d${i}`, world_id: 'w1', branch_id: null, kind: 'manuscript', title: `第${i}章`,
    content: '正文', summary: '', order_index: i, card_id: null, created_at: 1, updated_at: 1,
  })) });
  assert.match(areaToPrintHtml(areaById(collectAreas(chapters), 'manuscript'), chapters), /wf-toc-break/);
});

group('编排：文件清单');

await test('合并模式：一个区域一份文件，命名带世界观、区域与时间戳', async () => {
  const files = await buildExportFiles(source, { areaIds: ['cards', 'manuscript'], formats: ['md', 'txt'] });
  assert.equal(files.length, 4, '2 区域 × 2 格式 = 4 个文件');
  const names = files.map((f) => f.name);
  assert.equal(new Set(names).size, 4, '文件名不能重复');
  assert.ok(names.includes('测试世界-卡片 Wiki-20250304-1009.md'));
  assert.ok(names.includes('测试世界-写作正文-20250304-1009.txt'));
  assert.ok(files.every((f) => !f.subDir), '合并模式不该有子目录');
});

await test('PDF 只给打印用 HTML，其它格式给文本或字节', async () => {
  const files = await buildExportFiles(source, { areaIds: ['cards'], formats: ['md', 'txt', 'docx', 'pdf'] });
  const by = Object.fromEntries(files.map((f) => [f.format, f]));
  assert.ok(by.md.text && !by.md.bytes, 'md 是文本');
  assert.ok(by.txt.text.includes('卡片 Wiki'), 'txt 带抬头');
  assert.equal(by.docx.bytes[0], 0x50, 'docx 应以 PK 开头');
  assert.equal(by.docx.bytes[1], 0x4b);
  assert.ok(by.pdf.html && !by.pdf.text && !by.pdf.bytes, 'pdf 只产出 HTML');
  assert.equal(by.pdf.mime, 'application/pdf');
});

await test('拆分模式：每个条目一份，装在同名子目录里且序号对齐', async () => {
  const files = await buildExportFiles(source, { areaIds: ['manuscript', 'outline'], formats: ['md'], split: true });
  assert.equal(files.length, 2, '正文 1 篇 + 大纲 1 篇');
  assert.ok(files.every((f) => f.subDir === '测试世界-写作正文-20250304-1009' || f.subDir === '测试世界-大纲-20250304-1009'));
  assert.ok(files.some((f) => f.name === '01-第一章.md'));
  assert.ok(files.some((f) => f.name === '01-主线大纲.md'));
  assert.match(files[0].text, /^> 来自 测试世界 · 写作正文/);
});

await test('多区域多格式时文件互不覆盖，且每个区域都有自己的一份', async () => {
  const files = await buildExportFiles(source, { areaIds: ['cards', 'manuscript', 'outline'], formats: ['md', 'txt', 'docx'] });
  assert.equal(files.length, 9);
  assert.equal(new Set(files.map((f) => f.name)).size, 9);
  for (const id of ['cards', 'manuscript', 'outline']) {
    const area = areaById(collectAreas(source), id);
    for (const format of ['md', 'txt', 'docx']) {
      assert.ok(files.some((f) => f.name.includes(area.title) && f.name.endsWith(`.${format}`)), `${id}/${format} 缺文件`);
    }
  }
});

await test('没勾区域时产出空清单（由插件负责提示，不生成空文件）', async () => {
  assert.deepEqual(await buildExportFiles(source, { areaIds: [], formats: ['md'] }), []);
});

finish('文档导出（HTML 与文件清单）');
