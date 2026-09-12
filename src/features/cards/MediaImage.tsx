/**
 * 通用图片组件
 * ------------------------------------------------------------------
 * 从 IndexedDB 取回 Blob 并渲染，带加载失败占位。
 */
import { ImageOff } from 'lucide-react';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { cn } from '@/lib/utils';

export function MediaImage({
  assetId,
  alt = '',
  className,
  onClick,
}: {
  assetId: string | null | undefined;
  alt?: string;
  className?: string;
  onClick?: () => void;
}) {
  const url = useAssetUrl(assetId);
  if (!assetId || !url) {
    return (
      <div className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="size-4" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={cn('object-cover', className)} onClick={onClick} loading="lazy" />;
}
