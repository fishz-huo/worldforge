/**
 * 地图选中集（纯数据，有自测）
 * ==================================================================
 * 2026-09-26 之前「选中谁」是三个**互斥的槽**（图钉 / 区域 / 地形各一个 useState）；
 * 加了 CAD 式框选之后一次可以选中好几个，于是改成**一条 items 清单**当唯一真相，
 * 三个槽退化成派生值（各图层的高亮 id 清单，见 useMapSelection）。
 *
 * 为什么值得单独一个文件：清点数量、追加去重、删除目标这三件事算错了都不会报错，
 * 只会表现成「框了 3 个，检查器说 4 个」「Shift 追加把原来的选中弄丢了」，
 * 所以抽成纯函数交给 map-marquee-selftest 逐条钉住。
 */

/** 地图上可被选中的三类对象（地形是 map_pins 的另一种行，与标记分开数） */
export type MapSelectionKind = 'pin' | 'region' | 'terrain';

export interface MapSelectionItem {
  kind: MapSelectionKind;
  id: string;
}

/** 去重用的键 */
export function selectionKey(item: MapSelectionItem): string {
  return `${item.kind}:${item.id}`;
}

/** 按种类清点：检查器那一行「已选中 N 个对象（标记 x · 区域 y · 地形 z）」用它 */
export function selectionCounts(items: MapSelectionItem[]): {
  total: number;
  pin: number;
  region: number;
  terrain: number;
} {
  const counts = { total: items.length, pin: 0, region: 0, terrain: 0 };
  for (const item of items) counts[item.kind] += 1;
  return counts;
}

/** 按 kind+id 去重（保持首次出现的顺序） */
export function dedupeItems(items: MapSelectionItem[]): MapSelectionItem[] {
  const seen = new Set<string>();
  const out: MapSelectionItem[] = [];
  for (const item of items) {
    const key = selectionKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * 框选提交用的合并：additive（按住 Shift）＝ 追加去重、原有选中排在前；
 * 否则整体替换（按新框的结果）。
 */
export function mergeItems(
  prev: MapSelectionItem[],
  next: MapSelectionItem[],
  additive: boolean,
): MapSelectionItem[] {
  if (!additive) return dedupeItems(next);
  const seen = new Set(prev.map(selectionKey));
  const out = [...prev];
  for (const item of next) {
    const key = selectionKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
