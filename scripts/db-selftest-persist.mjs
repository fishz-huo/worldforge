/**
 * 数据层自测（三）：版本快照、重启恢复、级联删除
 * ------------------------------------------------------------------
 * 用法：node scripts/db-selftest-persist.mjs
 * 这三件事一旦出错就是「静默的数据丢失」，所以单独成篇：
 *   1. 存快照 → 大改 → 还原，必须回到原样；
 *   2. 关闭应用再打开（用快照重建数据库），数据必须还在；
 *   3. 删卡片要连带清理标签关系 / 关联 / 时间轴条目，不留孤儿数据。
 */
import { assert, finish, group, test } from './test-runner.mjs';
import { boot, db, snapshotBytes, state } from './db-harness.mjs';

await boot();

/** 固定一张被测卡片，后面的用例都以它为基准 */
const card = state().createCard('character', { title: '持久化测试角色', fields: { birth_t: 210 } });
const cardId = card.id;

group('版本快照与还原');

let versionId = '';

await test('保存快照', () => {
  versionId = state().createVersion('自测快照', '还原测试');
  assert.ok(db.versionsRepo.get(versionId), '快照应落库');
  const version = state().versions.find((v) => v.id === versionId);
  assert.ok(version.size > 0 && version.size < 2_000_000, `快照应较小，实际 ${version.size}`);
});

await test('多次修改后与快照对比能看出差异', () => {
  state().updateCard(cardId, { title: '被改坏的标题' });
  state().createCard('note', { title: '新增的卡片' });
  state().reload();

  const { parseSnapshot } = db;
  void parseSnapshot;
  const stored = state().versions.find((v) => v.id === versionId);
  const payload = JSON.parse(stored.snapshot);
  const inSnapshot = payload.cards.some((c) => c.id === cardId && c.title === '持久化测试角色');
  const current = db.cardsRepo.get(cardId).title;
  assert.ok(inSnapshot, '快照里应保留旧标题');
  assert.equal(current, '被改坏的标题', '当前设定应是新标题');
});

await test('还原快照：改动的标题恢复、新增的卡片消失', () => {
  const countBeforeRestore = state().cards.length;
  state().restoreVersion(versionId);
  assert.equal(db.cardsRepo.get(cardId).title, '持久化测试角色', '标题应还原');
  assert.ok(
    !state().cards.some((c) => c.title === '新增的卡片'),
    '快照之后新增的卡片应被移除',
  );
  assert.equal(state().cards.length, countBeforeRestore - 1, '卡片数量应回到快照状态');
});

group('持久化与重启恢复');

await test('落盘后用同一份快照重新建库能读回数据', async () => {
  await db.flush();
  const bytes = snapshotBytes();
  assert.ok(bytes.length > 0, '应存在数据库快照');

  // 模拟「关闭应用再打开」：替换数据库实例后重新读取
  await db.replaceWithBytes(new Uint8Array(bytes));
  const world = db.worldsRepo.list()[0];
  assert.ok(world, '重开后应能读到世界观');
  const cards = db.cardsRepo.list('world_id = ?', [world.id]);
  assert.ok(cards.length > 0, '重开后应能读到卡片');
  assert.ok(
    cards.every((c) => typeof c.fields === 'object' && c.fields !== null),
    'JSON 列应正确反序列化',
  );
  assert.equal(db.cardsRepo.get(cardId).fields.birth_t, 210, '结构化字段应完整保留');
});

group('级联删除');

await test('删除卡片会清理其标签、关联与时间轴条目', () => {
  const victim = state().createCard('note', { title: '待删除' });
  const tag = state().ensureTag('临时标签');
  state().setCardTagsOf(victim.id, [tag.id]);
  state().addRelation({ from_id: victim.id, to_id: cardId, label: '测试关联' });
  state().addEntry(state().tracks[0].id, { start_t: 1, card_id: victim.id, title: '临时条目' });
  state().addPin(state().maps[0].id, 0.5, 0.5, { card_id: victim.id, label: '临时标记' });

  state().deleteCard(victim.id);

  assert.equal(db.cardsRepo.get(victim.id), undefined, '卡片应被删除');
  assert.equal(db.relationsRepo.list('from_id = ?', [victim.id]).length, 0, '关联应被清理');
  assert.equal(db.entriesRepo.list('card_id = ?', [victim.id]).length, 0, '时间轴条目应被清理');
  assert.equal(
    db.listAllCardTags(state().currentWorldId).filter((l) => l.card_id === victim.id).length,
    0,
    '标签关系应被清理',
  );
  // 地图标记不删除，而是解绑，避免用户丢失地理位置信息
  const pin = db.pinsRepo.list('label = ?', ['临时标记'])[0];
  assert.ok(pin, '地图标记应保留');
  assert.equal(pin.card_id, null, '地图标记应变为未绑定状态');
});

await test('删除地图会清理其标记与区域', () => {
  const mapId = state().createMap('待删除地图');
  state().addPin(mapId, 0.2, 0.2, { label: '临时点' });
  state().addRegion(mapId);
  state().deleteMap(mapId);
  assert.equal(db.mapsRepo.get(mapId), undefined, '地图应被删除');
  assert.equal(db.pinsRepo.list('map_id = ?', [mapId]).length, 0, '标记应被清理');
  assert.equal(db.regionsRepo.list('map_id = ?', [mapId]).length, 0, '区域应被清理');
});

finish('数据层·持久化');
