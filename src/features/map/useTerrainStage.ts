/**
 * 地形笔刷与写入（模块级的一小块状态）
 * ==================================================================
 * 从 MapModule 抽出来：笔刷状态、Esc 退出、落点、改 meta 四件事加在一起，
 * 那个文件就顶到 200 行以上了。
 *
 * 笔刷是**独立状态**，不是 MapTool 的第五个值（越界项 C 未批准）：它与
 * 「选择/打点/区域/平移」正交，因此退出笔刷的时机由调用方决定（换工具、
 * 切预览），这里只负责「按 Esc 放下」。
 *
 * 落点是最讲究的一处：store 的 addPin 只认 5 个字段（不动 store），所以
 * 落下的那一行先是个普通标记，紧跟一次 updatePin 才成为地形 —— 两次 set 在
 * 同一个事件回调里，React 18 合并成一次渲染（用户看不到中间态）。
 */
import { useCallback, useEffect, useState } from 'react';
import type { MapDef, MapPin } from '@/types';
import type { TerrainMeta, TerrainSymbol } from './mapTerrain';

interface Options {
  map: MapDef | null;
  /** 当前地图全部标记行（含地形）：改 meta 时要先按 id 找到那一行 */
  pins: MapPin[];
  /** useMapTerrain().place */
  place: (mapId: string, symbol: TerrainSymbol, x: number, y: number) => string;
  /** useMapTerrain().patch */
  patch: (pin: MapPin, next: Partial<TerrainMeta>) => void;
  /** 落下之后要选中它（清掉另外两种选中由调用方负责） */
  onPlaced: (pinId: string) => void;
}

export interface TerrainStage {
  brush: TerrainSymbol | null;
  /** 选笔刷（同一个再点一次 = 放下） */
  pick: (symbol: TerrainSymbol | null) => void;
  /** 放下笔刷（换工具 / 切预览时用） */
  clear: () => void;
  /** 在归一化坐标落一个符号并让它跟手；返回新行 id */
  placeAt: (x: number, y: number) => string | null;
  /** 改某个符号的 meta（画布上的手柄与检查器的滑块都走这里） */
  patchMeta: (pinId: string, next: Partial<TerrainMeta>) => void;
}

export function useTerrainStage({ map, pins, place, patch, onPlaced }: Options): TerrainStage {
  const [brush, setBrush] = useState<TerrainSymbol | null>(null);

  /** 按 Esc 放下笔刷（左栏再点一次那个符号也行） */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBrush(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clear = useCallback(() => setBrush(null), []);

  const placeAt = useCallback(
    (x: number, y: number): string | null => {
      if (!map || !brush) return null;
      const id = place(map.id, brush, x, y);
      onPlaced(id);
      return id;
    },
    [map, brush, place, onPlaced],
  );

  const patchMeta = useCallback(
    (pinId: string, next: Partial<TerrainMeta>) => {
      const pin = pins.find((p) => p.id === pinId);
      if (pin) patch(pin, next);
    },
    [pins, patch],
  );

  return { brush, pick: setBrush, clear, placeAt, patchMeta };
}
