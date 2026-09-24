/**
 * 选中区域的「边缘热区」
 * ==================================================================
 * 从 useCanvasGestures 抽出来（第三批加地形笔刷之后那个文件顶到 200 行上限）。
 * 职责只有一件：把鼠标位置换算成「离选中区域最近那条边多远」，并在
 * 热 / 不热**翻转**时 setState —— 鼠标每动一下都会重算，但只有状态变了才重渲染。
 *
 * 判定与动作分在两处：这里只回答「现在算不算贴在边上」，按下去要干什么由
 * useCanvasGestures 决定（Ctrl/⌘ + 左键 → 在最近那条边加顶点）。命中结果放在
 * ref 里，按下时直接读，保证「光标显示的位置」与「实际插入的位置」是同一处。
 * 距离用**屏幕像素**量（归一化空间各向异性，在那里量横竖不一致）。
 */
import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { MapRegion } from '@/types';
import { nearestEdge, pointsToScreen } from './mapRegionEdit';
import type { EdgeHit } from './mapRegionEdit';

/** 光标离边多近算「按在边上」（屏幕像素） */
export const EDGE_TOLERANCE = 8;

interface Options {
  /** 世界层此刻的屏幕矩形（命中判定要在屏幕像素里量距离） */
  worldRect: () => DOMRect | null;
  /** 针对哪个区域判热区（编辑模式且已选中时才给） */
  region: MapRegion | null;
  /** 热区是否启用（编辑模式 + 非平移态 + 有选中区域） */
  enabled: boolean;
}

export interface EdgeHot {
  /** 光标此刻是否落在边缘热区上（画布据它换成「+」） */
  hot: boolean;
  /** 此刻命中的那条边（Ctrl 点击时读它） */
  hit: MutableRefObject<EdgeHit | null>;
  track: (clientX: number, clientY: number) => void;
  clear: () => void;
}

export function useEdgeHot({ worldRect, region, enabled }: Options): EdgeHot {
  const [hot, setHot] = useState(false);
  const hitRef = useRef<EdgeHit | null>(null);

  const track = useCallback(
    (clientX: number, clientY: number) => {
      const rect = worldRect();
      const found =
        enabled && region && rect && rect.width > 0
          ? nearestEdge(
              pointsToScreen(region.points, rect.width, rect.height),
              clientX - rect.left,
              clientY - rect.top,
              EDGE_TOLERANCE,
            )
          : null;
      hitRef.current = found;
      setHot(found !== null);
    },
    [enabled, region, worldRect],
  );

  const clear = useCallback(() => {
    hitRef.current = null;
    setHot(false);
  }, []);

  return { hot, hit: hitRef, track, clear };
}
