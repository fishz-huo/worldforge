/**
 * 画布上的两块浮层：底部「未设置底图」提示 + 右下角缩放胶囊
 * ==================================================================
 * 从 MapCanvas 抽出来（连说明一起搬走）：那个文件要装视口接线、坐标换算、
 * 边缘热区与区域手势，把这两块浮层留在里面会顶到「单文件 ≤200 行」。
 *
 * 缩放胶囊当初放在工具条上，实测 1280 宽、两栏都开着时工具条只有 608px 可用，
 * 加它会挤成两行（57px），破坏「工具条底边与面板标题行齐平」的约定，所以改浮层。
 * stopPropagation 是必须的：拖这个胶囊不该带动整张地图平移。
 */
import type { PointerEvent as ReactPointerEvent } from 'react';
import { MapZoomControls } from './MapZoomControls';

interface Props {
  /** 还没有底图：给一句提示，说明照样能摆标记点 */
  showBackdropHint: boolean;
  percent: number;
  onZoom: (factor: number) => void;
  onFit: () => void;
}

export function MapFloat({ showBackdropHint, percent, onZoom, onFit }: Props) {
  const stop = (e: ReactPointerEvent) => e.stopPropagation();

  return (
    <>
      {showBackdropHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded bg-background/75 px-2 py-1 text-[11px] text-muted-foreground">
            未设置底图 —— 可直接摆放标记点，之后补图不会错位（可滚轮缩放、拖动平移）
          </span>
        </div>
      )}

      <div className="absolute bottom-3 right-3 z-30" onPointerDown={stop}>
        <MapZoomControls percent={percent} onZoom={onZoom} onFit={onFit} />
      </div>
    </>
  );
}
