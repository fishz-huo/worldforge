/**
 * 地图图层的操作（store slice 片段）
 * ------------------------------------------------------------------
 * 与地图本体分开的原因：图层是一组独立的增删改（还带"上移下移"这种位置运算），
 * 塞进 mapSlice 会把那个文件顶过 200 行上限。
 * 这里只提供动作，状态字段（layers）仍然声明在 DataState 里，
 * 由 mapSlice 通过展开合并进来，对外看起来还是一个 slice。
 */
import type { MapLayer } from '@/types';
import { clampOpacity, emptyLayer, sortLayers } from '@/types';
import { newLayerId } from '@/lib/id';
import { layersRepo, pinsRepo, regionsRepo } from '@/lib/db';
import { removeById, upsert } from '../helpers';
import type { Slice } from '../types';

export interface MapLayerActions {
  /** 新建图层（默认叠在最上面），返回 layerId */
  addLayer: (mapId: string, name?: string) => string;
  updateLayer: (id: string, patch: Partial<MapLayer>) => void;
  deleteLayer: (id: string) => void;
  /** 上移 / 下移一层（与相邻层交换 order_index） */
  moveLayer: (id: string, delta: 1 | -1) => void;
  /** 把某个标记 / 区域指派到图层（layerId 传 null 表示不归属任何层） */
  assignPinLayer: (pinId: string, layerId: string | null) => void;
  assignRegionLayer: (regionId: string, layerId: string | null) => void;
}

export const createMapLayerActions: Slice<MapLayerActions> = (set, get) => ({
  addLayer: (mapId, name) => {
    const siblings = get().layers.filter((l) => l.map_id === mapId);
    const layer: MapLayer = {
      ...emptyLayer(mapId, name ?? `图层 ${siblings.length + 1}`, siblings.length),
      id: newLayerId(),
      created_at: Date.now(),
    };
    layersRepo.save(layer);
    set({ layers: [...get().layers, layer] });
    return layer.id;
  },

  updateLayer: (id, patch) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;
    const next: MapLayer = {
      ...layer,
      ...patch,
      // 不透明度统一夹到 0~1：滑杆之外还可能被插件 / 手写数值改
      opacity: patch.opacity === undefined ? layer.opacity : clampOpacity(patch.opacity),
    };
    layersRepo.save(next);
    set({ layers: upsert(get().layers, next) });
  },

  /**
   * 删除图层。
   * 层里的标记与区域**不跟着删**：它们是内容，删层只是删掉一层底图。
   * 归属被清空（回到"不归属任何层"），用户不会因此丢数据。
   */
  deleteLayer: (id) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;
    layersRepo.remove(id);
    get().pins.filter((p) => p.layer_id === id).forEach((p) => pinsRepo.save({ ...p, layer_id: null }));
    get().regions.filter((r) => r.layer_id === id).forEach((r) => regionsRepo.save({ ...r, layer_id: null }));
    set({
      layers: removeById(get().layers, id),
      pins: get().pins.map((p) => (p.layer_id === id ? { ...p, layer_id: null } : p)),
      regions: get().regions.map((r) => (r.layer_id === id ? { ...r, layer_id: null } : r)),
    });
    get().toast('图层已删除，层上的标记与区域保留', 'warn');
  },

  moveLayer: (id, delta) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;
    const siblings = sortLayers(get().layers.filter((l) => l.map_id === layer.map_id));
    const swapWith = siblings[siblings.findIndex((l) => l.id === id) + delta];
    if (!swapWith) return;
    // 只交换这两条的 order_index，其余层不动
    const a = { ...layer, order_index: swapWith.order_index };
    const b = { ...swapWith, order_index: layer.order_index };
    layersRepo.save(a);
    layersRepo.save(b);
    set({ layers: get().layers.map((l) => (l.id === a.id ? a : l.id === b.id ? b : l)) });
  },

  assignPinLayer: (pinId, layerId) => get().updatePin(pinId, { layer_id: layerId }),

  assignRegionLayer: (regionId, layerId) => get().updateRegion(regionId, { layer_id: layerId }),
});
