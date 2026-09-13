/**
 * 图标组件
 * ------------------------------------------------------------------
 * 卡片类型、泳道类别、插件面板都用「图标名」声明图标（便于存进数据库与插件清单）。
 * 这里维护一份显式映射，而不是 `import * as lucide`，否则会把上千个图标打进产物。
 */
import {
  Atom, BarChart3, BookOpen, Bot, Boxes, Brush, Bug, Calendar, Compass, Cpu,
  Dices, FileOutput, FileText, Flag, Gem, GitBranch, Globe2, HelpCircle, Image, Layers,
  LayoutDashboard, Library, Link2, ListTree, Map as MapIcon, MapPin, Mountain,
  Network, Palette, PanelRight, Puzzle, Route, Scroll, Search, Settings, Sparkles,
  StickyNote, Swords, Tag, Timer, User, Users, Wand2, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** 名称 → 图标组件 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Atom, BarChart3, BookOpen, Bot, Boxes, Brush, Bug, Calendar, Compass, Cpu,
  Dices, FileOutput, FileText, Flag, Gem, GitBranch, Globe2, HelpCircle, Image, Layers,
  LayoutDashboard, Library, Link2, ListTree, Map: MapIcon, MapPin, Mountain,
  Network, Palette, PanelRight, Puzzle, Route, Scroll, Search, Settings, Sparkles,
  StickyNote, Swords, Tag, Timer, User, Users, Wand2, Zap,
};

/** 按名称渲染图标；未知名称回落到问号图标 */
export function Icon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Cmp = ICON_MAP[name] ?? HelpCircle;
  return <Cmp className={className} style={style} />;
}

/** 供选择器使用的图标名列表 */
export const ICON_NAMES = Object.keys(ICON_MAP).sort();
