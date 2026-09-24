/**
 * 浮窗 / 抽屉的开关与渲染（浮层入口）
 * ==================================================================
 * 需求：预览模式下悬浮标记点/区域弹出浮窗；移动端改为点击触发、浮窗改底部抽屉。
 *
 * 这里只管「什么时候显示什么」，内容在 MapSpotPreview、定位在 mapOverlay：
 *   - 桌面（有鼠标）：悬浮即开，移出后延时 120ms 收起 ——
 *     这段时间够把鼠标从标记点挪到浮窗上，与正文双链的悬浮预览同一手感；
 *   - 触屏/窄屏：不监听悬浮，点一下弹底部抽屉，背板点一下关；
 *   - 开始平移缩放、或点选元素时立刻收起（由 useMapViewport 的 onInteract
 *     与 MapModule 的选中处理调用 hide）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SpotTarget } from './mapOverlay';
import { MapHoverCard } from './MapHoverCard';
import { MapSpotDrawer } from './MapSpotDrawer';
import { useCoarsePointer } from './useCoarsePointer';

/** 鼠标移开后浮窗再活 120ms（够挪到浮窗上） */
const HIDE_DELAY = 120;

/** 要交给画布各图层的事件（图层在 hover/点击时回调） */
export interface MapSpotBind {
  /** 进入某个标记点/区域：弹出浮窗（触屏下忽略） */
  onSpotHover: (target: SpotTarget) => void;
  /** 离开：延时收起 */
  onSpotLeave: () => void;
  /** 点击某个标记点/区域（触屏下弹底部抽屉） */
  onSpotTap: (target: SpotTarget) => void;
}

export interface MapSpots {
  /** 触屏/窄屏：点击触发 + 底部抽屉 */
  coarse: boolean;
  bind: MapSpotBind;
  /** 当前正在展示的目标（桌面=悬停的、触屏=点开的）：画布据此高亮元素 */
  target: SpotTarget | null;
  /** 立刻收起（点选、开始平移缩放时用） */
  hide: () => void;
  /** 浮层本身（浮窗或抽屉），由 MapModule 渲染 */
  overlay: ReactNode;
}

export function useMapSpots(): MapSpots {
  const coarse = useCoarsePointer();
  const [hover, setHover] = useState<SpotTarget | null>(null);
  const [tapped, setTapped] = useState<SpotTarget | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    cancel();
    setHover(null);
    setTapped(null);
  }, [cancel]);

  const scheduleHide = useCallback(() => {
    cancel();
    timer.current = setTimeout(() => setHover(null), HIDE_DELAY);
  }, [cancel]);

  // 组件卸载时别留下定时器
  useEffect(() => cancel, [cancel]);

  const bind: MapSpotBind = {
    onSpotHover: (target) => {
      if (coarse) return;
      cancel();
      setHover(target);
    },
    onSpotLeave: () => {
      if (!coarse) scheduleHide();
    },
    onSpotTap: (target) => {
      if (!coarse) return;
      cancel();
      setTapped(target);
    },
  };

  const overlay = coarse
    ? tapped && <MapSpotDrawer target={tapped} onClose={() => setTapped(null)} />
    : hover && <MapHoverCard target={hover} onEnter={cancel} onLeave={scheduleHide} />;

  return { coarse, bind, target: coarse ? tapped : hover, hide, overlay };
}
