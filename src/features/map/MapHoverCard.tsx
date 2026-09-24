/**
 * 桌面悬浮浮窗（预览模式）
 * ==================================================================
 * 需求：鼠标悬浮标记点 / 区域时高亮该元素并弹出浮窗，且支持边缘碰撞检测
 * （贴到屏幕边缘自动翻转方向）。
 *
 * 定位由纯函数 mapOverlay.placeOverlay 算（有自测），这里只做两件事：
 *   1. 挂载后量一次真实尺寸再修正位置 —— 内容高度取决于卡片摘要与关联事件
 *      条数，估不准，所以先按估算值摆、下一帧用实测值摆正（肉眼看不到跳变）；
 *   2. 鼠标从标记点移到浮窗上时不能闪掉：进入浮窗取消收起，离开才延时收起
 *      （120ms 缓冲，与正文双链悬浮预览同一手感）。
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { OVERLAY_GAP, OVERLAY_MARGIN, placeOverlay } from './mapOverlay';
import type { SpotTarget } from './mapOverlay';
import { MapSpotPreview } from './MapSpotPreview';

/** 首次渲染的估算尺寸：只影响第一帧的位置，随后按实测修正 */
const ESTIMATED = { width: 320, height: 360 };

export function MapHoverCard({
  target,
  onEnter,
  onLeave,
}: {
  target: SpotTarget;
  /** 鼠标进入浮窗：取消延时收起 */
  onEnter: () => void;
  /** 鼠标离开浮窗：延时收起 */
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(ESTIMATED);

  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    if (Math.abs(rect.width - size.width) > 2 || Math.abs(rect.height - size.height) > 2) {
      setSize({ width: rect.width, height: rect.height });
    }
  }, [target, size.width, size.height]);

  const viewport = {
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  };
  const anchor = target.anchor ?? { left: 0, top: 0, width: 0, height: 0 };
  const place = placeOverlay(anchor, size, viewport, { gap: OVERLAY_GAP, margin: OVERLAY_MARGIN });

  return (
    <div
      ref={ref}
      role="tooltip"
      data-wf-map-hovercard={target.kind}
      // z-[70] 与正文双链的悬浮预览同层，压过检查器浮层（z-30）与背板
      className="fixed z-[70] w-80"
      style={{ left: place.left, top: place.top }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <MapSpotPreview target={target} />
    </div>
  );
}
