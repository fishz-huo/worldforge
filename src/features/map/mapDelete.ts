/**
 * 删除快捷键的判定与文案（纯函数）
 * ==================================================================
 * 与 mapPan.isPanPress 同一类：这些判定算错了**不会报错**，只会表现成
 * 「按了没反应」或者「在输入框里按 Backspace 把地图上的东西删了」——
 * 所以从事件处理里抽出来，交给 map-delete-selftest 逐条钉住。
 *
 * 三条口径：
 *   1 只认 Delete 与 Backspace（主键盘与小键盘的 Delete 都是 'Delete'）；
 *   2 只有「正在打字的地方」才豁免（input / textarea / select / contenteditable，
 *     判定复用 mapPan 的 isEditableTarget）—— 焦点在按钮、下拉上时仍然算数，
 *     因为用户常常刚点过工具条就想删掉选中的东西；
 *   3 三个选中槽互斥（今天最多 1 个），将来支持框选后这里会自然变成多个。
 */

/** 这两个键都表示「删掉选中的东西」 */
export function isMapDeleteKey(key: string): boolean {
  return key === 'Delete' || key === 'Backspace';
}

/** 要删的目标：区域走 deleteRegion，标记与地形是同一张 map_pins（都走 deletePin） */
export interface MapDeleteTarget {
  kind: 'pin' | 'region' | 'terrain';
  id: string;
}

/** 三个选中槽 → 待删除清单（槽互斥：今天长度为 0 或 1） */
export function mapDeleteTargets(slots: {
  pin: string | null;
  region: string | null;
  terrain: string | null;
}): MapDeleteTarget[] {
  const targets: MapDeleteTarget[] = [];
  if (slots.pin) targets.push({ kind: 'pin', id: slots.pin });
  if (slots.region) targets.push({ kind: 'region', id: slots.region });
  if (slots.terrain) targets.push({ kind: 'terrain', id: slots.terrain });
  return targets;
}

/** 只选中 1 个时直接删（与检查器的删除按钮一致）；多个才弹这一句 */
export function mapDeleteConfirm(count: number): string {
  return `确定删除选中的 ${count} 个对象？`;
}
