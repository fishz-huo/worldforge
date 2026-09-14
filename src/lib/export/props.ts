/**
 * 文档导出 · 属性区的组装（卡片 → Markdown 前置块）
 * ==================================================================
 * 需求：把标签、结构化字段、关联关系一起导出，而且要能在 Markdown 里改回来。
 *
 * 与界面里的「属性区」是**同一个渲染器**（lib/markdown 的 renderPropsBlock）——
 * 这一点很关键：如果导出另写一套格式，用户从导出文件里抄回来的段落
 * 就对不上卡片了，而那种错很难发现（字段看着都在，只是没生效）。
 *
 * 另加两项只有导出才需要的信息：
 *   - `title`：界面上标题在输入框里，导出后必须写进文本，否则这份文件
 *     单独拿出去就不知道是哪张卡片；
 *   - 顶部注释：告诉读者这段是机器可读的元信息、在哪改、改完怎么用。
 */
import type { Card, ExportSource, Relation } from '@/types';
import { renderProps, joinRelations } from '@/lib/markdown';
import { tagsOf } from '@/types';
import { cardTypeOf } from '@/lib/plugin/registry';

/** 导出文件里属性区的顶部注释（用 YAML 注释符，任何解析器都会忽略） */
const HEAD_NOTE = [
  '# 以下为 WorldForge 属性区：类型 / 字段 / 标签 / 关联',
  '# 可在应用的「卡片 → 属性区」里原样粘贴回来',
];

/** 一张卡片的关联（双向）→ 格式化行 */
function relationLines(cardId: string, source: ExportSource, titleOf: (id: string) => string): string[] {
  const mine: Relation[] = source.relations.filter((r) => r.from_id === cardId || r.to_id === cardId);
  return joinRelations(mine, cardId, titleOf);
}

/**
 * 一张卡片 → 带围栏的属性区 Markdown 块。
 * @returns 形如 `---\n# 注释\ntitle: ...\n---` 的字符串
 */
export function cardPropsBlock(card: Card, source: ExportSource): string {
  const titleOf = (id: string) => source.cards.find((c) => c.id === id)?.title ?? '（已删除的卡片）';
  const tagNames = tagsOf(card.id, source.cardTags, source.tags).map((t) => t.name);
  const body = renderProps({
    card,
    tags: tagNames,
    relations: relationLines(card.id, source, titleOf),
  });
  // 用「其他类型」时把作者起的类型名也写出去，别的工具读到的才是那个名字
  const typeName = cardTypeOf(card).label;
  const lines = [
    '---',
    ...HEAD_NOTE,
    `title: ${JSON.stringify(card.title)}`,
    `typeName: ${JSON.stringify(typeName)}`,
    body,
    '---',
  ];
  return lines.join('\n');
}

/**
 * 属性区里出现的键是不是我们认得的。
 * 给自测用：导出的格式一旦被误删注释或改错键名，这里能立刻发现。
 */
export const PROPS_KEYS = ['title', 'typeName', 'type', 'subtitle', 'summary', 'tags', 'fields', 'relations'] as const;
