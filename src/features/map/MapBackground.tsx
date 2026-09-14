/**
 * 地图底图（渲染）
 * ------------------------------------------------------------------
 * v0.1 的模型：一张地图 = 一张底图，图与不透明度都存在 maps 上。
 * v0.2 一度改成「多层底图」，但图层既不能分层管理标记、也不参与坐标变换，
 * 实际只是把"换底图"这件事变复杂了（用户反馈：很鸡肋），已整体撤掉。
 *
 * 这个组件保留下来是因为它是唯一读 `maps.asset_id` 的地方：
 * 底图缺失时返回 null，画布照常可以摆标记。
 */
import type { MapDef } from '@/types';
import { useAssetUrl } from '@/hooks/useAssetUrl';

export function MapBackground({ map }: { map: MapDef }) {
  const url = useAssetUrl(map.asset_id);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={map.name}
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
      style={{ opacity: map.opacity }}
    />
  );
}
