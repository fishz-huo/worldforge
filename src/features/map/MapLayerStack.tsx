/**
 * 地图图层栈（渲染）
 * ------------------------------------------------------------------
 * 从下往上依次画出可见的图层：每层一张底图，各自带不透明度与混合模式。
 *
 * 兼容老数据：v0.2 之前「一张地图 = 一张底图」，图存在 maps.asset_id 上。
 * 那种地图在打开时会被自动补一个同名图层（见 store 的 ensureDefaultLayer），
 * 所以这里只需要认 layers；maps.asset_id 只在"还没有任何图层"时兜底显示一次，
 * 保证老库在任何情况下都不会突然变成空白画布。
 */
import type { MapDef, MapLayer } from '@/types';
import { sortLayers } from '@/types';
import { useAssetUrl } from '@/hooks/useAssetUrl';

/** 单层底图 */
function LayerImage({ layer }: { layer: MapLayer }) {
  const url = useAssetUrl(layer.asset_id);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={layer.name}
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
      style={{ opacity: layer.opacity, mixBlendMode: layer.blend }}
    />
  );
}

export function MapLayerStack({ map, layers }: { map: MapDef; layers: MapLayer[] }) {
  const visible = sortLayers(layers.filter((l) => l.visible === 1 && l.asset_id));
  // 兜底：还没有任何图层时，用地图自己的底图（老数据 / 刚导入的备份）
  if (visible.length === 0) {
    return map.asset_id ? <LayerImage layer={{
      id: 'legacy', map_id: map.id, name: map.name, asset_id: map.asset_id,
      opacity: map.opacity, visible: 1, order_index: 0, blend: 'normal', created_at: 0,
    }} /> : null;
  }
  return (
    <>
      {visible.map((layer) => (
        <LayerImage key={layer.id} layer={layer} />
      ))}
    </>
  );
}
