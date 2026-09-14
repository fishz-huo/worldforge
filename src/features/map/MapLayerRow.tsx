/**
 * 图层面板里的一行
 * ------------------------------------------------------------------
 * 从 MapLayerPanel 拆出来：一行里有显隐 / 改名 / 上下移 / 删除 / 换图 /
 * 混合模式 / 不透明度七个控件，加上注释就占满了半个文件，
 * 与面板本身的列表渲染混在一起谁也读不清。
 */
import { useRef } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { askConfirm } from '@/lib/confirm';
import { importImage } from '@/lib/assets';
import { cn } from '@/lib/utils';
import { MAP_BLENDS, type MapBlend, type MapLayer } from '@/types';
import { useStore } from '@/store';

/** 一层的一行 */
export function MapLayerRow({
  layer, count, isTop, isBottom,
}: {
  layer: MapLayer;
  /** 这一层上有多少个标记 / 区域（删层前告诉用户会保留它们） */
  count: number;
  isTop: boolean;
  isBottom: boolean;
}) {
  const updateLayer = useStore((s) => s.updateLayer);
  const deleteLayer = useStore((s) => s.deleteLayer);
  const moveLayer = useStore((s) => s.moveLayer);
  const addLayer = useStore((s) => s.addLayer);
  const worldId = useStore((s) => s.currentWorldId);
  const toast = useStore((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!worldId) return;
    const asset = await importImage(file, worldId);
    updateLayer(layer.id, { asset_id: asset.id, name: layer.name || asset.name });
    toast('图层底图已更新', 'success');
  };

  return (
    <div className={cn('space-y-1 rounded border px-1.5 py-1', layer.visible ? 'border-border' : 'border-border/50 opacity-60')}>
      <div className="flex items-center gap-1">
        <button
          onClick={() => updateLayer(layer.id, { visible: layer.visible === 1 ? 0 : 1 })}
          title={layer.visible === 1 ? '隐藏该层' : '显示该层'}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {layer.visible === 1 ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
        <input
          value={layer.name}
          onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-border focus:border-border focus:outline-none"
        />
        <button
          onClick={() => moveLayer(layer.id, 1)}
          disabled={isTop}
          title="上移一层"
          className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          onClick={() => moveLayer(layer.id, -1)}
          disabled={isBottom}
          title="下移一层"
          className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowDown className="size-3.5" />
        </button>
        <button
          onClick={async () => {
            const hint = count > 0 ? `该层上的 ${count} 个标记 / 区域会保留（只是不再归属图层）。` : '';
            if (await askConfirm(`删除图层「${layer.name}」？${hint}`)) deleteLayer(layer.id);
          }}
          title="删除图层"
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[10px]"
          onClick={() => fileRef.current?.click()}
        >
          {layer.asset_id ? <ImageIcon className="size-3" /> : <Upload className="size-3" />}
          {layer.asset_id ? '换图' : '传图'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
        <Select value={layer.blend} onValueChange={(v) => updateLayer(layer.id, { blend: v as MapBlend })}>
          <SelectTrigger className="h-6 w-[86px] text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MAP_BLENDS.map((b) => (
              <SelectItem key={b.value} value={b.value} className="text-[11px]">
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto w-8 shrink-0 text-right text-[10px] text-muted-foreground">
          {Math.round(layer.opacity * 100)}%
        </span>
      </div>

      <Slider
        value={[layer.opacity * 100]}
        min={0}
        max={100}
        step={5}
        onValueChange={([v]) => updateLayer(layer.id, { opacity: v / 100 })}
      />
      {/* 复制一份当前层：多层叠加时经常需要"在这一层之上再加一张" */}
      <button
        onClick={() => {
          const id = addLayer(layer.map_id);
          updateLayer(id, { asset_id: layer.asset_id, blend: layer.blend, opacity: layer.opacity });
        }}
        className="text-[10px] text-muted-foreground hover:text-foreground"
      >
        以此层为模板新建一层
      </button>
    </div>
  );
}


