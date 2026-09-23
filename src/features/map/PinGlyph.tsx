/**
 * 标记图标（细线 SVG）
 * ------------------------------------------------------------------
 * 设计稿要求打点用「白底圆 + 细边框 + 细线图标」，不再拿 emoji 当图标。
 * 数据库里的 icon 字段保持原样（还是自由文本），这里只做一层**渲染映射**：
 *   1. 先按图标名认（city / harbor / tower / ruins / mine …）；
 *   2. 再按老数据里的 emoji 认（⚓ → Anchor、🏰 → Castle …）；
 *   3. 都不认识就回落成通用图钉 —— 不会把 emoji 画出来。
 * 想加图标：在 KINDS 里加一行（PinEditor 的快捷按钮取前 5 个），
 * 需要的话再补一条 emoji 别名。
 */
import {
  Anchor, Castle, Church, Crown, Fence, Flag, Gem, Landmark, MapPin as MapPinIcon,
  Mountain, Pickaxe, Swords, Tent, TowerControl, Trees, Warehouse, Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** 可选图标：前 5 个就是「城市 / 港口 / 塔 / 遗迹 / 矿镇」 */
export const PIN_GLYPH_KINDS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'city', label: '城市', Icon: Castle },
  { key: 'harbor', label: '港口', Icon: Anchor },
  { key: 'tower', label: '塔', Icon: TowerControl },
  { key: 'ruins', label: '遗迹', Icon: Landmark },
  { key: 'mine', label: '矿镇', Icon: Pickaxe },
  { key: 'camp', label: '营寨', Icon: Tent },
  { key: 'shrine', label: '圣地', Icon: Church },
  { key: 'peak', label: '险地', Icon: Mountain },
  { key: 'battle', label: '战场', Icon: Swords },
  { key: 'forest', label: '林地', Icon: Trees },
  { key: 'sea', label: '海域', Icon: Waves },
  { key: 'gate', label: '关口', Icon: Fence },
  { key: 'capital', label: '王都', Icon: Crown },
  { key: 'relic', label: '秘藏', Icon: Gem },
  { key: 'town', label: '聚落', Icon: Warehouse },
  { key: 'flag', label: '据点', Icon: Flag },
];

const BY_KEY = new Map(PIN_GLYPH_KINDS.map((k) => [k.key, k.Icon]));

/**
 * 老数据存的是 emoji（当年的输入框就叫「图标（emoji）」），
 * 这里把常见写法映射到图标名。查表前会先去掉变体选择符（U+FE0F），
 * 所以「⛩️」与「⛩」都会命中同一条。
 */
const EMOJI_ALIASES: Record<string, string> = {
  '🏰': 'city', '🏯': 'city', '🏙': 'city',
  '⚓': 'harbor', '🚢': 'harbor', '⛵': 'harbor', '🛳': 'harbor',
  '🗼': 'tower', '🏗': 'tower', '📡': 'tower',
  '🏛': 'ruins', '🗿': 'ruins', '💀': 'ruins', '🏚': 'ruins',
  '⛏': 'mine', '🪨': 'mine',
  '⛺': 'camp', '🏕': 'camp',
  '⛩': 'shrine', '🕍': 'shrine', '⛪': 'shrine', '🛕': 'shrine',
  '⛰': 'peak', '🏔': 'peak', '🌋': 'peak', '🗻': 'peak',
  '⚔': 'battle', '🛡': 'battle', '🔥': 'battle',
  '🌲': 'forest', '🌳': 'forest',
  '🌊': 'sea', '💧': 'sea',
  '🚧': 'gate', '🧱': 'gate',
  '👑': 'capital', '⭐': 'capital', '🌟': 'capital',
  '💎': 'relic', '🗝': 'relic',
  '🏘': 'town', '📍': 'town',
  '🚩': 'flag', '🏴': 'flag', '🧭': 'flag',
};

/** 图标名 → 图标组件（认不出一律用通用图钉） */
function resolveIcon(icon: string | undefined): LucideIcon {
  const raw = (icon ?? '').replace(/[\uFE0E\uFE0F]/g, '').trim();
  if (!raw) return MapPinIcon;
  const byKind = BY_KEY.get(raw.toLowerCase());
  if (byKind) return byKind;
  const alias = EMOJI_ALIASES[raw];
  return (alias && BY_KEY.get(alias)) || MapPinIcon;
}

/** 渲染标记图标（细线：strokeWidth 比默认细一档） */
export function PinGlyph({ icon, className }: { icon: string; className?: string }) {
  const Icon = resolveIcon(icon);
  return <Icon className={className} strokeWidth={1.75} />;
}
