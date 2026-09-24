/**
 * 左栏「地形」分组（十个符号的笔刷）
 * ==================================================================
 * 位置紧跟「绘制工具」之后（用户指定）。它是**笔刷**，不是第五个工具：
 * `MapTool` 里不加 'terrain'（越界项 C 未批准），所以笔刷是独立的一份状态，
 * 与「选择/打点/区域/平移」正交 —— 选中笔刷时把工具切回「选择」，
 * 免得左栏同时高亮两个东西。
 *
 * 行为：点一下符号 → 在地图上点/拖就落一个（可连续落，落完笔刷还在）；
 * 再点同一个按钮、按 Esc、切换工具或切到预览，都会退出笔刷。
 * 每次落都带默认色与该符号的中文名（见 useMapTerrain）。
 */
import { cn } from '@/lib/utils';
import type { TerrainSymbol } from './mapTerrain';
import { TERRAIN_SYMBOLS } from './mapTerrain';
import { TerrainGlyph } from './TerrainGlyph';

interface Props {
  /** 当前笔刷（null = 没在画地形） */
  brush: TerrainSymbol | null;
  /** 点同一个符号视为取消笔刷 */
  onPick: (symbol: TerrainSymbol | null) => void;
}

export function TerrainPalette({ brush, onPick }: Props) {
  const def = brush ? TERRAIN_SYMBOLS.find((d) => d.key === brush) : null;

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-5 gap-1">
        {TERRAIN_SYMBOLS.map((d) => {
          const active = brush === d.key;
          return (
            <button
              key={d.key}
              type="button"
              title={`${d.label} —— ${active ? '再点一次退出笔刷' : '选中后在地图上点击或拖动画出来'}`}
              onClick={() => onPick(active ? null : d.key)}
              className={cn(
                'flex h-10 flex-col items-center justify-center gap-0.5 rounded-md border text-[10px] transition-colors',
                active
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              {/* 图标用该符号在地图上的默认色，一眼能对上 */}
              <TerrainGlyph symbol={d.key} className="size-4" />
              <span style={active ? undefined : { color: d.color }}>{d.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {def
          ? `正在画「${def.label}」：在图上点击落一个（按住可拖到位）；再点一次该按钮或按 Esc 退出。`
          : '选一个符号当笔刷，然后在图上点击/拖动。落好后用右下角方块缩放、上方圆点旋转。'}
      </p>
    </div>
  );
}
