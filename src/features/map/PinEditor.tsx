/**
 * 地图标记点编辑器
 * ------------------------------------------------------------------
 * 标记点既可以绑定一张地点卡片（保持设定单一来源），
 * 也可以作为独立信息存在（例如"未探索区域"）。
 */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SectionTitle } from '@/components/ui/primitives';
import { AutoInput, AutoNumber, AutoTextarea } from '@/components/common/AutoField';
import { Icon } from '@/components/Icon';
import { getCardType } from '@/lib/plugin/registry';
import { useStore } from '@/store';
import { CardPicker } from '@/features/cards/CardPicker';

export function PinEditor({ pinId }: { pinId: string }) {
  const pin = useStore((s) => s.pins.find((p) => p.id === pinId));
  const updatePin = useStore((s) => s.updatePin);
  const deletePin = useStore((s) => s.deletePin);
  const card = useStore((s) => (pin?.card_id ? s.cards.find((c) => c.id === pin.card_id) : undefined));
  const selectCard = useStore((s) => s.selectCard);
  const [picking, setPicking] = useState(false);
  if (!pin) return null;

  return (
    <div className="space-y-2 p-2">
      <div className="space-y-1">
        <Label>标记名称</Label>
        <AutoInput value={pin.label} onCommit={(label) => updatePin(pin.id, { label })} />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <Label>图标（emoji）</Label>
          <AutoInput
            value={pin.icon}
            onCommit={(icon) => updatePin(pin.id, { icon: icon.slice(0, 2) || '📍' })}
            className="text-center"
          />
        </div>
        <div className="space-y-1">
          <Label>颜色</Label>
          <input
            type="color"
            value={pin.color}
            onChange={(e) => updatePin(pin.id, { color: e.target.value })}
            className="h-8 w-full cursor-pointer rounded border border-border bg-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <Label>X（0~1）</Label>
          <AutoNumber value={pin.x} onCommit={(x) => updatePin(pin.id, { x: x ?? 0 })} />
        </div>
        <div className="space-y-1">
          <Label>Y（0~1）</Label>
          <AutoNumber value={pin.y} onCommit={(y) => updatePin(pin.id, { y: y ?? 0 })} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>备注</Label>
        <AutoTextarea value={pin.note} onCommit={(note) => updatePin(pin.id, { note })} minHeight={50} />
      </div>

      <SectionTitle>绑定卡片</SectionTitle>
      {card ? (
        <button
          onClick={() => selectCard(card.id)}
          className="flex w-full items-center gap-1.5 rounded border border-border px-2 py-1.5 text-left text-xs hover:bg-accent"
        >
          <Icon
            name={getCardType(card.type).icon}
            className="size-3.5"
            style={{ color: getCardType(card.type).color }}
          />
          <span className="min-w-0 flex-1 truncate">{card.title}</span>
          <Badge variant="outline" className="border-0 bg-muted text-[10px]">
            {getCardType(card.type).label}
          </Badge>
        </button>
      ) : (
        <div className="text-[11px] text-muted-foreground">未绑定卡片（标记仍是独立信息）</div>
      )}

      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setPicking(true)}>
          {card ? '更换卡片' : '绑定卡片'}
        </Button>
        {card && (
          <Button variant="ghost" size="sm" onClick={() => updatePin(pin.id, { card_id: null })}>
            解绑
          </Button>
        )}
      </div>

      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => deletePin(pin.id)}>
        <Trash2 className="size-3.5" /> 删除标记
      </Button>

      <CardPicker
        open={picking}
        onOpenChange={setPicking}
        title="把标记绑定到哪张卡片？"
        onSelect={(id) => {
          const target = useStore.getState().cards.find((c) => c.id === id);
          updatePin(pin.id, {
            card_id: id,
            label: pin.label === '新标记' && target ? target.title : pin.label,
          });
        }}
      />
    </div>
  );
}
