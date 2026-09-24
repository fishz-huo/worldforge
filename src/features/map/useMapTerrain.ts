/**
 * 地形符号的读写（组件里唯一动地形 meta 的入口）
 * ==================================================================
 * 两个容易踩的点都在这里收口，别处不再自己拼 meta：
 *   1. **落一个符号要写两次**：store 的 `addPin` 只认 card_id / label / icon /
 *      color / note（**本轮不许动 store**），所以 meta 必须紧跟一次 `updatePin`
 *      补上。两次 set 在同一个事件回调里，React 18 会合并成一次渲染，
 *      用户看不到"先是个普通图钉、再变成地形"的中间态。
 *   2. **换符号要连名字与颜色一起换**：否则会出现"河流的图形配森林的绿"。
 */
import { useCallback } from 'react';
import type { MapPin } from '@/types';
import { useStore } from '@/store';
import type { TerrainMeta, TerrainSymbol } from './mapTerrain';
import { makeTerrainMeta, readTerrain, terrainDef } from './mapTerrain';

export function useMapTerrain() {
  const addPin = useStore((s) => s.addPin);
  const updatePin = useStore((s) => s.updatePin);
  const deletePin = useStore((s) => s.deletePin);

  /** 在地图 (x,y) 落一个符号，返回新行 id（笔刷要拿它立刻跟手） */
  const place = useCallback(
    (mapId: string, symbol: TerrainSymbol, x: number, y: number): string => {
      const def = terrainDef(symbol);
      const id = addPin(mapId, x, y, { label: def.label, icon: def.key, color: def.color });
      updatePin(id, { meta: makeTerrainMeta(def.key) });
      return id;
    },
    [addPin, updatePin],
  );

  /** 改 meta 里的若干键（其余键保持不动） */
  const patch = useCallback(
    (pin: MapPin, next: Partial<TerrainMeta>) => {
      const cur = readTerrain(pin) ?? makeTerrainMeta('mountain');
      updatePin(pin.id, { meta: { ...cur, ...next } });
    },
    [updatePin],
  );

  /** 换符号：图形、中文名、默认色一起换 */
  const changeSymbol = useCallback(
    (pin: MapPin, symbol: TerrainSymbol) => {
      const def = terrainDef(symbol);
      const cur = readTerrain(pin) ?? makeTerrainMeta(symbol);
      updatePin(pin.id, { label: def.label, icon: def.key, color: def.color, meta: { ...cur, symbol: def.key } });
    },
    [updatePin],
  );

  return { place, patch, changeSymbol, remove: deletePin };
}
