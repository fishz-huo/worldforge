/**
 * Map Slice —— 地图、标记点、区域与资源
 * ------------------------------------------------------------------
 * 需求 2：可视化地图编辑器。
 * 坐标全部归一化（0~1），因此底图尺寸变化、窗口缩放都不会错位。
 * 一个世界观可以有多张地图（不同时期 / 不同分支），用于表现疆域与资源的变化。
 */
import type { MapDef, MapPin, MapRegion } from '@/types';
import { emptyMap } from '@/types';
import { newMapId, newPinId, newRegionId } from '@/lib/id';
import { mapsRepo, pinsRepo, regionsRepo } from '@/lib/db';
import { purgeMap } from '@/lib/db/purge';
import { removeById, removeWhere, upsert } from '../helpers';
import type { Slice } from '../types';

export interface MapSlice {
  /** 新建地图，返回 mapId */
  createMap: (name: string) => string;
  updateMap: (id: string, patch: Partial<MapDef>) => void;
  deleteMap: (id: string) => void;
  /** 新建标记点（归一化坐标） */
  addPin: (mapId: string, x: number, y: number, init?: Partial<MapPin>) => string;
  updatePin: (id: string, patch: Partial<MapPin>) => void;
  deletePin: (id: string) => void;
  /** 新建区域：默认给一个菱形，用户再拖拽顶点 */
  addRegion: (mapId: string) => string;
  updateRegion: (id: string, patch: Partial<MapRegion>) => void;
  appendRegionPoint: (id: string, point: [number, number]) => void;
  removeRegionPoint: (id: string, index: number) => void;
  moveRegionPoint: (id: string, index: number, point: [number, number]) => void;
  deleteRegion: (id: string) => void;
}

export const createMapSlice: Slice<MapSlice> = (set, get) => ({
  createMap: (name) => {
    const worldId = get().currentWorldId;
    if (!worldId) return '';
    const now = Date.now();
    const map: MapDef = {
      ...emptyMap(worldId, get().currentBranchId, name),
      id: newMapId(),
      created_at: now,
      updated_at: now,
    };
    mapsRepo.save(map);
    set({ maps: [...get().maps, map], selectedMapId: map.id });
    get().toast(`已创建地图「${name}」`, 'success');
    return map.id;
  },

  updateMap: (id, patch) => {
    const map = get().maps.find((m) => m.id === id);
    if (!map) return;
    const next = { ...map, ...patch, updated_at: Date.now() };
    mapsRepo.save(next);
    set({ maps: upsert(get().maps, next) });
  },

  deleteMap: (id) => {
    purgeMap(id);
    set({
      maps: removeById(get().maps, id),
      pins: removeWhere(get().pins, (p) => p.map_id === id),
      regions: removeWhere(get().regions, (r) => r.map_id === id),
      selectedMapId: get().selectedMapId === id ? null : get().selectedMapId,
    });
    get().toast('地图已删除', 'warn');
  },

  addPin: (mapId, x, y, init = {}) => {
    const pin: MapPin = {
      id: newPinId(),
      map_id: mapId,
      card_id: init.card_id ?? null,
      x,
      y,
      label: init.label ?? '新标记',
      icon: init.icon ?? '📍',
      color: init.color ?? '#ef4444',
      note: init.note ?? '',
    };
    pinsRepo.save(pin);
    set({ pins: [...get().pins, pin] });
    return pin.id;
  },

  updatePin: (id, patch) => {
    const pin = get().pins.find((p) => p.id === id);
    if (!pin) return;
    const next = { ...pin, ...patch };
    pinsRepo.save(next);
    set({ pins: upsert(get().pins, next) });
  },

  deletePin: (id) => {
    pinsRepo.remove(id);
    set({ pins: removeById(get().pins, id) });
  },

  addRegion: (mapId) => {
    const region: MapRegion = {
      id: newRegionId(),
      map_id: mapId,
      name: `新区域 ${get().regions.filter((r) => r.map_id === mapId).length + 1}`,
      color: '#38bdf8',
      // 默认一个居中的菱形，避免用户从零开始画
      points: [[0.45, 0.35], [0.6, 0.45], [0.55, 0.62], [0.38, 0.55]],
      resources: {},
      period: get().maps.find((m) => m.id === mapId)?.period ?? '',
      note: '',
    };
    regionsRepo.save(region);
    set({ regions: [...get().regions, region] });
    return region.id;
  },

  updateRegion: (id, patch) => {
    const region = get().regions.find((r) => r.id === id);
    if (!region) return;
    const next = { ...region, ...patch };
    regionsRepo.save(next);
    set({ regions: upsert(get().regions, next) });
  },

  appendRegionPoint: (id, point) => {
    const region = get().regions.find((r) => r.id === id);
    if (!region) return;
    get().updateRegion(id, { points: [...region.points, point] });
  },

  removeRegionPoint: (id, index) => {
    const region = get().regions.find((r) => r.id === id);
    if (!region || region.points.length <= 3) return;
    get().updateRegion(id, { points: region.points.filter((_, i) => i !== index) });
  },

  moveRegionPoint: (id, index, point) => {
    const region = get().regions.find((r) => r.id === id);
    if (!region) return;
    const points = region.points.map((p, i) => (i === index ? point : p));
    get().updateRegion(id, { points });
  },

  deleteRegion: (id) => {
    regionsRepo.remove(id);
    set({ regions: removeById(get().regions, id) });
  },
});
