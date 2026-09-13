/**
 * 图片（图库）往返自测
 * ------------------------------------------------------------------
 * 真实缺陷（用户实测）：给卡片加上图库图片 → 导出完整备份 → 导入到另一个世界观，
 * 图库是空的，只能看到「图片已丢失」。文本数据却完好。
 *
 * 根因：`buildSnapshot()` 从一开始就没把 `card_assets`（卡片↔图片的挂载关系）
 * 放进快照 —— 图片元数据与二进制都在，唯独「哪张图挂在哪张卡片上」丢了。
 * 同一个疏漏也让「版本还原」会清空所有图库。
 *
 * 这个套件用真实字节走完整链路：写 IndexedDB → 写元数据 → 导出（内嵌 base64）
 * → 导入到新世界观 → 读回 Blob 并核对字节数。
 *
 * 用法：node scripts/backup-image-test.mjs（由 backup-selftest.mjs 调用）
 */
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

/** 一张真实的 1×1 PNG（70 字节），足够验证字节级往返 */
export function tinyPng() {
  return new Blob([Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0))], { type: 'image/png' });
}

/**
 * 跑一遍图片往返。
 * @param deps 由 backup-selftest.mjs 注入的真实模块与工具
 * @returns 检查项数组 [{ name, ok, detail }]
 */
export async function runImageRoundTrip(deps) {
  const {
    state, exportBackupText, parseBackup, importBackup, checkBackupText, describeBackup,
    putAssetBlob, getAssetBlob, assetsRepo, cardAssetsRepo, cardsRepo,
  } = deps;
  const out = [];
  const check = (name, ok, detail = '') => out.push({ name, ok: Boolean(ok), detail });

  const png = tinyPng();
  const sourceWorld = state().currentWorldId;
  const card = state().cards[0];
  const assetId = 'asset-image-test';
  const linkId = 'link-image-test';

  // 模拟「给卡片添加图库图片」：二进制入 IndexedDB，元数据入 assets，挂载入 card_assets
  await putAssetBlob(assetId, png);
  assetsRepo.save({
    id: assetId, world_id: sourceWorld, name: '测试图.png', mime: 'image/png',
    size: png.size, width: 1, height: 1, kind: 'image', created_at: Date.now(),
  });
  cardAssetsRepo.save({ id: linkId, card_id: card.id, asset_id: assetId, caption: '', order_index: 0 });
  state().reload();

  const backup = parseBackup(await exportBackupText(sourceWorld, true));
  check('导出完整备份会内嵌图片二进制', backup.assets?.length === 1, `assets=${backup.assets?.length}`);
  check('导出完整备份会带上图库挂载（card_assets）',
    backup.snapshot.cardAssets?.length === 1, `cardAssets=${backup.snapshot.cardAssets?.length}`);
  check('导出的是有效 dataURL', String(backup.assets?.[0]?.dataUrl).startsWith('data:image/png;base64,'));

  const target = state().createWorld('图片往返测试');
  const imported = await importBackup(target, backup);
  state().reload();
  check('导入会还原图片数量', imported.assets === 1, `assets=${imported.assets}`);
  check('导入后图库挂载还在（旧版本会丢这一段）',
    state().cardAssets.length === 1, `cardAssets=${state().cardAssets.length}`);

  const link = state().cardAssets[0];
  const blob = await getAssetBlob(link?.asset_id ?? '');
  check('导入后图库指向的图片二进制能读回来（字节数一致）', blob?.size === png.size,
    `实际 ${blob?.size ?? '无'}B，期望 ${png.size}B`);
  check('导入后 assets 元数据也在（否则界面显示「图片已丢失」）',
    state().assets.some((a) => a.id === link?.asset_id && a.size === png.size));
  check('导入后挂载指向的是本世界的卡片',
    cardsRepo.list('world_id = ?', [target]).some((c) => c.id === link?.card_id));

  const again = parseBackup(await exportBackupText(target, true));
  check('二次导出仍然带着图片与挂载',
    again.assets?.length === 1 && again.snapshot.cardAssets?.length === 1,
    `assets=${again.assets?.length} cardAssets=${again.snapshot.cardAssets?.length}`);

  // 旧版本导出的备份正是「有图片、没有挂载」（cardAssets 字段根本不存在），
  // 导入时不能崩，还要能在确认框里提醒用户
  const legacy = JSON.parse(await exportBackupText(target, true));
  delete legacy.snapshot.cardAssets;
  const legacyCheck = checkBackupText(JSON.stringify(legacy), parseBackup);
  const described = describeBackup(legacyCheck.inspection);
  check('旧备份（没有 cardAssets 字段）仍能通过预检（只是会提醒）', legacyCheck.ok, String(legacyCheck.error));
  check('预检会说明「旧备份的图片挂载没备份进去」',
    (legacyCheck.inspection?.warnings ?? []).join('；').includes('旧版本导出的备份'),
    JSON.stringify(legacyCheck.inspection?.warnings));
  check('图片存在但没有挂载时，描述会提醒', described.includes('没有任何图片挂在卡片上'), described);

  const legacyTarget = state().createWorld('旧备份导入测试');
  const legacyResult = await importBackup(legacyTarget, parseBackup(JSON.stringify(legacy)));
  state().reload();
  check('旧备份仍能导入成功（图片照常写入，只是没有挂载）',
    legacyResult.assets === 1 && cardsRepo.list('world_id = ?', [legacyTarget]).length > 0,
    `assets=${legacyResult.assets}`);
  check('旧备份导入后图库为空但其它数据完好（不会连图片一起丢）',
    state().cardAssets.length === 0 && state().assets.some((a) => a.id === assetId));

  return out;
}
