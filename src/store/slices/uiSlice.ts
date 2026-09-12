/**
 * UI Slice —— 布局、主题、选中项、筛选条件、轻提示
 * ------------------------------------------------------------------
 * 对应需求 6：「界面简约易看，能够隐藏不需要的部分，需要时能方便调出来」。
 * 布局开关（rail / sidebar / inspector）与主题都会持久化到 localStorage。
 */
import { newId } from '@/lib/id';
import { loadPrefs, savePrefs } from '../prefs';
import type { ModuleKey, Slice, Toast, UiState } from '../types';

const saved = loadPrefs();

export interface UiSlice extends UiState {
  /** 切换主模块 */
  setModule: (module: ModuleKey) => void;
  /** 显隐左侧图标栏 */
  setRailOpen: (open: boolean) => void;
  /** 显隐次级侧栏（列表/筛选区） */
  setSidebarOpen: (open: boolean) => void;
  /** 显隐右侧检查器 */
  setInspectorOpen: (open: boolean) => void;
  /** 一键专注模式：三栏全部收起，只留内容区 */
  toggleFocus: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setAccent: (accent: string) => void;
  setPaletteOpen: (open: boolean) => void;
  setBranchScope: (scope: 'current' | 'all') => void;
  /** 选中一张卡片（会展开右侧检查器） */
  selectCard: (id: string | null) => void;
  setCardType: (type: string | null) => void;
  toggleTagFilter: (tagId: string) => void;
  setTagFilter: (ids: string[]) => void;
  clearFilters: () => void;
  setSearch: (q: string) => void;
  setPinnedOnly: (v: boolean) => void;
  selectMap: (id: string | null) => void;
  selectDoc: (id: string | null) => void;
  selectOutline: (id: string | null) => void;
  selectVersion: (id: string | null) => void;
  selectEntry: (id: string | null) => void;
  setCardColumns: (n: 2 | 3 | 4) => void;
  setEditorSplit: (v: boolean) => void;
  setEditorFontSize: (n: number) => void;
  toast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
}

export const createUiSlice: Slice<UiSlice> = (set, get) => ({
  // 初始值来自 localStorage 偏好
  module: saved.module,
  railOpen: saved.railOpen,
  sidebarOpen: saved.sidebarOpen,
  inspectorOpen: saved.inspectorOpen,
  focusMode: false,
  theme: saved.theme,
  accent: saved.accent,
  paletteOpen: false,
  branchScope: saved.branchScope,
  selectedCardId: null,
  selectedCardType: null,
  selectedTagIds: [],
  search: '',
  pinnedOnly: false,
  selectedMapId: null,
  selectedDocId: null,
  selectedOutlineId: null,
  selectedVersionId: null,
  selectedEntryId: null,
  toasts: [],
  cardColumns: saved.cardColumns,
  editorSplit: saved.editorSplit,
  editorFontSize: saved.editorFontSize,

  setModule: (module) => {
    set({ module });
    savePrefs({ module });
  },
  setRailOpen: (railOpen) => {
    set({ railOpen });
    savePrefs({ railOpen });
  },
  setSidebarOpen: (sidebarOpen) => {
    set({ sidebarOpen });
    savePrefs({ sidebarOpen });
  },
  setInspectorOpen: (inspectorOpen) => {
    set({ inspectorOpen });
    savePrefs({ inspectorOpen });
  },
  toggleFocus: () => {
    const next = !get().focusMode;
    // 进入专注模式时记住原布局，退出时还原
    if (next) {
      savePrefs({ railOpen: get().railOpen, sidebarOpen: get().sidebarOpen, inspectorOpen: get().inspectorOpen });
      set({ focusMode: true, railOpen: false, sidebarOpen: false, inspectorOpen: false });
    } else {
      set({ focusMode: false, railOpen: saved.railOpen, sidebarOpen: saved.sidebarOpen, inspectorOpen: saved.inspectorOpen });
    }
  },
  setTheme: (theme) => {
    set({ theme });
    savePrefs({ theme });
  },
  setAccent: (accent) => {
    set({ accent });
    savePrefs({ accent });
  },
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setBranchScope: (branchScope) => {
    set({ branchScope });
    savePrefs({ branchScope });
  },
  selectCard: (selectedCardId) => set({ selectedCardId, inspectorOpen: selectedCardId ? true : get().inspectorOpen }),
  setCardType: (selectedCardType) => set({ selectedCardType }),
  toggleTagFilter: (tagId) => {
    const list = get().selectedTagIds;
    set({ selectedTagIds: list.includes(tagId) ? list.filter((t) => t !== tagId) : [...list, tagId] });
  },
  setTagFilter: (selectedTagIds) => set({ selectedTagIds }),
  clearFilters: () => set({ selectedTagIds: [], search: '', selectedCardType: null, pinnedOnly: false }),
  setSearch: (search) => set({ search }),
  setPinnedOnly: (pinnedOnly) => set({ pinnedOnly }),
  selectMap: (selectedMapId) => set({ selectedMapId }),
  selectDoc: (selectedDocId) => set({ selectedDocId }),
  selectOutline: (selectedOutlineId) => set({ selectedOutlineId }),
  selectVersion: (selectedVersionId) => set({ selectedVersionId }),
  selectEntry: (selectedEntryId) => set({ selectedEntryId }),
  setCardColumns: (cardColumns) => {
    set({ cardColumns });
    savePrefs({ cardColumns });
  },
  setEditorSplit: (editorSplit) => {
    set({ editorSplit });
    savePrefs({ editorSplit });
  },
  setEditorFontSize: (editorFontSize) => {
    set({ editorFontSize });
    savePrefs({ editorFontSize });
  },
  toast: (message, kind = 'info') => {
    const item: Toast = { id: newId('n'), message, kind, at: Date.now() };
    set({ toasts: [...get().toasts, item] });
    // 3 秒后自动消失
    setTimeout(() => get().dismissToast(item.id), 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
});
