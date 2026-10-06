/**
 * 自测：大纲文本的解析与投影
 * ------------------------------------------------------------------
 * 用法：node scripts/outline-parse-selftest.mjs
 * 盯的是诊断出来的 7 处缺陷里"读文本"的那几条：
 *   围栏代码块不当标题（D3）、旧版 ✅/❌ 徽章与「> 状态 · 摘要」引用行容忍（D4）、
 *   同名标题各认各的行（D5）、改名按位置关联、删行保留状态（D2）、
 *   内建示例「灰烬纪元」9/9 全中（D6）。
 * 真正写库的那一半（四条不变式）在 outline-sync-selftest.mjs。
 */
import { assert, finish, group, test } from './test-runner.mjs';
import { boot, state } from './db-harness.mjs';

await boot();

const { scanOutlineHeadings } = await import('@/lib/outline-text.ts');
const { headingAtOffset, needsGuide, projectOutline } = await import('@/features/outline/outlineProjection.ts');
const { applyNodeSync } = await import('@/features/outline/outlineStore.ts');

/** 建一篇新大纲并写入正文 */
function newOutline(content, title) {
  const id = state().createDoc('outline', title);
  state().updateDoc(id, { content });
  return id;
}
const rowsOf = (docId) => state().outlineNodes.filter((n) => n.doc_id === docId);
const textOf = (docId) => state().docs.find((d) => d.id === docId).content;
const projectOf = (docId) => projectOutline(textOf(docId), rowsOf(docId), docId);

group('解析内核（围栏 / 偏移 / 旧版数据容忍）');

await test('围栏代码块里的 # 不算标题（D3）', () => {
  const hits = scanOutlineHeadings('```js\n# 这是注释不是标题\n```\n# 真标题');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].title, '真标题');
  assert.equal(hits[0].line, 3);
});

await test('偏移精确到字符（含 CRLF 文本）', () => {
  const text = '# 甲\r\n正文\r\n## 一甲\r\n';
  const [a, b] = scanOutlineHeadings(text);
  assert.equal(a.lineStart, 0);
  assert.equal(a.titleStart, text.indexOf('甲'));
  assert.equal(a.summary, '正文');
  assert.equal(b.lineStart, text.indexOf('## 一甲'));
  assert.equal(b.titleStart, text.indexOf('一甲'));
  assert.equal(b.lineEnd, text.indexOf('## 一甲') + '## 一甲'.length);
});

await test('剥掉旧版 ✅/❌ 徽章，还能认出原标题（D4）', () => {
  const hits = scanOutlineHeadings('# 摘要测试 ✅\n## 另一节 ❌');
  assert.deepEqual(hits.map((h) => h.title), ['摘要测试', '另一节']);
  assert.deepEqual(hits.map((h) => h.rawTitle), ['摘要测试 ✅', '另一节 ❌']);
});

await test('旧版「> 已完成 · 摘要」引用行不当摘要（D4）', () => {
  const hits = scanOutlineHeadings('# 甲\n\n> 已完成 · 旧版写进去的摘要\n真正的正文\n');
  assert.equal(hits[0].summary, '真正的正文');
});

await test('同名标题按出现次序编号，只敲了「## 」不算节点', () => {
  const hits = scanOutlineHeadings('# 甲\n## \n# 甲');
  assert.equal(hits.length, 2);
  assert.deepEqual(hits.map((h) => h.occurrence), [0, 1]);
});

group('投影（匹配 / 重名 / 删行 / 改名）');

await test('内建示例「灰烬纪元」标题与库行 9/9 全中，不出引导条（D6）', () => {
  const doc = state().docs.find((d) => d.kind === 'outline');
  const p = projectOf(doc.id);
  assert.equal(p.stats.headings, 9);
  assert.equal(p.stats.rows, 9);
  assert.equal(p.stats.matched, 9);
  assert.equal(p.stats.orphans + p.stats.missing, 0);
  assert.equal(needsGuide(p.stats), false);
});

await test('重名标题各认各的行，状态不互相覆盖（D5）', () => {
  const id = newOutline('# 甲\n# 甲', '重名自测');
  applyNodeSync(id);
  const rows = rowsOf(id);
  assert.equal(rows.length, 2);
  state().updateOutlineNode(rows[0].id, { status: 'done' });
  const p = projectOf(id);
  assert.deepEqual(p.flat.map((n) => n.rowId), [rows[0].id, rows[1].id]);
  assert.deepEqual(p.flat.map((n) => n.status), ['done', 'idea']);
});

await test('文本删行：行留库隐藏、状态保留、不弹引导条（D2）', () => {
  const id = newOutline('# 甲\n# 乙', '删行自测');
  applyNodeSync(id);
  const yi = rowsOf(id).find((n) => n.title === '乙');
  state().updateOutlineNode(yi.id, { status: 'done' });
  state().updateDoc(id, { content: '# 甲' });
  const p = projectOf(id);
  assert.equal(p.flat.length, 1);
  assert.equal(p.stats.orphans, 1);
  assert.equal(p.stats.missing, 0);
  assert.equal(needsGuide(p.stats), false, '单边落空是正常编辑，不该弹条');
  assert.equal(rowsOf(id).find((n) => n.id === yi.id).status, 'done', '状态必须还在库里');
});

await test('文本改标题：位置自动关联，状态与摘要跟着走（D2 的正解）', () => {
  const id = newOutline('# 甲\n# 乙', '改名自测');
  applyNodeSync(id);
  const jia = rowsOf(id).find((n) => n.title === '甲');
  state().updateOutlineNode(jia.id, { status: 'done', summary: '自定义摘要' });
  state().updateDoc(id, { content: '# 丙\n# 乙' });
  assert.equal(projectOf(id).flat[0].renameFrom, '甲');
  applyNodeSync(id);
  const after = rowsOf(id).find((n) => n.id === jia.id);
  assert.equal(after.title, '丙');
  assert.equal(after.status, 'done');
  assert.equal(after.summary, '自定义摘要');
});

await test('数量不等就不猜：不做位置关联，旧行原样留着', () => {
  const id = newOutline('# 甲\n# 乙', '不猜自测');
  applyNodeSync(id);
  // 落空标题 2 个（丙、丁）、落空行只有 1 个（甲）：层级虽对得上也不许猜
  state().updateDoc(id, { content: '# 丙\n# 乙\n# 丁' });
  const p = projectOf(id);
  assert.equal(p.stats.orphans, 1);
  assert.equal(p.stats.missing, 2);
  assert.equal(p.flat[0].renameFrom, null, '不该把「甲」认成「丙」');
  applyNodeSync(id);
  assert.equal(rowsOf(id).length, 4);
  assert.ok(rowsOf(id).some((n) => n.title === '甲'), '旧行必须原样留着');
});

await test('落空标题少于落空行时同样不猜（删行 ≠ 改名）', () => {
  const id = newOutline('# 甲\n# 乙\n# 丙', '删行不猜自测');
  applyNodeSync(id);
  const bing = rowsOf(id).find((n) => n.title === '丙');
  state().updateOutlineNode(bing.id, { status: 'done' });
  // 只有「甲」留在文本里：乙、丙成孤立行；落空标题 0 个 → 绝不该把丙认成别的
  state().updateDoc(id, { content: '# 甲' });
  applyNodeSync(id);
  assert.equal(rowsOf(id).length, 3, '行一个都不该少');
  assert.equal(rowsOf(id).find((n) => n.id === bing.id).status, 'done');
});

await test('偏移反查：光标落在哪个节点（跳转用）', () => {
  const text = '# 第一幕\n正文\n## 开场\n';
  const p = projectOutline(text, [], 'doc');
  assert.equal(headingAtOffset(p.flat, 0).title, '第一幕');
  assert.equal(headingAtOffset(p.flat, text.indexOf('开场')).title, '开场');
  assert.equal(headingAtOffset(p.flat, text.length).title, '开场');
});

finish('大纲解析与投影');
