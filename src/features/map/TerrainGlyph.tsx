/**
 * 地形符号图标（手绘细线 SVG，24×24）
 * ==================================================================
 * 与 PinGlyph 同一套语言：`currentColor` 细线、`strokeWidth` 比默认细一档，
 * **不用 emoji**（用户明确要求）。差别在于地形是"面"，所以：
 *   - 山脉 / 丘陵 / 森林 / 沼泽 / 沙漠 / 草原 / 城池 / 关隘都是线（描边不填色）；
 *   - 河流 / 湖泊是**实心**（一笔弯线画不出"从粗到细"，实心渐收才有那条感觉）。
 * 图形在 24×24 的格子里手工摆过：留 1.5 的边距，旋转/缩放时不会切到线。
 * 加符号的步骤：在 mapTerrain.ts 的 TERRAIN_SYMBOLS 加一行，这里加一条同键的图。
 */
import type { ReactNode } from 'react';
import type { TerrainSymbol } from './mapTerrain';

/** 细线样式（与 PinGlyph 的 strokeWidth 一致） */
const LINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** 实心样式（河流、湖泊：只有填充才画得出"由粗到细"） */
const SOLID = { fill: 'currentColor', stroke: 'none' } as const;

const GLYPHS: Record<TerrainSymbol, ReactNode> = {
  // 连续小三角形（折线山脊）
  mountain: <path {...LINE} d="M2 18 L6 8.5 L10 14.5 L14 6.5 L18.5 13 L22 18" />,
  // 小圆弧 ∩∩
  hill: <path {...LINE} d="M3 18 A4 4 0 0 1 11 18 M13 18 A3.5 3.5 0 0 1 20 18" />,
  // 三棵小树（成片分布靠多落几个）
  forest: (
    <g {...LINE}>
      <path d="M5 9 L8.5 14.5 L1.5 14.5 Z" />
      <path d="M5 14.5 V19" />
      <path d="M13 5.5 L17 12.5 L9 12.5 Z" />
      <path d="M13 12.5 V19" />
      <path d="M19.5 11 L22 15.5 L17 15.5 Z" />
      <path d="M19.5 15.5 V19" />
    </g>
  ),
  // 弯曲的蓝线：自上而下收成一个尖（粗 → 细）
  river: <path {...SOLID} d="M3 3 C7 6.5 5 10.5 8.5 14 C12 17.5 16.5 19 21.5 21.5 C16.5 18 12.5 16 9.5 12.5 C6.5 9 9 5.5 4.5 1.5 Z" />,
  // 不规则封闭区域（刻意画成"扁的、带鼓包"，避免被看成一个点标记）
  lake: <path {...SOLID} d="M6 6.5 C10 4 16 4.5 19.5 7.5 C22.5 10 21.5 14.5 18 16.5 C14 18.8 8 18.5 5 15.5 C2.5 13 3.2 8.5 6 6.5 Z" />,
  // 短横线密集排列
  swamp: <path {...LINE} d="M2.5 8.5 H7 M9.5 8.5 H14 M16.5 8.5 H21.5 M2.5 13.5 H6 M8 13.5 H13 M15 13.5 H18 M20 13.5 H21.5 M4 18.5 H8.5 M11 18.5 H15.5 M18 18.5 H21.5" />,
  // 波浪线 + 点状纹理
  desert: (
    <g>
      <path {...LINE} d="M2 9 Q5 6 8 9 T14 9 T20 9" />
      <path {...LINE} d="M4.5 13.5 Q7 11 9.5 13.5 T14.5 13.5" />
      <circle cx="7" cy="18" r="1" {...SOLID} />
      <circle cx="13" cy="18.5" r="1" {...SOLID} />
      <circle cx="18.5" cy="18" r="1" {...SOLID} />
    </g>
  ),
  // 稀疏短竖线
  grass: <path {...LINE} d="M4 18 V13 M8.5 19 V14.5 M12.5 18 V11 M16.5 19 V14 M20.5 18 V13" />,
  // 城墙轮廓（方形带齿）+ 城门
  walled: <path {...LINE} d="M3.5 19.5 V9 H5.5 V6.5 H8 V9 H10.5 V6.5 H13 V9 H15.5 V6.5 H18 V9 H20.5 V19.5 M3.5 19.5 H20.5 M9.5 19.5 V15 H14.5 V19.5" />,
  // 两侧山形夹一条通道
  pass: <path {...LINE} d="M1.5 18.5 L6 9 L10.5 18.5 M13.5 18.5 L18 9.5 L22.5 18.5 M10.5 14.5 H13.5" />,
};

export function TerrainGlyph({ symbol, className }: { symbol: TerrainSymbol; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      {GLYPHS[symbol] ?? GLYPHS.mountain}
    </svg>
  );
}
