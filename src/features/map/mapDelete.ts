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
 *   3 待删清单来自**选中集**（2026-09-26 起框选可以一次选中多个），
 *     一个对象一条；区域走 deleteRegion，标记与地形都是 map_pins 的行。
 */
import type { MapSelectionItem, MapSelectionKind } from './mapSelection';

/** 这两个键都表示「删掉选中的东西」 */
export function isMapDeleteKey(key: string): boolean {
  return key === 'Delete' || key === 'Backspace';
}

/** 要删的目标：区域走 deleteRegion，标记与地形是同一张 map_pins（都走 deletePin） */
export interface MapDeleteTarget {
  kind: 'pin' | 'region' | 'terrain';
  id: string;
}

/**
 * 选中集 → 待删除清单：按「标记 → 区域 → 地形」排好并去重。
 * 删除本身与顺序无关，但顺序固定下来才能把「一条不多、一条不少」钉在自测里。
 */
export function mapDeleteTargets(items: MapSelectionItem[]): MapDeleteTarget[] {
  const rank: MapSelectionKind[] = ['pin', 'region', 'terrain'];
  const out: MapDeleteTarget[] = [];
  for (const kind of rank) {
    for (const item of items) {
      if (item.kind === kind && !out.some((t) => t.kind === kind && t.id === item.id)) {
        out.push({ kind, id: item.id });
      }
    }
  }
  return out;
}

/** 只选中 1 个时直接删（与检查器的删除按钮一致）；多个才弹这一句 */
export function mapDeleteConfirm(count: number): string {
  return `确定删除选中的 ${count} 个对象？`;
}
