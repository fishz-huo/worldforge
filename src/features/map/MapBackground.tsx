/**
 * 地图底图（渲染）
 * ------------------------------------------------------------------
 * v0.1 的模型：一张地图 = 一张底图，图与不透明度都存在 maps 上。
 * v0.2 一度改成「多层底图」，但图层既不能分层管理标记、也不参与坐标变换，
 * 实际只是把"换底图"这件事变复杂了（用户反馈：很鸡肋），已整体撤掉。
 *
 * 这个组件是唯一读 `maps.asset_id` 的地方：底图缺失时返回 null，
 * 画布照常可以摆标记。
 *
 * 第二批改动：世界盒按底图**真实长宽比**生成（见 useMapViewport），所以这里
 * 只需铺满盒子、不用再靠 object-fill 把图拉满整个画布（那样方图会被拉扁）。
 * 另外把图片的真实像素尺寸回报给模块：老底图可能没记 width/height，
 * 量到之后视口才能按正确比例「适应屏幕」。
 */
import type { MapDef } from '@/types';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import type { Size } from './mapViewport';

export function MapBackground({
  map,
  world,
  onNaturalSize,
}: {
  map: MapDef;
  /** 当前的世界盒尺寸：用来判断实测值是不是新信息（避免无谓重渲染） */
  world: Size;
  onNaturalSize: (size: Size) => void;
}) {
  const url = useAssetUrl(map.asset_id);
  if (!url) return null;

  return (
    <img
      src={url}
      alt={map.name}
      draggable={false}
      data-wf-map-bg
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
        if (img.naturalWidth !== world.w || img.naturalHeight !== world.h) {
          onNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        }
      }}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
      style={{ opacity: map.opacity }}
    />
  );
}
