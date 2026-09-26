/**
 * 世界层的动作总入口（画布 → MapWorldLayer 的那一包）
 * ==================================================================
 * 从 MapCanvas 搬出来，是因为那里要在动作上做两处"只有画布这一层知道"的加工，
 * 而它已经装过框选、拉框建区域、图钉拖拽，没有行数了：
 *
 *   1. **打点防重叠**（2026-09-26 问题三）：打点常驻之后，同一点连点两下会叠一个
 *      完全看不见的标记 —— 落点前先看附近有没有已有标记，有就只选中它、不落新的；
 *   2. 其余六个动作原样透传（不加判定、不改顺序）。
 *
 * 入参都是"模块给啥就是啥"，这里不读 store、不持状态：加工完就交出去。
 */
import { useCallback } from 'react';
import type { MapPin, MapRegion } from '@/types';
import { pinNear } from './mapMarqueeTargets';
import type { MapWorldLayerProps } from './MapWorldLayer';
import type { Size } from './mapViewport';
import type { WorldNorm } from './useWorldNorm';

interface Options {
  /** 世界层引用：防重叠要在**屏幕像素**里量距离（归一化空间各向异性） */
  world: WorldNorm;
  /** 当前地图的普通标记（不含地形，模块已经分过） */
  pins: MapPin[];
  /** 框选：Shift+拖动可以从对象本体上起手，那一下图层要让路（见 useMarquee.owns） */
  marquee: { owns: () => boolean };
  onNaturalSize: (size: Size) => void;
  onCanvasClick: (x: number, y: number) => void;
  onPinSelect: (pinId: string | null) => void;
  onPinDragStart: (pinId: string) => void;
  onRegionSelect: (regionId: string | null) => void;
  onRegionDragStart: (region: MapRegion) => (e: React.PointerEvent) => void;
  onTerrainSelect: (pinId: string | null) => void;
  onTerrainDragStart: (pin: MapPin) => (e: React.PointerEvent) => void;
}

export interface WorldActions {
  /** 摊给 MapWorldLayer 的那一包 */
  actions: MapWorldLayerProps['actions'];
  /** 给画布手势用的落点：先过一次防重叠，再交给模块 */
  onSurfaceClick: (x: number, y: number) => void;
}

export function useWorldActions({
  world, pins, marquee, onNaturalSize, onCanvasClick, onPinSelect, onPinDragStart, onRegionSelect,
  onRegionDragStart, onTerrainSelect, onTerrainDragStart,
}: Options): WorldActions {
  const onSurfaceClick = useCallback(
    (x: number, y: number) => {
      const rect = world.worldRect();
      const near = rect ? pinNear(pins, rect, x, y) : null;
      if (near) {
        onPinSelect(near.id); // 同一个地方：选中已有那个，不再叠一个看不见的
        return;
      }
      onCanvasClick(x, y);
    },
    [world, pins, onCanvasClick, onPinSelect],
  );

  /**
   * 框选接管了这一下（Shift+从对象本体上起手）：图层的选中与拖动都要让路 ——
   * 否则按下那一瞬就会先把选中换成它、区域也跟着动，松手再由框选提交就对不上了。
   */
  const give = () => !marquee.owns();

  const actions: MapWorldLayerProps['actions'] = {
    onNaturalSize,
    onPinSelect: (id) => { if (give()) onPinSelect(id); },
    onPinDragStart: (pinId) => { if (give()) onPinDragStart(pinId); },
    onRegionSelect: (id) => { if (give()) onRegionSelect(id); },
    onRegionDragStart: (region) => (e) => { if (give()) onRegionDragStart(region)(e); },
    onTerrainSelect: (id) => { if (give()) onTerrainSelect(id); },
    onTerrainDragStart: (pin) => (e) => { if (give()) onTerrainDragStart(pin)(e); },
  };

  return { actions, onSurfaceClick };
}
