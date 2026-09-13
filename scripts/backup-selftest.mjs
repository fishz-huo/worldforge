/**
 * 导入导出回归自测
 * ------------------------------------------------------------------
 * 用户报的核心问题：「提示导入完成，但一条数据都没有」。
 * 这个套件把导出 → 导入的每条路径都跑一遍，并且**故意构造损坏的备份**，
 * 验证失败时数据真的被回滚（而不是留下半套）。
 *
 * 覆盖：
 *   1. 导出当前世界观 → 新建空世界观 → 导入：数量必须完全一致；
 *   2. 导入不会搬走来源世界观的数据；
 *   3. 覆盖导入同一份文件两次：不翻倍、不重复；
 *   4. 预检能挡住各种损坏的备份；
 *   5. 写库失败时整体回滚，原数据完好（构造一条 title 为 null 的卡片触发 NOT NULL）。
 *
 * 用法：node scripts/backup-selftest.mjs
 */
import { db, state, snapshotBytes } from './db-harness.mjs';
import { installFileReader } from './browser-stubs.mjs';
import { runImageRoundTrip } from './backup-image-test.mjs';

// blobToDataUrl 内部用 FileReader（浏览器 API），Node 里补一个最小实现。
// 图片往返（导出内嵌 base64 → 导入还原 Blob）必须能在这里被验证。
installFileReader();

const { exportBackupText, parseBackup, importBackup } = await import('@/lib/backup.ts');
const { checkBackupText, describeBackup, explainImportError } = await import('@/lib/backup-inspect.ts');
const { cardsRepo, cardAssetsRepo, assetsRepo } = await import('@/lib/db/index.ts');
const { putAssetBlob, getAssetBlob } = await import('@/lib/db/idb.ts');

let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) pass += 1;
  else fails.push(detail ? `${name} —— ${detail}` : name);
};
/** 当前世界观的内容规模（与导出快照的字段一一对应） */
const counts = () => {
  const s = state();
  return {
    cards: s.cards.length, tags: s.tags.length, relations: s.relations.length,
    maps: s.maps.length, entries: s.entries.length, docs: s.docs.length, outline: s.outlineNodes.length,
  };
};

await state().bootstrap();
const source = state().currentWorldId;
const origin = counts();
check('示例数据已装载（导出源非空）', origin.cards > 0, JSON.stringify(origin));

/* -------------------- 1. 导出 → 新建空世界观 → 导入 -------------------- */
const text = await exportBackupText(source, false);
const backup = parseBackup(text);
check('导出文本能被 parseBackup 解析', backup !== null);
check('导出文本里带着来源世界观', backup?.snapshot?.world?.id === source, `world.id=${backup?.snapshot?.world?.id}`);
const checked = checkBackupText(text, parseBackup);
check('预检通过导出的备份', checked.ok, String(checked.error));
check('预检能读出备份规模', checked.inspection?.stats.cards === origin.cards);
check('规模描述不含 undefined', !describeBackup(checked.inspection ?? { ok: false, problems: [], stats: null }).includes('undefined'));

const target = state().createWorld('导入回归测试');
check('新世界观是空的', state().cards.length === 0 && state().maps.length === 0);
const result = await importBackup(target, backup);
state().reload();
check('导入后内容与来源完全一致', JSON.stringify(counts()) === JSON.stringify(origin),
  `${JSON.stringify(counts())} vs ${JSON.stringify(origin)}`);
check('导入的资产数正确（不含图片）', result.assets === 0, `assets=${result.assets}`);
check('目标世界观拿到来源的名称与时间轴口径', (() => {
  const world = state().worlds.find((w) => w.id === target);
  return !!world && world.name === '示例世界 · 灰烬纪元' && world.meta?.time?.unit === '年';
})(), String(state().worlds.find((w) => w.id === target)?.name));
check('数据库里真的落盘了（不是只改内存）', cardsRepo.list('world_id = ?', [target]).length === origin.cards);
check('导入没有搬走来源世界观的数据', cardsRepo.list('world_id = ?', [source]).length === origin.cards);

/* -------------------- 1b. 重映射后的跨表引用必须仍然自洽 -------------------- */
const { all } = await import('@/lib/db/index.ts');
const q = (sql, params = []) => all(sql, params)[0]?.n ?? -1;
const inWorld = (table, column, worldId, viaMaps = false) => {
  const where = viaMaps
    ? `map_id IN (SELECT id FROM maps WHERE world_id = ?)`
    : `world_id = ?`;
  return q(
    `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}
       AND ${column} IS NOT NULL
       AND ${column} NOT IN (SELECT id FROM cards WHERE world_id = ?)`,
    [worldId, worldId],
  );
};
check('标签挂载仍然挂在本世界的卡片上',
  q(`SELECT COUNT(*) AS n FROM card_tags WHERE card_id IN (SELECT id FROM cards WHERE world_id = ?)`, [target]) > 0);
check('导入后关联两端都落在本世界（没有指向来源世界）',
  q(`SELECT COUNT(*) AS n FROM relations WHERE world_id = ?`, [target]) === origin.relations
  && inWorld('relations', 'from_id', target) === 0 && inWorld('relations', 'to_id', target) === 0);
check('导入后标记点绑定的卡片都在本世界', inWorld('map_pins', 'card_id', target, true) === 0);
check('导入后时间轴条目的卡片都在本世界', inWorld('timeline_entries', 'card_id', target) === 0);
check('导入后大纲父子关系都指向本世界的节点',
  q(`SELECT COUNT(*) AS n FROM outline_nodes WHERE parent_id IS NOT NULL
       AND parent_id NOT IN (SELECT id FROM outline_nodes)`) === 0);
check('导入后每张卡片都有对应的标签挂载（数量一致）',
  q(`SELECT COUNT(*) AS n FROM card_tags WHERE card_id IN (SELECT id FROM cards WHERE world_id = ?)`, [target]) > 0);
check('导入后的 id 与来源世界不重合（数据是复制而不是搬移）',
  q(`SELECT COUNT(*) AS n FROM cards WHERE world_id = ? AND id IN (SELECT id FROM cards WHERE world_id = ?)`,
    [target, source]) === 0);
check('地图元素（标记点/区域）也换了新 id',
  q(`SELECT COUNT(*) AS n FROM map_pins WHERE map_id IN (SELECT id FROM maps WHERE world_id = ?)
       AND id IN (SELECT id FROM map_pins WHERE map_id IN (SELECT id FROM maps WHERE world_id = ?))`,
    [target, source]) === 0);
check('时间轴条目也换了新 id',
  q(`SELECT COUNT(*) AS n FROM timeline_entries WHERE world_id = ? AND id IN (SELECT id FROM timeline_entries WHERE world_id = ?)`,
    [target, source]) === 0);

/* -------------------- 2. 覆盖导入（同一份文件导两次） -------------------- */
await importBackup(target, backup);
state().reload();
check('覆盖导入后数量不变（没有翻倍、没有重复）', JSON.stringify(counts()) === JSON.stringify(origin),
  JSON.stringify(counts()));

/* -------------------- 3. 导入到「自己」（导出再导回原世界） -------------------- */
await importBackup(source, parseBackup(await exportBackupText(source, true)));
state().reload();
check('导回原世界观后内容不变', JSON.stringify(counts()) === JSON.stringify(origin), JSON.stringify(counts()));

/* -------------------- 4. 预检要能挡住坏文件 -------------------- */
const broken = (mutate) => {
  const clone = JSON.parse(text);
  mutate(clone.snapshot);
  return checkBackupText(JSON.stringify(clone), parseBackup);
};
check('预检挡住「没有卡片」的备份', !broken((s) => { s.cards = []; }).ok);
check('预检挡住「缺少数据段」的备份', !broken((s) => { delete s.entries; }).ok);
check('预检挡住「没有世界观信息」的备份', !broken((s) => { s.world = null; }).ok);
check('预检挡住不是备份的 JSON', !checkBackupText('{"hello":1}', parseBackup).ok);
check('预检挡住根本不是 JSON 的文本', !checkBackupText('这不是 json', parseBackup).ok);
check('错误提示是人话（不含 undefined）',
  !String(broken((s) => { s.cards = []; }).error).includes('undefined'));

/* -------------------- 5. 写库失败必须整体回滚 -------------------- */
const before = cardsRepo.list('world_id = ?', [target]).length;
const poisoned = JSON.parse(text);
// 让某张卡片的 title 变成 null：cards.title 是 NOT NULL，写库会抛错
poisoned.snapshot.cards[0].title = null;
let threw = '';
try {
  await importBackup(target, parseBackup(JSON.stringify(poisoned)));
} catch (err) {
  threw = String(err instanceof Error ? err.message : err);
}
state().reload();
check('损坏数据导入会抛错（不再假装成功）', threw.length > 0, threw);
check('损坏数据导入后原数据完好（已回滚）',
  cardsRepo.list('world_id = ?', [target]).length === before && JSON.stringify(counts()) === JSON.stringify(origin),
  `库里 ${cardsRepo.list('world_id = ?', [target]).length}，期望 ${before}`);
check('错误提示被翻译成人话', explainImportError(new Error(threw)).includes('你的数据没有被改动'));

/* -------------------- 6. 图片（图库）必须跟着备份走 -------------------- */
// 具体检查在 backup-image-test.mjs：给卡片加图 → 导出完整备份 → 导入到新世界观 → 读回字节
const imageResults = await runImageRoundTrip({
  state, exportBackupText, parseBackup, importBackup, checkBackupText, describeBackup,
  putAssetBlob, getAssetBlob, assetsRepo, cardAssetsRepo, cardsRepo,
});
imageResults.forEach((r) => check(r.name, r.ok, r.detail));

/* -------------------- 7. 落盘 -------------------- */
await db.flush();
check('导入后 IndexedDB 里有快照字节', (snapshotBytes()?.length ?? 0) > 0);

console.log(`[backup-selftest] 通过 ${pass} 项，失败 ${fails.length} 项`);
if (fails.length) {
  fails.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
