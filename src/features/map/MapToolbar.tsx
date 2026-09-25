/**
 * 地图工具条
 * ==================================================================
 * 从 MapModule 抽出来（那个文件接上视口与浮窗后顶到 200 行上限）。
 *
 * 高度规则不要改动：整条 min-h-9（36px，含自己的 border-b）与左右面板标题行
 * 的 h-9 底边齐平（用户 2026-09-24 选的方案 B：宁可改自己模块的高度，
 * 也不去动全应用共用的外壳）；同一条工具条里的控件统一 h-8 + items-center +
 * gap-2。窄窗口下这一行 flex-wrap 换行（固定高会把第二行裁掉）。
 *
 * 2026-09-25 单行化（用户选的方案 A）：删掉这里的「选择 / 打点模式 / 新建区域」
 * 与那两条竖分隔线 —— 这三个与左栏「绘制工具」的四格、「区域」分组下的
 * 「新建区域」完全重复，删掉重复的那一份比缩成图标硬塞更干净。
 * 数字：单行需要 801px、门槛是窗口 1449px，改前 1440 / 1326 / 1280 都是 57px 两行；
 * 删掉后只需要 540px、门槛降到 1188px（1326 宽余 138px），此后任何真实布局都不再换行。
 * 代价（用户已知并接受）：工具条不再显示"当前工具"，左栏收起或专注模式下换工具
 * 要先把左栏放出来。换工具的入口只有左栏「绘制工具」（选择 / 打点 / 区域 / 平移）
 * 与左栏的「新建区域」；这里也不再放「平移」——按住空格 / 中键随时能拖画布。
 * 工具条的职责现在只剩「这张地图是什么 + 编辑 / 预览开关」。
 *
 * 另：2026-09-25「导出图片」入口已搬到左栏常驻分组（原先是一个 extra 插槽，
 * 留着会占 32px 把工具条在 1440 宽挤成两行），插槽与那条多余的竖分隔线一并删掉。
 */
import type { MapDef } from '@/types';
import { MapModeSwitch } from './MapModeSwitch';
import type { MapViewMode } from './mapRender';

export function MapToolbar({
  map,
  pinCount,
  regionCount,
  terrainCount,
  mode,
  onModeChange,
}: {
  map: MapDef;
  pinCount: number;
  regionCount: number;
  /** 地形符号数（也是 map_pins 的行，按 meta.kind 分开数） */
  terrainCount: number;
  mode: MapViewMode;
  onModeChange: (next: MapViewMode) => void;
}) {
  return (
    <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 text-xs">
      <span className="font-medium">{map.name}</span>
      {map.period && <span className="text-muted-foreground">· {map.period}</span>}
      <span className="text-muted-foreground">
        · 标记 {pinCount} · 区域 {regionCount} · 地形 {terrainCount}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <MapModeSwitch mode={mode} onChange={onModeChange} />
      </div>
    </div>
  );
}
