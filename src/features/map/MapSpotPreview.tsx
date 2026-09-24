/**
 * 浮窗 / 底部抽屉的内容（标记点与区域共用）
 * ==================================================================
 * 需求：「浮窗复用现有卡片预览组件：标题、类型徽标、摘要、核心数据、关联事件」。
 * 所以绑了卡片的标记点直接渲染 features/cards/CardPreview.tsx 里的
 * WikiHoverCard（**复用、不改动它**，点它会打开那张完整卡片）；
 * 没绑卡片的标记点与区域则复用检查器的只读信息块
 * （PinReadonly / RegionReadonly），保证浮窗里看到的内容和右侧检查器一致。
 * 底部加一节「关联事件」（见 MapRelatedEvents）。
 */
import type { ReactNode } from 'react';
import { WikiHoverCard } from '@/features/cards/CardPreview';
import { useStore } from '@/store';
import type { SpotTarget } from './mapOverlay';
import { MapRelatedEvents } from './MapRelatedEvents';
import { PinReadonly, RegionReadonly } from './MapReadonlyInfo';

/** 没有自带头图的信息块，给它套一层浮窗样式（WikiHoverCard 自带，不重复套） */
function InfoPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-popover p-1 shadow-2xl">{children}</div>
  );
}

export function MapSpotPreview({ target }: { target: SpotTarget }) {
  // 两个 selector 都无条件调用，返回的是既有引用（不是新对象）
  const pin = useStore((s) => (target.kind === 'pin' ? s.pins.find((p) => p.id === target.id) : undefined));
  const region = useStore((s) => (target.kind === 'region' ? s.regions.find((r) => r.id === target.id) : undefined));

  if (target.kind === 'pin') {
    if (!pin) return <InfoPanel><div className="p-2 text-xs text-muted-foreground">这个标记点已被删除</div></InfoPanel>;
    const cardId = pin.card_id;
    return (
      <div className="space-y-1.5">
        {cardId ? (
          <WikiHoverCard cardId={cardId} className="w-full" />
        ) : (
          <InfoPanel>
            <PinReadonly pinId={pin.id} />
          </InfoPanel>
        )}
        <MapRelatedEvents cardId={cardId} mapId={pin.map_id} />
      </div>
    );
  }

  if (!region) return <InfoPanel><div className="p-2 text-xs text-muted-foreground">这个区域已被删除</div></InfoPanel>;
  return (
    <div className="space-y-1.5">
      <InfoPanel>
        <RegionReadonly regionId={region.id} />
      </InfoPanel>
      {/* 区域的「关联事件」实际是本地图的事件（时间轴没有区域级关联列） */}
      <MapRelatedEvents mapId={region.map_id} scopeNote />
    </div>
  );
}
