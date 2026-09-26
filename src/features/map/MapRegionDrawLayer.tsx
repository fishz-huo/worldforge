/**
 * 「拉框建区域」的那个矩形（屏幕空间浮层）
 * ==================================================================
 * 与 MapMarqueeLayer 同一套摆法：位置用画布内的像素直接摆（useRegionDraw 已经把
 * 画布原点减掉了），所以不吃缩放；pointer-events-none，永远不抢指针事件。
 *
 * 观感刻意与框选区分开：框选是「主色细实线 / 琥珀细虚线 + 窗选/交叉选小字」，
 * 这里是**主色粗实线 + 「松手创建区域」**——一眼能看出这次拖完会多一个区域，
 * 而不是在选东西。
 */
import type { MarqueeBox } from './mapMarquee';

export function MapRegionDrawLayer({ box }: { box: MarqueeBox | null }) {
  if (!box) return null;

  return (
    <div
      aria-hidden
      // 实测探针的锚点：拖到一半读它就能验"拉框建区域生效"
      data-wf-region-draw="true"
      className="pointer-events-none absolute z-[25] border-2 border-solid border-primary bg-primary/10"
      style={{
        left: box.left,
        top: box.top,
        width: box.right - box.left,
        height: box.bottom - box.top,
      }}
    >
      <span className="absolute left-0 top-0 whitespace-nowrap rounded-br bg-primary px-1 py-0.5 text-[10px] text-primary-foreground">
        松手创建区域
      </span>
    </div>
  );
}
