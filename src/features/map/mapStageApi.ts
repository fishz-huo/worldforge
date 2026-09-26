/**
 * 地图舞台与外层画布的 props 契约
 * ==================================================================
 * 抽出来的原因与 mapViewportApi.ts 完全一样：MapCanvas 与 MapStage 的 props
 * 加起来一百多行，写在各组件里会把两个文件都顶到「单文件 ≤200 行」那条自测
 * （第三批加地形之后实测 248 / 263 行）。
 *
 * 组内再分三块（data / view / actions）是为了**调用点**也能短下来：否则
 * MapModule 里那一段 `<MapStage …/>` 光传参就有五十行。组件内部仍然逐项转发，
 * 不做任何推断 —— 类型搬家，行为一行不变。
 */
import type { MapDef, MapPin, MapRegion, MapTool } from '@/types';
import type { TerrainSymbol } from './mapTerrain';
import type { MapViewMode } from './mapRender';
import type { MapSelectionItem } from './mapSelection';
import type { MapSpotBind, MapSpots } from './MapSpotLayer';
import type { Size } from './mapViewport';
import type { MapViewportApi } from './mapViewportApi';

/** 画布的只读内容 */
export interface MapCanvasProps {
  map: MapDef;
  pins: MapPin[];
  regions: MapRegion[];
  /** 地形符号（也来自 map_pins，按 meta.kind 分出来的） */
  terrain: MapPin[];
  tool: MapTool;
  /** 平移态（选中「平移」工具，或按住空格）：元素让路、光标变手 */
  panMode: boolean;
  /** 是否按住 Alt：顶点光标换「−」，点击即删 */
  altHeld: boolean;
  /** 编辑 / 预览：预览下不落点、不写坐标、不显示网格与手柄 */
  viewMode: MapViewMode;
  /** 底图的世界尺寸（原始像素），视口按它换算 */
  world: Size;
  viewport: MapViewportApi;
  /** 悬停/点击浮窗的事件（见 MapSpotLayer） */
  spots: MapSpotBind;
  /** 把底图实测到的真实像素尺寸回报给模块 */
  onNaturalSize: (size: Size) => void;
  /** 三种对象各自的选中 id 清单（点选 0~1 个、框选可以好几个，见 useMapSelection） */
  selectedPinIds: string[];
  selectedRegionIds: string[];
  selectedTerrainIds: string[];
  hoveredPinId: string | null;
  hoveredRegionId: string | null;
  /** 区域显示模式：填充 / 仅轮廓 / 资源热度 */
  regionMode: 'fill' | 'outline' | 'resource';
  resourceKey: keyof NonNullable<MapRegion['resources']>;
  showLabels: boolean;
  onCanvasClick: (x: number, y: number) => void;
  onPinMove: (pinId: string, x: number, y: number) => void;
  onPinSelect: (pinId: string | null) => void;
  onRegionSelect: (regionId: string | null) => void;
  onRegionPointMove: (regionId: string, index: number, x: number, y: number) => void;
  /** 整体移动区域 / 边缘加顶点：一次写回一串归一化顶点（一帧一次，不逐点写） */
  onRegionPoints: (regionId: string, points: [number, number][]) => void;
  /** 删一个顶点（store 自带「不足 3 个不删」的保护） */
  onRegionRemovePoint: (regionId: string, index: number) => void;
  /** 区域工具在空白处拖出一个矩形：按这两个归一化对角点新建一个区域 */
  onRegionCreate: (a: [number, number], b: [number, number]) => void;
  /** 地形笔刷（null = 没在画地形）；落点后返回新行 id，好让它立刻跟手 */
  terrainBrush: TerrainSymbol | null;
  onTerrainPlace: (x: number, y: number) => string | null;
  onTerrainSelect: (pinId: string | null) => void;
  onTerrainMove: (pinId: string, x: number, y: number) => void;
  onTerrainResize: (pinId: string, size: number) => void;
  onTerrainRotate: (pinId: string, rotation: number) => void;
  /** 框选提交（items 为空 = 没框到；additive = 按住 Shift 追加） */
  onMarqueeSelect: (items: MapSelectionItem[], additive: boolean) => void;
  /** Esc 清空选中（没在画笔刷时，见 useMarquee） */
  onSelectionClear: () => void;
  /** 打点工具下按 Esc：把工具收回「选择」（同一个 Esc 决策点里的一支，见 useMarquee） */
  onToolExit: () => void;
  className?: string;
}

/** 舞台要画的数据（都是模块已经算好的） */
export interface MapStageData {
  /** 普通标记（已按 meta.kind 剔除地形） */
  pins: MapPin[];
  regions: MapRegion[];
  terrain: MapPin[];
  pinCount: number;
  terrainCount: number;
}

/** 舞台的选中与显示状态 */
export interface MapStageView {
  selectedPinIds: string[];
  selectedRegionIds: string[];
  selectedTerrainIds: string[];
  hoveredPinId: string | null;
  hoveredRegionId: string | null;
  regionMode: 'fill' | 'outline' | 'resource';
  resourceKey: keyof NonNullable<MapRegion['resources']>;
  showLabels: boolean;
}

/** 舞台的动作（全部由 MapModule 提供实现，这里只声明） */
export interface MapStageActions {
  onModeChange: (next: MapViewMode) => void;
  /** 换工具与「新建区域」的入口都在左栏（工具条那份重复的已于 2026-09-25 删掉） */
  onNaturalSize: (size: Size) => void;
  onCanvasClick: (x: number, y: number) => void;
  onPinMove: (pinId: string, x: number, y: number) => void;
  onPinSelect: (pinId: string | null) => void;
  onRegionSelect: (regionId: string | null) => void;
  onRegionPointMove: (regionId: string, index: number, x: number, y: number) => void;
  onRegionPoints: (regionId: string, points: [number, number][]) => void;
  onRegionRemovePoint: (regionId: string, index: number) => void;
  onRegionCreate: (a: [number, number], b: [number, number]) => void;
  onTerrainPlace: (x: number, y: number) => string | null;
  onTerrainSelect: (pinId: string | null) => void;
  onTerrainMove: (pinId: string, x: number, y: number) => void;
  onTerrainResize: (pinId: string, size: number) => void;
  onTerrainRotate: (pinId: string, rotation: number) => void;
  /** 框选的提交与 Esc 清空（都落到 useMapSelection 的选择集上） */
  onMarqueeSelect: (items: MapSelectionItem[], additive: boolean) => void;
  onSelectionClear: () => void;
  onToolExit: () => void;
}

/** MapStage 的全部入参 */
export interface MapStageProps {
  map: MapDef;
  mode: MapViewMode;
  tool: MapTool;
  brush: TerrainSymbol | null;
  world: Size;
  viewport: MapViewportApi;
  spots: MapSpots;
  panMode: boolean;
  altHeld: boolean;
  data: MapStageData;
  view: MapStageView;
  actions: MapStageActions;
}
