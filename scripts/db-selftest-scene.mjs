/**
 * 数据层自测（二）：时间轴、文稿与大纲、平行世界分支
 * ------------------------------------------------------------------
 * 用法：node scripts/db-selftest-scene.mjs
 * 关注「设定之间如何连起来」：卡片 → 时间轴条目、正文标题 → 大纲树、
 * 主世界 → 平行世界分支的复制与清理。
 */
import { assert, finish, group, test } from './test-runner.mjs';
import { boot, db, state } from './db-harness.mjs';

await boot();

group('时间轴');

await test('泳道 + 条目（含绑定卡片与数值）', () => {
  const trackId = state().createTrack('自测泳道', 'tech');
  const entryId = state().addEntry(trackId, { start_t: 100, end_t: 150, title: '测试阶段', value: 60 });
  const stored = db.entriesRepo.get(entryId);
  assert.equal(stored.start_t, 100);
  assert.equal(stored.end_t, 150);
  assert.equal(stored.instant, 0, '有结束刻度时不应是瞬时事件');
  assert.equal(stored.value, 60, '数值型泳道的数值应落库');
});

await test('清空结束刻度自动转为瞬时事件', () => {
  const track = state().tracks.find((t) => t.name === '自测泳道');
  const entryId = state().addEntry(track.id, { start_t: 10, end_t: 20, title: '区间' });
  state().updateEntry(entryId, { end_t: null });
  assert.equal(db.entriesRepo.get(entryId).instant, 1, '应自动标记为瞬时事件');
});

await test('从角色卡生成时间轴条目（取出生刻度）', () => {
  const card = state().createCard('character', { title: '年龄测试角色', fields: { birth_t: 200 } });
  const track = state().tracks.find((t) => t.kind === 'character') ?? state().tracks[1];
  const entryId = state().entryFromCard(card.id, track.id);
  assert.ok(entryId, '应成功生成条目');
  const entry = db.entriesRepo.get(entryId);
  assert.equal(entry.card_id, card.id);
  assert.equal(entry.start_t, 200, '应取角色卡的出生刻度');
});

await test('从事件卡生成条目（取起止刻度）', () => {
  const card = state().createCard('event', { title: '区间事件', fields: { start_t: 30, end_t: 40 } });
  const track = state().tracks.find((t) => t.kind === 'event');
  const entryId = state().entryFromCard(card.id, track.id);
  const entry = db.entriesRepo.get(entryId);
  assert.equal(entry.start_t, 30);
  assert.equal(entry.end_t, 40);
  assert.equal(entry.instant, 0);
});

group('文稿与大纲');

await test('大纲：从文本标题重建树（保留父子关系）', () => {
  const outlineDoc = state().docs.find((d) => d.kind === 'outline');
  state().updateDoc(outlineDoc.id, { content: '# 一\n## 一甲\n### 一甲一\n# 二' });
  const count = state().outlineFromText(outlineDoc.id);
  assert.equal(count, 4, '应解析出 4 个节点');
  const nodes = db.outlineRepo.list('doc_id = ?', [outlineDoc.id]);
  assert.equal(nodes.length, 4);
  const deep = nodes.find((n) => n.title === '一甲一');
  const mid = nodes.find((n) => n.title === '一甲');
  assert.equal(deep.parent_id, mid.id, '层级关系应正确');
});

await test('大纲：重建时保留已有状态与卡片挂接', () => {
  const outlineDoc = state().docs.find((d) => d.kind === 'outline');
  const node = state().outlineNodes.find((n) => n.doc_id === outlineDoc.id && n.title === '一甲');
  state().updateOutlineNode(node.id, { status: 'done' });
  state().outlineFromText(outlineDoc.id);
  const after = state().outlineNodes.find((n) => n.doc_id === outlineDoc.id && n.title === '一甲');
  assert.equal(after.status, 'done', '同名节点应保留状态');
});

await test('大纲：树写回文本', () => {
  const outlineDoc = state().docs.find((d) => d.kind === 'outline');
  state().textFromOutline(outlineDoc.id);
  const content = state().docs.find((d) => d.id === outlineDoc.id).content;
  assert.match(content, /^# 一/m);
  assert.match(content, /^### 一甲一/m);
});

await test('大纲节点：降级 / 提升 / 删除带子节点', () => {
  const doc = state().docs.find((d) => d.kind === 'outline');
  const root = state().addOutlineNode(doc.id, null, '父');
  const child = state().addOutlineNode(doc.id, root, '子');
  const grand = state().addOutlineNode(doc.id, child, '孙');
  state().deleteOutlineNode(child);
  assert.ok(!state().outlineNodes.some((n) => n.id === child), '子节点应被删除');
  assert.ok(!state().outlineNodes.some((n) => n.id === grand), '孙节点应被级联删除');
});

group('平行世界分支');

await test('派生分支会复制主世界可见卡片，删除时清理干净', () => {
  const before = state().cards.length;
  const branchId = state().forkBranch('自测 if 线', '第 245 年分歧');
  state().reload();
  const branchCards = state().cards.filter((c) => c.branch_id === branchId);
  assert.ok(branchCards.length > 0, '分支应包含复制过来的卡片');
  assert.ok(state().cards.length > before, '卡片总数应增加');
  assert.ok(db.branchesRepo.get(branchId), '分支应落库');

  state().deleteBranch(branchId);
  state().reload();
  assert.equal(state().cards.filter((c) => c.branch_id === branchId).length, 0, '删除分支应清理其卡片');
  assert.equal(db.cardsRepo.list('branch_id = ?', [branchId]).length, 0, '数据库里也不应残留');
});

await test('新建分支不影响主世界卡片', () => {
  const mainCards = state().cards.filter((c) => c.branch_id === null).length;
  const branchId = state().createBranch('空分支');
  assert.equal(state().cards.filter((c) => c.branch_id === null).length, mainCards, '主世界卡片不应变化');
  assert.equal(state().cards.filter((c) => c.branch_id === branchId).length, 0, '新分支应为空');
  state().deleteBranch(branchId);
});

finish('数据层·场景');
