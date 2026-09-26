/**
 * 框选的那个框（屏幕空间浮层）
 * ==================================================================
 * 位置用**画布内的像素**直接摆（useMarquee 已经把客户端坐标减掉了画布原点），
 * 所以它不吃缩放：框跟着鼠标走，不会因为底图 6 倍而变粗。
 * pointer-events-none —— 它是"画在脸上的提示"，永远不抢指针事件。
 *
 * 外观按 AutoCAD 的既有习惯：窗选（左→右）实线、交叉选（右→左）虚线，
 * 并各配一行小字说明这次的语义（用户 2026-09-25 要求"把两种口径的区别画在脸上"）。
 */
import { cn } from '@/lib/utils';
import type { MarqueeBox, MarqueeMode } from './mapMarquee';

export function MapMarqueeLayer({ box, mode }: { box: MarqueeBox | null; mode: MarqueeMode }) {
  if (!box) return null;
  const window = mode === 'window';

  return (
    <div
      aria-hidden
      // data 属性给实测探针留的锚点：按住拖到一半时读它就能验"方向语义生效"
      data-wf-map-marquee={mode}
      className={cn(
        'pointer-events-none absolute z-[25]',
        window
          ? 'border border-solid border-primary/80 bg-primary/5'
          : 'border border-dashed border-amber-500/90 bg-amber-500/5',
      )}
      style={{
        left: box.left,
        top: box.top,
        width: box.right - box.left,
        height: box.bottom - box.top,
      }}
    >
      <span
        className={cn(
          'absolute left-0 top-0 whitespace-nowrap rounded-br px-1 py-0.5 text-[10px]',
          window ? 'bg-primary text-primary-foreground' : 'bg-amber-500 text-white',
        )}
      >
        {window ? '窗选：完全框住才算' : '交叉选：碰到就算'}
      </span>
    </div>
  );
}
