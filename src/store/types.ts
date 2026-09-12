/**
 * Store 类型定义
 * ------------------------------------------------------------------
 * zustand 的 slice 模式需要把各 slice 的类型汇总成一个 AppStore。
 * 这里只做类型汇总，运行时逻辑分散在 slices/ 目录，保证单文件不超过 200 行。
 */
import type { StateCreator } from 'zustand';
import type { Asset, Branch, Card, CardAsset, Doc, Era, MapDef, MapPin, MapRegion, OutlineNode, PluginRecord, Relation, Tag, TimelineEntry, Track, Version, World } from '@/types';

/** 主模块标识（左侧导航栏） */
export type ModuleKey =
  | 'board'
  | 'cards'
  | 'map'
  | 'timeline'
  | 'writer'
  | 'outline'
  | 'versions'
  | 'plugins'
  | 'settings';

/** 轻提示 */
export interface Toast {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'warn' | 'error';
  at: number;
}

/** 应用数据快照（当前世界观 + 当前分支可见的全部实体） */
export interface DataState {
  ready: boolean;
  error: string;
  worlds: World[];
  branches: Branch[];
  currentWorldId: string | null;
  /** null 表示「主世界」视角 */
  currentBranchId: string | null;
  cards: Card[];
  cardAssets: CardAsset[];
  tags: Tag[];
  cardTags: { card_id: string; tag_id: string }[];
  relations: Relation[];
  maps: MapDef[];
  pins: MapPin[];
  regions: MapRegion[];
  tracks: Track[];
  entries: TimelineEntry[];
  eras: Era[];
  docs: Doc[];
  outlineNodes: OutlineNode[];
  versions: Version[];
  assets: Asset[];
  plugins: PluginRecord[];
}

/** UI 状态 */
export interface UiState {
  module: ModuleKey;
  railOpen: boolean;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  focusMode: boolean;
  theme: 'dark' | 'light';
  accent: string;
  paletteOpen: boolean;
  branchScope: 'current' | 'all';
  selectedCardId: string | null;
  selectedCardType: string | null;
  selectedTagIds: string[];
  search: string;
  /** 卡片库：仅显示置顶卡片 */
  pinnedOnly: boolean;
  selectedMapId: string | null;
  selectedDocId: string | null;
  selectedOutlineId: string | null;
  selectedVersionId: string | null;
  selectedEntryId: string | null;
  toasts: Toast[];
  cardColumns: 2 | 3 | 4;
  editorSplit: boolean;
  editorFontSize: number;
}

/** 各 slice 的合并类型（具体签名见对应文件） */
export type AppStore = DataState &
  UiState &
  import('./slices/uiSlice').UiSlice &
  import('./slices/dataSlice').DataSlice &
  import('./slices/worldSlice').WorldSlice &
  import('./slices/cardSlice').CardSlice &
  import('./slices/tagSlice').TagSlice &
  import('./slices/mapSlice').MapSlice &
  import('./slices/timelineSlice').TimelineSlice &
  import('./slices/docSlice').DocSlice &
  import('./slices/outlineSlice').OutlineSlice &
  import('./slices/versionSlice').VersionSlice &
  import('./slices/pluginSlice').PluginSlice;

/** slice 创建器简写 */
export type Slice<T> = StateCreator<AppStore, [], [], T>;
