/**
 * 自测（二十）：地图图层（列迁移 + 快照补全）
 * ------------------------------------------------------------------
 * 用法：node scripts/map-layer-selftest.mjs
 *
 * 这一层守的是**数据不会静默丢失**——v0.2 加图层时最容易出的两类事故：
 *   1. 列迁移漏了：老用户的库里 map_pins 没有 layer_id 列，
 *      一读就报 "no such column"，整个地图模块打不开；
 *   2. 快照漏了：图层不写进 buildSnapshot，导出/导入与版本还原之后
 *      底图整层消失，而标记与区域还在 —— 用户只会看到"图没了"。
 * 两条都属于"界面上看不出来、等到换台机器才发现"的问题，必须锁死。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, finish, group, test } from './test-runner.mjs';
import { boot, db, state } from './db-harness.mjs';

// 快照三个函数在 lib/snapshot.ts，不在 lib/db 里
const { buildSnapshot, restoreSnapshot, normalizeSnapshot } = await import('@/lib/snapshot.ts');

const ROOT = process.cwd();

group('列迁移');

await boot();

await test('迁移跑完之后没有缺失的列', () => {
  const missing = db.missingColumns();
  assert.deepEqual(missing, [], `仍缺列：${missing.join('、')}`);
});

await test('迁移是幂等的：再跑一遍不报错、也不重复加列', () => {
  const again = db.runColumnMigrations();
  assert.deepEqual(again, [], '第二次执行不应该再改动任何列');
});

await test('map_pins / map_regions 都有 layer_id 列', () => {
  const pinCols = db.all('PRAGMA table_info(map_pins)').map((r) => r.name);
  const regionCols = db.all('PRAGMA table_info(map_regions)').map((r) => r.name);
  assert.ok(pinCols.includes('layer_id'), `map_pins 缺 layer_id：${pinCols.join(',')}`);
  assert.ok(regionCols.includes('layer_id'), `map_regions 缺 layer_id：${regionCols.join(',')}`);
});

await test('迁移清单里每条都写清了理由（出问题能直接看懂）', () => {
  db.COLUMN_MIGRATIONS.forEach((m) => {
    assert.ok(m.why && m.why.length > 8, `${m.table}.${m.column} 缺少 why 说明`);
  });
});

group('建表语句与列迁移两边都覆盖到');

await test('schema-extra 的 DDL 里也有 layer_id（新库靠它，老库靠迁移）', () => {
  const ddl = readFileSync(join(ROOT, 'src/lib/db/schema-extra.ts'), 'utf8');
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS map_layers/);
  assert.match(ddl, /layer_id TEXT/);
});

await test('表名清单里有 map_layers', () => {
  assert.ok(db.TABLE_NAMES.includes('map_layers'), 'TABLE_NAMES 应包含 map_layers');
});

group('快照：图层不许被漏掉');

await test('快照带 layers 段，且新建的图层能进快照', () => {
  // 先确认快照结构里有这个键（旧版本没有，normalizeSnapshot 会补成空数组）
  const payload = buildSnapshot(state().currentWorldId);
  assert.ok(Array.isArray(payload.layers), '快照必须有 layers 数组');

  const mapId = state().createMap('图层自测地图');
  const layerId = state().addLayer(mapId, '地形层');
  state().updateLayer(layerId, { opacity: 0.4, visible: 0 });

  const after = buildSnapshot(state().currentWorldId);
  const saved = after.layers.find((l) => l.id === layerId);
  assert.ok(saved, '新建的图层必须出现在快照里');
  assert.equal(saved.opacity, 0.4);
  assert.equal(saved.visible, 0);
});

await test('还原快照后图层仍在（导出 → 导入不丢底图）', () => {
  const before = buildSnapshot(state().currentWorldId);
  const layerCount = before.layers.length;
  assert.ok(layerCount > 0, '前置条件：快照里应该有图层');

  restoreSnapshot(state().currentWorldId, before);
  const after = buildSnapshot(state().currentWorldId);
  assert.equal(after.layers.length, layerCount, '还原后图层数应一致');
});

await test('normalizeSnapshot 兼容旧快照（没有 layers 段时补空数组）', () => {
  const legacy = { schemaVersion: 1, world: null, branches: [], cards: [], tags: [], cardTags: [], cardAssets: [], relations: [], maps: [], pins: [], regions: [], tracks: [], entries: [], eras: [], docs: [], outlineNodes: [] };
  const fixed = normalizeSnapshot(legacy);
  assert.ok(Array.isArray(fixed.layers), '旧快照必须被补上 layers');
  assert.equal(fixed.layers.length, 0);
});

group('图层操作');

await test('删除图层不删层上的标记与区域，只是清掉归属', () => {
  const mapId = state().createMap('删层自测');
  const layerId = state().addLayer(mapId, '会被删掉的层');
  const pinId = state().addPin(mapId, 0.3, 0.4, { layer_id: layerId, label: '层上的标记' });
  const regionId = state().addRegion(mapId);
  state().assignRegionLayer(regionId, layerId);
  assert.equal(state().pins.find((p) => p.id === pinId).layer_id, layerId, '前置条件：标记应归属该层');

  state().deleteLayer(layerId);
  assert.equal(state().layers.some((l) => l.id === layerId), false, '图层应被删除');
  assert.ok(state().pins.some((p) => p.id === pinId), '标记必须保留');
  assert.equal(state().pins.find((p) => p.id === pinId).layer_id, null, '归属应被清空');
  assert.equal(state().regions.find((r) => r.id === regionId).layer_id, null, '区域归属也应被清空');
});

await test('上移下移只交换相邻两条的 order_index', () => {
  const mapId = state().createMap('排序自测');
  const a = state().addLayer(mapId, 'A');
  const b = state().addLayer(mapId, 'B');
  const orderOf = (id) => state().layers.find((l) => l.id === id).order_index;
  assert.ok(orderOf(a) < orderOf(b), '前置条件：A 在 B 下面');

  state().moveLayer(a, 1);
  assert.ok(orderOf(a) > orderOf(b), '上移后 A 应该在 B 上面');
  state().moveLayer(a, -1);
  assert.ok(orderOf(a) < orderOf(b), '下移后应还原');
});

await test('不透明度会被夹到 0~1（滑杆之外还可能被插件写脏）', () => {
  const mapId = state().createMap('不透明度自测');
  const id = state().addLayer(mapId);
  state().updateLayer(id, { opacity: 5 });
  assert.equal(state().layers.find((l) => l.id === id).opacity, 1);
  state().updateLayer(id, { opacity: -2 });
  assert.equal(state().layers.find((l) => l.id === id).opacity, 0);
  state().updateLayer(id, { opacity: 0.456 });
  assert.equal(state().layers.find((l) => l.id === id).opacity, 0.46);
});

finish('地图图层');
