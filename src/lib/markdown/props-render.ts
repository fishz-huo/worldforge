/**
 * 卡片属性区 · 渲染（卡片 → 可读可改的文本块）
 * ==================================================================
 * 需求：标签、结构化字段、关联关系要能在 Markdown 文本里直接编辑，
 * 并且在导出成别的格式时一起带出去。
 *
 * 设计要点
 *   1. **单一数据源**：结构化字段只存在 cards.fields（JSON 列），
 *      属性区是它的一个「投影」，不是第二份数据。表单改了 → 重新渲染属性区；
 *      属性区改了 → 解析后写回 fields。两边永远不会各存一份互相打架。
 *   2. **格式选 YAML 前置块**（`---` 围栏）：这是 Obsidian / Jekyll / Hugo
 *      的通用约定，用户拿出去别的工具也认，拿回来我们也好解析。
 *      而 `- **键**：值` 那种人是好读了，但值里带冒号或 `**` 就会解析错。
 *   3. 渲染与解析拆成两个文件（props-render / props-parse），
 *      因为两块逻辑各自都有几十行，加上注释就会顶到 200 行上限。
 */
import type { Card, FieldDef } from '@/types';
import { getFieldsFor } from '@/lib/plugin/registry';
import { formatFieldValue, joinRelations } from './props-format';

/** 属性区的围栏标记。用 `---` 与 YAML 一致；解析时靠它精确切出这一段。 */
export const FENCE = '---';

/** 字段在属性区里的呈现顺序（其余字段按类型定义里的顺序跟在后面） */
const LEAD_KEYS = ['type', 'subtitle', 'summary', 'typeLabel'] as const;

/** 一张卡片 + 它的标签/关联 → 属性区文本 */
export interface PropsInput {
  card: Card;
  /** 标签名（已按标签库里的名字解析好） */
  tags: string[];
  /** 已格式化的关联行，见 props-format.ts 的 relationLine */
  relations: string[];
  /**
   * 字段顺序（可选）。不传就按卡片类型定义 + 插件追加字段。
   * 留这个口子是为了让渲染保持「纯函数」：自测里不必先启动插件注册表。
   */
  fieldDefs?: FieldDef[];
}

/** 渲染整段属性区（不含围栏本身） */
export function renderProps(input: PropsInput): string {
  const { card, tags, relations } = input;
  const lines: string[] = [];
  // 字段顺序来源：优先用调用方给的（自测里直接给，避开插件注册表），
  // 否则按卡片类型定义 + 插件追加字段
  const source: FieldDef[] = input.fieldDefs ?? getFieldsFor(card.type);
  const fieldDefs = new Map<string, FieldDef>(source.map((f) => [f.key, f]));

  // 类型：写在最前面，回读时靠它决定字段怎么解释
  lines.push(`type: ${formatFieldValue(card.type)}`);
  // 自定义类型卡片的显示名（「其他类型」用），没有就不写，保持导出干净
  const typeLabel = card.fields?.typeLabel;
  if (typeof typeLabel === 'string' && typeLabel.trim()) {
    lines.push(`typeLabel: ${formatFieldValue(typeLabel.trim())}`);
  }
  lines.push(`subtitle: ${formatFieldValue(card.subtitle)}`);
  lines.push(`summary: ${formatFieldValue(card.summary)}`);
  lines.push(`tags: ${formatFieldValue(tags)}`);

  // 结构化字段：只写真正填了的，空字段不占地方（导出给人看时也干净）
  const filled = Object.entries(card.fields ?? {}).filter(([key, value]) => {
    if (LEAD_KEYS.includes(key as (typeof LEAD_KEYS)[number])) return false;
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
  // 顺序 = 卡片详情页里的字段顺序（用户看到的与导出的对得上），
  // 类型定义里没有的键（例如用户手写的）排到最后
  filled.sort((a, b) => rankOf(a[0], fieldDefs) - rankOf(b[0], fieldDefs));

  if (filled.length) {
    lines.push('fields:');
    const pad = Math.max(...filled.map(([k]) => k.length));
    filled.forEach(([key, value]) => {
      void fieldDefs.get(key);
      lines.push(`  ${key.padEnd(pad)}: ${formatFieldValue(value, key)}`);
    });
  }

  if (relations.length) {
    lines.push('relations:');
    relations.forEach((line) => lines.push(`  - ${line}`));
  }
  return lines.join('\n');
}

/** 字段排序：类型定义里有位置的按位置，没定义的排后面 */
function rankOf(key: string, defs: Map<string, FieldDef>): number {
  let i = 0;
  for (const def of defs.values()) {
    if (def.key === key) return i;
    i += 1;
  }
  return 10_000;
}

/** 带围栏的完整文本块（导出与编辑器都显示这一段） */
export function renderPropsBlock(input: PropsInput): string {
  return `${FENCE}\n${renderProps(input)}\n${FENCE}`;
}

/** 关联行（给卡片详情页与导出共用） */
export { joinRelations };
