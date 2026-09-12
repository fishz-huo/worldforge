/**
 * 数据层自测（一）：启动、播种、卡片 / 标签 / 关联、地图
 * ------------------------------------------------------------------
 * 用法：node scripts/db-selftest.mjs
 * 用真实 sql.js + 内存版 IndexedDB 跑通「本地优先」最关键的链路：
 * 建表 DDL → 首次播种 → 落盘 → 各类 CRUD。
 * 场景层（时间轴 / 文稿 / 分支）见 db-selftest-scene.mjs，
 * 版本快照与重启恢复见 db-selftest-persist.mjs。
 */
import { assert, finish, group, test } from './test-runner.mjs';
import { boot, db, snapshotBytes, state } from './db-harness.mjs';

group('启动与首次播种');

await test('初始化数据库并写入示例世界观', async () => {
  await boot();
  assert.equal(state().ready, true, 'store 应进入 ready 状态');
  assert.equal(state().error, '', `启动不应报错：${state().error}`);
  assert.equal(state().worlds.length, 1, '首次启动应有一个示例世界观');
  assert.ok(state().cards.length >= 8, `示例卡片应 >= 8，实际 ${state().cards.length}`);
  assert.ok(state().maps.length >= 1, '应有示例地图');
  assert.ok(state().tracks.length >= 4, '应有示例泳道');
  assert.ok(state().entries.length >= 8, '应有示例时间轴条目');
  assert.ok(state().docs.length >= 2, '应有正文与大纲各一篇');
  assert.equal(db.listTables().length, 19, '应建好 19 张表');
});

await test('落盘到 IndexedDB（写入二进制快照）', async () => {
  await db.flush();
  const bytes = snapshotBytes();
  assert.ok(bytes instanceof Uint8Array, '快照应为 Uint8Array');
  assert.ok(bytes.length > 10_000, `快照体积应可观，实际 ${bytes?.length}`);
});

group('卡片 / 标签 / 关联');

let cardId = '';

await test('新建卡片并写入数据库', () => {
  const card = state().createCard('character', { title: '测试角色', summary: '用于自测' });
  cardId = card.id;
  assert.ok(db.cardsRepo.get(cardId), '卡片应写入 cards 表');
  assert.equal(state().cards.filter((c) => c.id === cardId).length, 1, '内存态应同步');
});

await test('更新卡片字段（结构化字段 + 正文）', () => {
  state().updateCard(cardId, { body: '# 正文', fields: { birth_t: 200 } });
  const stored = db.cardsRepo.get(cardId);
  assert.equal(stored.body, '# 正文');
  assert.equal(stored.fields.birth_t, 200, 'fields 应完成 JSON 往返');
});

await test('标签：自由创建 + 关联 + 同名复用', () => {
  const tag = state().ensureTag('自测标签');
  assert.ok(db.tagsRepo.get(tag.id), '标签应写入 tags 表');
  state().setCardTagsOf(cardId, [tag.id]);
  const links = db.listAllCardTags(state().currentWorldId);
  assert.ok(links.some((l) => l.card_id === cardId && l.tag_id === tag.id), '卡片-标签关系应落库');
  assert.equal(state().ensureTag('自测标签').id, tag.id, '同名标签应复用而不是重复创建');
});

await test('关联：写入后双向可查', () => {
  const target = state().cards.find((c) => c.type === 'lore');
  state().addRelation({ from_id: cardId, to_id: target.id, label: '受制于' });
  assert.ok(state().relations.some((r) => r.from_id === cardId), '内存态应有该关联');
  assert.equal(db.relationsRepo.list('from_id = ?', [cardId]).length, 1, '关联应落库');
});

group('地图 / 标记 / 区域资源');

await test('新建地图 + 打点 + 画区域（资源 JSON 往返）', () => {
  const mapId = state().createMap('自测地图');
  assert.ok(db.mapsRepo.get(mapId), '地图应落库');
  const pinId = state().addPin(mapId, 0.3, 0.7, { label: '测试点' });
  assert.ok(db.pinsRepo.get(pinId), '标记应落库');
  const regionId = state().addRegion(mapId);
  state().updateRegion(regionId, { resources: { population: 123, agriculture: 45 } });
  const stored = db.regionsRepo.get(regionId);
  assert.equal(stored.resources.population, 123, '区域资源应完成 JSON 往返');
  assert.equal(stored.points.length, 4, '默认区域应有 4 个顶点');
});

await test('拖动区域顶点会写回数据库', () => {
  const region = state().regions.find((r) => r.map_id === state().selectedMapId);
  state().moveRegionPoint(region.id, 0, [0.11, 0.22]);
  const stored = db.regionsRepo.get(region.id);
  assert.deepEqual(stored.points[0], [0.11, 0.22], '顶点坐标应持久化');
});

group('图库与封面');

await test('删除图片时同步清掉封面引用（封面不再显示已删图片）', () => {
  const card = state().createCard('character', { title: '封面测试' });
  // 直接写资源与关联行：真实导入图片要走浏览器才有的解码能力，这里只验证引用关系
  db.assetsRepo.save({
    id: 'a-cover',
    world_id: state().currentWorldId,
    name: '封面图',
    mime: 'image/png',
    size: 1024,
    width: 100,
    height: 100,
    kind: 'image',
    created_at: 1700000000000,
  });
  const linkId = 'l-cover';
  db.cardAssetsRepo.save({ id: linkId, card_id: card.id, asset_id: 'a-cover', caption: '', order_index: 0 });
  state().reload();

  state().setCoverAsset(card.id, 'a-cover');
  assert.equal(db.cardsRepo.get(card.id).cover_asset, 'a-cover', '封面应已落库');

  // 曾经的 bug：只删关联行，cover_asset 仍指向已删除的图片，
  // 封面要么继续显示旧图（对象 URL 还在缓存里）要么变成空白占位。
  state().removeCardAsset(linkId);
  assert.equal(db.cardsRepo.get(card.id).cover_asset, null, '删除图片后封面引用必须清空');
  assert.equal(state().cards.find((c) => c.id === card.id).cover_asset, null, '内存态也应同步');

  db.assetsRepo.remove('a-cover');
});

await test('删除非封面的图片不会影响已设封面', () => {
  const card = state().createCard('character', { title: '多图卡片' });
  db.assetsRepo.save({
    id: 'a-keep', world_id: state().currentWorldId, name: '保留图', mime: 'image/png',
    size: 10, width: 10, height: 10, kind: 'image', created_at: 1700000000000,
  });
  db.assetsRepo.save({
    id: 'a-drop', world_id: state().currentWorldId, name: '待删图', mime: 'image/png',
    size: 10, width: 10, height: 10, kind: 'image', created_at: 1700000000001,
  });
  db.cardAssetsRepo.save({ id: 'l-keep', card_id: card.id, asset_id: 'a-keep', caption: '', order_index: 0 });
  db.cardAssetsRepo.save({ id: 'l-drop', card_id: card.id, asset_id: 'a-drop', caption: '', order_index: 1 });
  state().reload();

  state().setCoverAsset(card.id, 'a-keep');
  state().removeCardAsset('l-drop');
  assert.equal(db.cardsRepo.get(card.id).cover_asset, 'a-keep', '删掉别的图不应清掉封面');

  db.cardAssetsRepo.remove('l-keep');
  db.assetsRepo.remove('a-keep');
  db.assetsRepo.remove('a-drop');
});

await test('装载时自愈：悬空的封面引用会被清掉并落库', () => {
  const card = state().createCard('character', { title: '悬空封面' });
  // 直接写入一个指向不存在资源的封面，模拟旧版本删除图片后留下的脏数据
  db.cardsRepo.save({ ...db.cardsRepo.get(card.id), cover_asset: 'a-gone' });
  assert.equal(db.cardsRepo.get(card.id).cover_asset, 'a-gone', '前置条件：库里确有悬空引用');

  state().reload();

  assert.equal(state().cards.find((c) => c.id === card.id).cover_asset, null, '装载后悬空封面应被清空');
  assert.equal(db.cardsRepo.get(card.id).cover_asset, null, '自愈结果应落库，而不是只改内存');
});

group('插件记录（列名必须与字段名一致）');

await test('内置插件写入并从数据库读回后字段完整', () => {
  state().ensureBuiltinPlugins();
  assert.ok(state().plugins.length >= 4, `应有内置插件，实际 ${state().plugins.length}`);
  // 曾经的 bug：类型里字段写成驼峰 settingsSchema，而表列名是 settings_schema。
  // 通用仓储用列名当对象键，于是读回来的对象上根本没有这个属性，
  // 详情页 Object.keys(undefined) 抛 TypeError —— 「插件」模块整个白屏。
  for (const p of state().plugins) {
    assert.equal(typeof p.settings_schema, 'object', `插件「${p.name}」的 settings_schema 应为对象`);
    assert.notEqual(p.settings_schema, null, `插件「${p.name}」的 settings_schema 不应为 null`);
    assert.doesNotThrow(() => Object.keys(p.settings_schema), 'Object.keys 不应抛错');
  }
  // 图库灯箱的源码是 ?raw 从 plugins/ 读进来的：装不上就等于这个功能根本不存在
  const lightbox = state().plugins.find((p) => p.id === 'builtin.lightbox');
  assert.equal(lightbox?.enabled, 1, '图库灯箱应默认启用（见内置清单的 defaultEnabled）');
  assert.match(lightbox?.code ?? '', /data-wf-zoom/, '插件源码应来自 plugins/gallery-lightbox.js');
});

await test('非空的设置声明能完整往返（不被静默丢弃）', () => {
  const schema = { warnAt: { type: 'number', label: '预警线', default: 5000 } };
  const record = {
    id: 'selftest.plugin',
    name: '自测插件',
    version: '1.0.0',
    author: '自测',
    description: '往返测试',
    code: 'export function activate() {}',
    enabled: 1,
    builtin: 0,
    settings_schema: schema,
    settings: { warnAt: 3000 },
    created_at: 1700000000000,
  };
  db.pluginsRepo.save(record);
  const back = db.pluginsRepo.get('selftest.plugin');
  assert.deepEqual(back, record, '整条记录应逐字段等价往返');
  assert.deepEqual(back.settings_schema, schema, '设置声明不应被丢弃');
  db.pluginsRepo.remove('selftest.plugin');
});

finish('数据层·基础');
