/**
 * 自测（二十八）：地形符号（数据与数学）
 * ------------------------------------------------------------------
 * 用法：node scripts/map-terrain-selftest.mjs
 *
 * 地形有两处「错了也不报错」，只能靠这里逐条验：
 *   1. 数学（大小 / 角度）：手感不对但不会抛错，肉眼也验不准；
 *   2. 数据（meta 列）：仓储只写表描述里列出的列，多出来的字段**静默丢弃** ——
 *      DDL / 列迁移 / PIN_SPEC / 类型四处少写一处，就是"保存成功但数据不见了"。
 * 所以除了纯函数，这里用真 sql.js 跑一遍数据安全：老库（删掉 meta 列）→ 幂等迁移
 * 补回 → 老行九个原列逐字不变；老备份行（没有 meta 键）照旧能存能读；版本快照
 * 清空后还原仍在；落盘字节里也查得到 meta。
 */
import { assert, finish, group, test } from './test-runner.mjs';
import { boot, db, snapshotBytes, state } from './db-harness.mjs';

const T = await import('@/features/map/mapTerrain.ts');
const S = await import('@/lib/snapshot.ts');

const near = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${msg}（实际 ${a}，期望 ${b}）`);

group('符号表');

await test('十个符号：键唯一、都有中文名与颜色；认不出的一律回落成山脉', () => {
  assert.equal(T.TERRAIN_SYMBOLS.length, 10, '需求列了十个符号');
  const keys = new Set(T.TERRAIN_SYMBOLS.map((d) => d.key));
  assert.equal(keys.size, 10, '键不能重复');
  T.TERRAIN_SYMBOLS.forEach((d) => {
    assert.ok(d.label.length >= 2, `${d.key} 应有中文名`);
    assert.match(d.color, /^#[0-9a-f]{6}$/, `${d.key} 的默认色应是十六进制`);
  });
  assert.equal(T.terrainDef('river').color, T.terrainDef('lake').color, '河流与湖泊同一档蓝');
  assert.equal(T.terrainDef('forest').color, '#15803d');
  assert.equal(T.isTerrainSymbol('swamp'), true);
  assert.equal(T.isTerrainSymbol('volcano'), false);
  assert.equal(T.isTerrainSymbol(undefined), false, 'undefined 不能当成合法符号');
  assert.equal(T.isTerrainSymbol(7), false, '非字符串也不能');
  assert.equal(T.terrainDef('nope').key, 'mountain', '认不出回落成第一个');
  assert.equal(T.terrainDef(undefined).key, 'mountain');
});

group('大小与角度（纯函数）');

await test('大小夹取到 0.5~3，并对齐到 0.05', () => {
  assert.equal(T.clampSize(1), 1);
  near(T.clampSize(0.1), T.TERRAIN_SIZE_MIN, '太小夹到下限');
  near(T.clampSize(9), T.TERRAIN_SIZE_MAX, '太大夹到上限');
  near(T.clampSize(1.0666), 1.05, '对齐到 0.05');
  near(T.clampSize(1.1500000000000001), 1.15, '不写出浮点尾数');
  assert.equal(T.clampSize(Number.NaN), 1, 'NaN 回落成 1');
});

await test('角度归一到 0~359 的整数度', () => {
  assert.equal(T.normRotation(0), 0);
  assert.equal(T.normRotation(-30), 330, '负角绕回来');
  assert.equal(T.normRotation(400), 40, '超过一圈也收进来');
  assert.equal(T.normRotation(360), 0);
  assert.equal(T.normRotation(12.6), 13, '四舍五入到整度');
  assert.equal(T.normRotation(Number.NaN), 0);
});

await test('指针角度：正上 0°、正右 90°、正下 180°、正左 270°（与 CSS rotate 同向）', () => {
  assert.equal(T.angleFrom(100, 100, 100, 50), 0, '正上方');
  assert.equal(T.angleFrom(100, 100, 150, 100), 90, '正右方');
  assert.equal(T.angleFrom(100, 100, 100, 150), 180, '正下方');
  assert.equal(T.angleFrom(100, 100, 50, 100), 270, '正左方');
  assert.equal(T.angleFrom(100, 100, 150, 50), 45, '右上 45°');
});

await test('拖缩放手柄按半径比例走：按下时不动，拉远加倍', () => {
  near(T.scaleFromDrag(1, 50, 50), 1, '按下那一帧不跳');
  near(T.scaleFromDrag(1, 50, 100), 2, '半径翻倍 → 大小翻倍');
  near(T.scaleFromDrag(2, 50, 25), 1, '半径减半 → 大小减半');
  near(T.scaleFromDrag(1, 0, 999), T.TERRAIN_SIZE_MAX, '手柄贴中心时不炸，夹到上限');
  near(T.scaleFromDrag(1, 50, 1), T.TERRAIN_SIZE_MIN, '缩到很小夹到下限');
});

await test('本地偏移按旋转角转世界坐标（控制点要贴在框的角上）', () => {
  const [x0, y0] = T.rotateOffset(10, 0, 0);
  near(x0, 10, '0° 不动');
  near(y0, 0, '0° 不动');
  const [x90, y90] = T.rotateOffset(10, 0, 90);
  near(x90, 0, '顺时针 90° 后 (10,0) 转到正下方');
  near(y90, 10, '顺时针 90° 后 (10,0) 转到正下方');
  const [x180] = T.rotateOffset(10, 0, 180);
  near(x180, -10, '180° 反向');
});

group('meta 读写');

await test('地形 meta 的构造与读取', () => {
  const meta = T.makeTerrainMeta('forest', 1.6, 350);
  assert.deepEqual(meta, { kind: 'terrain', symbol: 'forest', size: 1.6, rotation: 350 });
  assert.deepEqual(T.readTerrain({ meta }), meta, '读回来逐字段一致');
});

await test('不是地形的行一律返回 null（老数据是空对象）', () => {
  assert.equal(T.readTerrain({ meta: {} }), null, '普通图钉');
  assert.equal(T.readTerrain({}), null, '老行没有 meta 键');
  assert.equal(T.readTerrain({ meta: { kind: 'pin', symbol: 'forest' } }), null, 'kind 不对');
  assert.equal(T.readTerrain({ meta: { kind: 'terrain', symbol: 'volcano' } }), null, '符号不认识');
  assert.equal(T.readTerrain({ meta: { kind: 'terrain', symbol: 'lake' } }).size, 1, '缺 size 用 1');
  assert.equal(T.readTerrain({ meta: { kind: 'terrain', symbol: 'lake' } }).rotation, 0, '缺 rotation 用 0');
});

await test('坏了的值不抛错：size/rotation 是字符串或越界都收进合法范围', () => {
  const back = T.readTerrain({ meta: { kind: 'terrain', symbol: 'lake', size: '9', rotation: '-90' } });
  assert.equal(back.size, T.TERRAIN_SIZE_MAX, '字符串也认，并夹到上限');
  assert.equal(back.rotation, 270, '负角绕回来');
  assert.equal(T.isTerrainPin({ meta: { kind: 'terrain', symbol: 'pass', size: null, rotation: null } }), true);
});

group('数据安全（老库 / 老备份 / 快照）');

let mapId = '';
let legacyId = '';

await test('准备：一张地图 + 一条老标记', async () => {
  await boot();
  mapId = state().createMap('地形自测地图');
  legacyId = state().addPin(mapId, 0.37, 0.62, { label: '老标记', icon: 'city', color: '#123456', note: '旧备注' });
  assert.ok(db.pinsRepo.get(legacyId), '标记应落库');
  assert.deepEqual(db.pinsRepo.get(legacyId).meta, {}, '普通图钉的 meta 是空对象');
});

await test('老库模拟：删掉 meta 列 → 幂等迁移补回来', () => {
  db.run('ALTER TABLE map_pins DROP COLUMN meta');
  assert.deepEqual(db.missingColumns(), ['map_pins.meta'], '此时应缺这一列');
  assert.deepEqual(db.runColumnMigrations(), ['map_pins.meta'], '第一次跑要真的加列');
  assert.deepEqual(db.runColumnMigrations(), [], '第二次跑必须什么都不做（幂等）');
  assert.deepEqual(db.missingColumns(), []);
});

await test('加列不动老数据：九个原列逐字不变，新列取默认值', () => {
  const row = db.all('SELECT * FROM map_pins WHERE id = ?', [legacyId])[0];
  assert.equal(row.map_id, mapId);
  assert.equal(row.layer_id, null);
  assert.equal(row.card_id, null);
  assert.equal(row.x, 0.37);
  assert.equal(row.y, 0.62);
  assert.equal(row.label, '老标记');
  assert.equal(row.icon, 'city');
  assert.equal(row.color, '#123456');
  assert.equal(row.note, '旧备注');
  assert.equal(row.meta, '{}', '新列默认空对象');
  assert.deepEqual(db.pinsRepo.get(legacyId).meta, {}, '读回来是空对象而不是 null');
});

await test('老备份里的标记行（没有 meta 键）照旧能存能读', () => {
  db.pinsRepo.saveMany([{
    id: 'pin-legacy-1', map_id: mapId, layer_id: null, card_id: null,
    x: 0.1, y: 0.2, label: '旧备份标记', icon: '📍', color: '#ef4444', note: '',
  }]);
  const back = db.pinsRepo.get('pin-legacy-1');
  assert.equal(back.label, '旧备份标记');
  assert.equal(back.x, 0.1);
  assert.deepEqual(back.meta, {}, '缺 meta 的行按空对象读回');
});

let terrainId = '';
let terrainMeta = null;

await test('地形行写进库再读回来，meta 完成 JSON 往返', () => {
  terrainId = state().addPin(mapId, 0.5, 0.5, { label: '山脉', icon: 'mountain', color: '#334155' });
  terrainMeta = T.makeTerrainMeta('mountain', 1.7, 42);
  state().updatePin(terrainId, { meta: terrainMeta });
  const back = db.pinsRepo.get(terrainId).meta;
  assert.deepEqual(back, terrainMeta, 'meta 应逐字段往返');
  assert.deepEqual(T.readTerrain({ meta: back }), terrainMeta, '读出来就是地形');
  assert.equal(db.pinsRepo.get(legacyId).meta.kind, undefined, '同一张表里的普通图钉不受影响');
});

await test('版本快照带上地形，清空内容后还原仍在', () => {
  const worldId = state().currentWorldId;
  const snap = S.buildSnapshot(worldId);
  const row = snap.pins.find((p) => p.id === terrainId);
  assert.deepEqual(row.meta, terrainMeta, '快照里的 meta 要完整');

  S.clearWorldContent(worldId);
  assert.equal(db.pinsRepo.get(terrainId), undefined, '清空后确实没了');
  S.restoreSnapshot(worldId, S.normalizeSnapshot(snap));
  assert.deepEqual(db.pinsRepo.get(terrainId).meta, terrainMeta, '还原后地形原样回来');
  assert.deepEqual(db.pinsRepo.get(legacyId).meta, {}, '老标记还原后仍是空对象');
});

await test('落盘的快照字节里查得到 meta（重启恢复走的是同一份字节）', async () => {
  await db.flush();
  const bytes = snapshotBytes();
  assert.ok(bytes && bytes.length > 10_000, `快照应有可观体积，实际 ${bytes?.length}`);
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs();
  const fresh = new SQL.Database(bytes);
  const rows = fresh.exec('SELECT meta FROM map_pins WHERE id = ?', [terrainId]);
  assert.equal(rows[0].values[0][0], JSON.stringify(terrainMeta), '快照里这一行带着地形信息');
  fresh.close();
});

finish('地形符号');
