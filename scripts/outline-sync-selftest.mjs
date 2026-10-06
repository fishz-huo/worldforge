/**
 * 自测：大纲同步的落地（四条不变式）与引导条
 * ------------------------------------------------------------------
 * 用法：node scripts/outline-sync-selftest.mjs
 * 只写 outline_nodes，读文本的那一半在 outline-parse-selftest.mjs。
 *    I1 自动通道永不写 docs.content；
 *    I2 既有行的 status / card_id / summary 一个都不许动；
 *    I3 改名先改行、再写文本（R3 的标题写回靠它自证命中）；
 *    D1 建行不会再改 selectedOutlineId；
 *    D7 导入「潮线之外」：文本 4 个标题 / 库里 12 行 → 必须出引导条。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, finish, group, test } from './test-runner.mjs';
import { boot, state } from './db-harness.mjs';

await boot();

const { needsGuide, projectOutline } = await import('@/features/outline/outlineProjection.ts');
const { applyNodeSync, writeTreeToText } = await import('@/features/outline/outlineStore.ts');

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function newOutline(content, title) {
  const id = state().createDoc('outline', title);
  state().updateDoc(id, { content });
  return id;
}
const rowsOf = (docId) => state().outlineNodes.filter((n) => n.doc_id === docId);
const textOf = (docId) => state().docs.find((d) => d.id === docId).content;
const projectOf = (docId) => projectOutline(textOf(docId), rowsOf(docId), docId);

group('落地（四条不变式）');

await test('自动通道永不写 docs.content（I1）', () => {
  const id = newOutline('# 一\n## 一甲\n', 'I1 自测');
  const before = textOf(id);
  assert.equal(applyNodeSync(id), 2);
  assert.equal(textOf(id), before, '文本必须一个字符都不变');
});

await test('父子与次序按文本对齐，再算一次零动作（幂等）', () => {
  const id = newOutline('# 一\n## 一甲\n### 一甲一\n# 二', '结构自测');
  applyNodeSync(id);
  const rows = rowsOf(id);
  assert.equal(rows.length, 4);
  const pick = (t) => rows.find((n) => n.title === t);
  assert.equal(pick('一甲').parent_id, pick('一').id);
  assert.equal(pick('一甲一').parent_id, pick('一甲').id);
  assert.equal(pick('二').parent_id, null);
  assert.equal(pick('一甲一').order_index, 0);
  assert.equal(applyNodeSync(id), 0);
});

await test('既有行的 status / card_id / summary 一个都不许动（I2）', () => {
  const id = newOutline('# 甲\n', 'I2 自测');
  applyNodeSync(id);
  const jia = rowsOf(id).find((n) => n.title === '甲');
  state().updateOutlineNode(jia.id, { status: 'cut', summary: '别动我', card_id: 'card-x' });
  state().updateDoc(id, { content: '# 甲\n# 乙\n' });
  applyNodeSync(id);
  const after = rowsOf(id).find((n) => n.id === jia.id);
  assert.equal(after.status, 'cut');
  assert.equal(after.summary, '别动我');
  assert.equal(after.card_id, 'card-x');
});

await test('建行不会再改 selectedOutlineId（D1 的回归测试）', () => {
  const id = newOutline('# X\n# Y', 'D1 自测');
  state().selectOutline(id);
  applyNodeSync(id);
  assert.equal(state().selectedOutlineId, id, '建行后必须还停在这篇大纲上');
  assert.ok(state().docs.some((d) => d.id === state().selectedOutlineId));
});

group('引导条与干净写回');

await test('「把树写进文本」写出的文本不含 ✅/❌ 与状态引用行', () => {
  const id = newOutline('# 甲\n', '写回自测');
  applyNodeSync(id);
  const jia = rowsOf(id).find((n) => n.title === '甲');
  state().updateOutlineNode(jia.id, { status: 'done', summary: '一句摘要' });
  writeTreeToText(id);
  const text = textOf(id);
  assert.ok(!text.includes('✅') && !text.includes('❌'), '不该再写徽章');
  assert.ok(!/^\s*>/m.test(text), '不该再写「> 状态 · 摘要」引用行');
  const p = projectOf(id);
  assert.equal(p.stats.missing + p.stats.orphans, 0, '写完两边应完全对齐');
  assert.equal(p.flat[0].status, 'done', '状态仍在库里');
});

await test('导入「潮线之外」：文本 4 个标题 / 库里 12 行 → 必须出引导条（D7）', async () => {
  const { importBackup, parseBackup } = await import('@/lib/backup.ts');
  const backup = parseBackup(readFileSync(join(ROOT, 'samples', '潮线之外.worldforge.json'), 'utf8'));
  const worldId = state().createWorld('潮线之外（大纲自测）');
  await importBackup(worldId, backup);
  await state().reload();

  const doc = state().docs.find((d) => d.world_id === worldId && d.kind === 'outline');
  assert.ok(doc, '导入后应当有一篇大纲');
  const p = projectOf(doc.id);
  assert.equal(p.stats.headings, 4, '文本里只有 4 个标题');
  assert.equal(p.stats.rows, 12, '库里却有 12 行');
  assert.equal(p.stats.matched, 3, '只有 3 行能在文本里找到');
  assert.equal(needsGuide(p.stats), true, '这时必须出引导条');

  writeTreeToText(doc.id);
  const after = projectOf(doc.id);
  assert.equal(after.stats.orphans + after.stats.missing, 0, '写回后两边应当对齐');
  assert.equal(needsGuide(after.stats), false, '引导条应当消失');
  assert.equal(rowsOf(doc.id).length, 12, '一行都不许删');
  assert.ok(!textOf(doc.id).includes('✅'));
});

finish('大纲同步');
