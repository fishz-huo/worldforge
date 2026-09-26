/**
 * 框选手势（按下 → 过阈值 → 拉框 → 松手提交）
 * ==================================================================
 * 从 useCanvasGestures 里抽出来单独放：它自带一个小状态机（起手判定、4px 阈值、
 * 指针捕获、提交/取消），与平移 / 笔刷 / 打点并列。策略在下面这段注释里，
 * 几何在 mapMarquee，对象形状在 mapMarqueeTargets。
 *
 * 五条边界（用户 2026-09-25 拍板）：
 *   1. 只有编辑模式 +「选择 / 区域」工具 + 非平移态 + 没在画笔刷 + 按在空白 +
 *      没按 Ctrl/⌘/Alt 才可能起框（条件全在 marqueeEligible，可单测）；
 *   2. 位移过 4px 才算框选：以下原样走点击语义 —— Ctrl+点区域边缘加顶点、
 *      点空白取消选中都不受影响；
 *   3. 一旦成框就 setPointerCapture：拖过对象也不改语义（按在对象上会写库）；
 *   4. Shift = 追加（去重），移除不做；Ctrl/⌘/Alt 完全不参与；
 *   5. Esc：成着框就先撤框；没在画笔刷时清空选中（画笔刷时让给笔刷）。
 */
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MapPin, MapRegion, MapTool } from '@/types';
import { MARQUEE_THRESHOLD, boxOf, hitsOf, marqueeEligible, marqueeMode } from './mapMarquee';
import type { MarqueeBox, MarqueeMode, MarqueePressSpot } from './mapMarquee';
import { buildCandidates } from './mapMarqueeTargets';
import type { MapSelectionItem } from './mapSelection';
import type { MapViewMode } from './mapRender';
import type { WorldNorm } from './useWorldNorm';

interface Options {
  /** 世界层引用：候选几何按它**此刻**的屏幕矩形投影 */
  world: WorldNorm;
  viewMode: MapViewMode;
  tool: MapTool;
  panMode: boolean;
  brushActive: boolean;
  pins: MapPin[];
  terrain: MapPin[];
  regions: MapRegion[];
  /** 提交：items 是框到的对象，additive = 按住 Shift 追加 */
  onSelect: (items: MapSelectionItem[], additive: boolean) => void;
  /** Esc 清空选中（没在画笔刷时） */
  onClear: () => void;
  /**
   * 打点工具下按 Esc：请调用方把工具收回「选择」。这一支必须留在这里 ——
   * 两个 window keydown 处理器的先后由挂载顺序决定，实测 useMapTool 先跑、它的
   * 状态更新在框选处理时已经可见（工具已变成"选择"），于是顺手把选中也清了。
   * 集中成一个决策点后，「一次 Esc 只做一件事」与顺序无关。
   */
  onToolExit?: () => void;
  /** 别处正在拉框建区域时返回 true：那一下 Esc 归它撤框，不在这里清选中 */
  suppressEsc?: () => boolean;
}

export interface MarqueeControls {
  /** 正在拖的框（画布内的像素，MapMarqueeLayer 按它摆）；没在拖就是 null */
  box: MarqueeBox | null;
  /** 这一次框的语义：左→右窗选、右→左交叉选 */
  mode: MarqueeMode;
  /** 按下（画布捕获阶段；fromSpot = 这一下按在空白 / 对象本体 / 顶点或手柄上） */
  press: (e: ReactPointerEvent<HTMLDivElement>, fromSpot: MarqueePressSpot) => void;
  /** 移动：过阈值才成框并捕获指针 */
  track: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** 松手：成过框就提交选中 */
  release: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** 指针取消 / Esc：撤框，不提交 */
  cancel: () => void;
  /** 这一下 click 是不是"框选的余波"（是就吃掉，免得顺手把选中取消掉） */
  consumeClick: () => boolean;
  /**
   * 这一次手势是否已被框选接管（Shift+拖动可以从对象上起手）：图层据此让路，
   * 别再选中 / 拖动那个对象，等松手由框选统一提交。成框提交后它**留到下一次按下**
   * —— 松手补的那次 click 会顺手选中单个对象，不留着就把刚框好的一批覆盖了；
   * 没成框（Shift+单击）则当场复位，于是"Shift 单击仍然只是选中它"照样成立。
   */
  owns: () => boolean;
}

/** 一次拖拽的现场：起点、画布原点、是否追加、是否已经成框 */
interface Live {
  x0: number;
  y0: number;
  /** 画布左上角的客户端坐标（按下的那一瞬量一次：拉的这几帧里它不会动） */
  ox: number;
  oy: number;
  additive: boolean;
  started: boolean;
}

export function useMarquee({
  world, viewMode, tool, panMode, brushActive, pins, terrain, regions, onSelect, onClear,
  onToolExit, suppressEsc,
}: Options): MarqueeControls {
  const [drag, setDrag] = useState<{ box: MarqueeBox; mode: MarqueeMode } | null>(null);
  const liveRef = useRef<Live | null>(null);
  /** 这一次按下已经成过框：紧接着的 click 要吃掉（不然会立刻把选中清掉） */
  const consumedRef = useRef(false);
  /** 这一次按下已被框选接管（Shift+从对象上起手）：图层要据此让路，见 MarqueeControls.owns */
  const ownsRef = useRef(false);
  /** 松手那一刻要读的最新数据（effect 只装一次，处理时从这里取） */
  const latest = useRef({ world, pins, terrain, regions, onSelect, onClear, onToolExit, viewMode, brushActive, suppressEsc, tool });
  useEffect(() => {
    latest.current = { world, pins, terrain, regions, onSelect, onClear, onToolExit, viewMode, brushActive, suppressEsc, tool };
  });

  const cancel = () => {
    liveRef.current = null;
    ownsRef.current = false;
    setDrag(null);
  };

  const press = (e: ReactPointerEvent<HTMLDivElement>, fromSpot: MarqueePressSpot) => {
    consumedRef.current = false;
    liveRef.current = null;
    ownsRef.current = marqueeEligible({
      viewMode, tool, panMode, brushActive, fromSpot,
      button: e.button, shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey,
    });
    if (!ownsRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    liveRef.current = {
      x0: e.clientX, y0: e.clientY, ox: rect.left, oy: rect.top,
      additive: e.shiftKey, started: false,
    };
  };

  const track = (e: ReactPointerEvent<HTMLDivElement>) => {
    const live = liveRef.current;
    if (!live) return;
    if (!live.started) {
      const moved = Math.abs(e.clientX - live.x0) >= MARQUEE_THRESHOLD
        || Math.abs(e.clientY - live.y0) >= MARQUEE_THRESHOLD;
      if (!moved) return; // 还没过阈值：这一下仍然是"点"，让点击语义照旧
      live.started = true;
      // 捕获指针：拖到对象上、甚至拖出画布，都还算"在拉框"
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setDrag({
      box: boxOf(live.x0 - live.ox, live.y0 - live.oy, e.clientX - live.ox, e.clientY - live.oy),
      mode: marqueeMode(live.x0, e.clientX),
    });
  };

  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    const live = liveRef.current;
    liveRef.current = null;
    setDrag(null);
    // 没成框（Shift+单击对象）：这一下不算框选接管，松手后图层照旧处理它的 click
    if (!live || !live.started) {
      ownsRef.current = false;
      return;
    }
    consumedRef.current = true;
    const now = latest.current;
    const rect = now.world.worldRect();
    if (!rect) return;
    const box = boxOf(live.x0, live.y0, e.clientX, e.clientY);
    const candidates = buildCandidates(rect, now.pins, now.terrain, now.regions);
    now.onSelect(hitsOf(candidates, box, marqueeMode(live.x0, e.clientX)), live.additive);
  };

  const consumeClick = () => {
    if (!consumedRef.current) return false;
    consumedRef.current = false;
    return true;
  };

  /** Esc：成着框先撤框；没在画笔刷时清空选中（画笔刷的 Esc 归 useTerrainStage） */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (liveRef.current?.started) {
        liveRef.current = null;
        setDrag(null);
        return;
      }
      const now = latest.current;
      if (now.viewMode !== 'edit' || now.brushActive) return;
      // 正在拉框建区域：Esc 归它撤框（见 useRegionDraw），这里别顺手把选中也清了
      if (now.suppressEsc?.()) return;
      // 打点工具下的 Esc 是"退出这个工具"（见 useMapTool）：一次只做一件事，不清选中
      if (now.tool === 'pin') {
        now.onToolExit?.();
        return;
      }
      now.onClear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    box: drag?.box ?? null,
    mode: drag?.mode ?? 'window',
    press,
    track,
    release,
    cancel,
    consumeClick,
    owns: () => ownsRef.current,
  };
}
