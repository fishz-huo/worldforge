/**
 * 主模块清单
 * ------------------------------------------------------------------
 * 左侧导航栏与命令面板都从这里读取，新增模块只需在这里加一项。
 */
import type { ModuleKey } from '@/store/types';

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  /** lucide 图标名，见 components/Icon.tsx 的映射表 */
  icon: string;
  hint: string;
}

/** 全部主模块（顺序即导航顺序） */
export const MODULES: ModuleDef[] = [
  { key: 'board', label: '总览', icon: 'LayoutDashboard', hint: '世界观健康度与最近编辑' },
  { key: 'cards', label: '卡片 Wiki', icon: 'Boxes', hint: '角色 / 地点 / 事件 / 底层逻辑 / 参考' },
  { key: 'map', label: '地图', icon: 'Map', hint: '多时期地图、标记点、区域与资源' },
  { key: 'timeline', label: '时间轴', icon: 'Timer', hint: '事件、角色生命线、地理与科技变化' },
  { key: 'writer', label: '写作', icon: 'FileText', hint: '零切换正文编辑，悬浮预览设定卡' },
  { key: 'outline', label: '大纲', icon: 'ListTree', hint: '文本 / 树形 / 思维导图三视图' },
  { key: 'versions', label: '版本', icon: 'GitBranch', hint: '设定快照与差异对比' },
  { key: 'plugins', label: '插件', icon: 'Puzzle', hint: '插口、面板与主题' },
  { key: 'settings', label: '设置', icon: 'Settings', hint: '外观、数据与世界观配置' },
];

/** 按 key 取模块定义 */
export function moduleOf(key: ModuleKey): ModuleDef {
  return MODULES.find((m) => m.key === key) ?? MODULES[0];
}
