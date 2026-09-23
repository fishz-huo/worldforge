/**
 * 地图只读信息（预览模式专用）
 * ------------------------------------------------------------------
 * 预览模式的定义是「纯查看」，所以检查器里不能出现任何可写控件：
 *   - Field 只渲染文本，不引入 AutoInput / AutoNumber；
 *   - 资源条复用 ResourceChart 里的只读组件；
 *   - 整个文件没有任何 update* 调用，因此在这个模式下删不掉也改不了。
 *
 * 内容对齐设计稿：区域 = 名称 / 所属时期 / 资源；标记 = 名称。
 * 备注与绑定卡片是用户额外要求保留的，仍然只读。
 */
import { Badge } from '@/components/ui/badge';
import { SectionTitle } from '@/components/ui/primitives';
import { RESOURCE_METRICS } from '@/types';
import { useStore } from '@/store';
import { RegionResourceBars } from './ResourceChart';

/** 「标签 + 值」一行；空值统一显示破折号，免得看起来像漏了数据 */
function Field({ label, value }: { label: string; value?: string }) {
  const text = value?.trim();
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="break-words text-xs">{text || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

/** 颜色小方块（区域与标记共用） */
function ColorChip({ color }: { color: string }) {
  return (
    <span className="inline-block size-3 shrink-0 rounded-sm border border-border" style={{ background: color }} />
  );
}

/** 区域只读信息 */
export function RegionReadonly({ regionId }: { regionId: string }) {
  const region = useStore((s) => s.regions.find((r) => r.id === regionId));
  if (!region) return null;
  const res = region.resources ?? {};

  return (
    <div className="space-y-2 p-2">
      <Field label="区域名称" value={region.name} />
      <Field label="所属时期" value={region.period} />
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <ColorChip color={region.color} /> 区域颜色 {region.color}
      </div>

      <SectionTitle>资源</SectionTitle>
      <div className="space-y-0.5">
        {RESOURCE_METRICS.map((m) => (
          <div key={m.key} className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-mono">
              {Number(res[m.key] ?? 0)} {m.unit}
            </span>
          </div>
        ))}
      </div>
      <RegionResourceBars region={region} />

      <Field label="备注" value={region.note} />
    </div>
  );
}

/** 标记只读信息 */
export function PinReadonly({ pinId }: { pinId: string }) {
  const pin = useStore((s) => s.pins.find((p) => p.id === pinId));
  const card = useStore((s) => (pin?.card_id ? s.cards.find((c) => c.id === pin.card_id) : undefined));
  if (!pin) return null;

  return (
    <div className="space-y-2 p-2">
      <Field label="标记名称" value={pin.label} />
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <ColorChip color={pin.color} /> 标记颜色 {pin.color}
      </div>
      <Field label="坐标（0~1）" value={`${pin.x.toFixed(3)} , ${pin.y.toFixed(3)}`} />

      <div className="space-y-0.5">
        <div className="text-[10px] text-muted-foreground">绑定卡片</div>
        {card ? (
          <Badge variant="outline" className="border-0 bg-muted text-[10px]">
            {card.title}
          </Badge>
        ) : (
          <div className="text-xs text-muted-foreground">未绑定卡片</div>
        )}
      </div>

      <Field label="备注" value={pin.note} />
    </div>
  );
}
