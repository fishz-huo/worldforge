/**
 * 卡片图库
 * ------------------------------------------------------------------
 * 需求 5：插入角色形象、背景设定图。
 * 一张卡片可以有多张图，可设为封面、可删除。
 */
import { useRef } from 'react';
import { ImagePlus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { removeAsset } from '@/lib/assets';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

/** 单张图片 */
function GalleryItem({
  linkId,
  assetId,
  caption,
  isCover,
  onSetCover,
}: {
  linkId: string;
  assetId: string;
  caption: string;
  isCover: boolean;
  onSetCover: () => void;
}) {
  const url = useAssetUrl(assetId);
  const removeCardAsset = useStore((s) => s.removeCardAsset);
  const assets = useStore((s) => s.assets);
  const asset = assets.find((a) => a.id === assetId);

  return (
    <div className="group relative overflow-hidden rounded-md border border-border">
      {url ? (
        <img src={url} alt={caption || asset?.name || ''} className="h-24 w-full object-cover" />
      ) : (
        <div className="flex h-24 w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
          图片已丢失
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="truncate text-[10px] text-white/90">{asset?.name ?? ''}</span>
        <span className="flex items-center gap-0.5">
          <button
            title={isCover ? '当前封面' : '设为封面'}
            onClick={onSetCover}
            className={cn('rounded p-0.5', isCover ? 'text-amber-400' : 'text-white/80 hover:text-white')}
          >
            <Star className="size-3" />
          </button>
          <button
            title="从卡片移除"
            onClick={() => {
              removeCardAsset(linkId);
              if (confirm('同时从资源库删除这张图片？')) void removeAsset(assetId);
            }}
            className="rounded p-0.5 text-white/80 hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        </span>
      </div>
      {isCover && <span className="absolute left-1 top-1 rounded bg-amber-400/90 px-1 text-[9px] text-black">封面</span>}
    </div>
  );
}

/** 卡片图库区 */
export function CardGallery({ cardId }: { cardId: string }) {
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));
  const cardAssets = useStore((s) => s.cardAssets);
  const addImagesToCard = useStore((s) => s.addImagesToCard);
  const setCoverAsset = useStore((s) => s.setCoverAsset);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!card) return null;
  const links = cardAssets.filter((ca) => ca.card_id === cardId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          共 {links.length} 张图 · 悬停可设封面或删除
        </span>
        <Button variant="outline" size="sm" className="h-6 gap-1 text-[11px]" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="size-3" /> 添加图片
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (files.length) void addImagesToCard(cardId, files);
            e.target.value = '';
          }}
        />
      </div>
      {links.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary"
        >
          <ImagePlus className="size-3.5" /> 点击添加角色形象 / 设定图
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {links.map((link) => (
            <GalleryItem
              key={link.id}
              linkId={link.id}
              assetId={link.asset_id}
              caption={link.caption}
              isCover={card.cover_asset === link.asset_id}
              onSetCover={() => setCoverAsset(cardId, card.cover_asset === link.asset_id ? null : link.asset_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
