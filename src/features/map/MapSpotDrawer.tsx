/**
 * 移动端底部抽屉（替代悬浮浮窗）
 * ==================================================================
 * 需求：「移动端改为点击触发，浮窗改为底部抽屉」。
 * 触屏没有「把鼠标移上去」这个动作，所以手机上改为点一下弹抽屉。
 *
 * 三个细节：
 *   - 底部空出 --wf-bottom-nav（标签栏高度）：否则最下面一行永远被手机
 *     底部导航压住点不到（mobile-lint 规则 3 会报这条）；
 *   - 背板点一下就关，抽屉本身可滚动（内容可能很长：卡片预览 + 关联事件）；
 *   - h-8 的关闭按钮（32px > 24px 的触屏最小点击区）。
 */
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SpotTarget } from './mapOverlay';
import { MapSpotPreview } from './MapSpotPreview';

export function MapSpotDrawer({ target, onClose }: { target: SpotTarget; onClose: () => void }) {
  const title = target.kind === 'pin' ? '标记点' : '区域';

  return (
    <div className="fixed inset-0 z-[60]" data-wf-map-drawer={target.kind}>
      <div aria-hidden className="absolute inset-0 bg-background/60 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title}详情`}
        className="absolute inset-x-0 bottom-[var(--wf-bottom-nav)] max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-border bg-card p-3 shadow-2xl"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">{title}预览</span>
          <Button variant="ghost" size="icon-sm" className="size-8" title="关闭" onClick={onClose}>
            <X />
          </Button>
        </div>
        <MapSpotPreview target={target} />
      </div>
    </div>
  );
}
