/**
 * 卡片属性区（卡片详情页的第三个页签）
 * ------------------------------------------------------------------
 * 需求：标签、结构化字段、关联关系要能在 Markdown 文本里直接编辑，
 * 并且在导出为其它格式时一起带出去。
 *
 * 这里是「单向投影」的编辑面：
 *   显示 —— 读 cards.fields / 标签 / 关联，渲染成一段 YAML 前置块；
 *   改完 —— 解析回来合并进卡片（见 lib/props-apply.ts）。
 *
 * 为什么不做双向实时同步：卡片表单与这段文本都能编辑，
 * 双向同步最后一定会打架（谁赢、什么时候覆盖，用户看不懂）。
 * 所以文本是"草稿"：改完点「应用到卡片」，或者点「重置」丢弃改动。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, RotateCcw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/primitives';
import { useStore } from '@/store';
import { renderPropsBlock, parseProps } from '@/lib/markdown';
import { joinRelations } from '@/lib/markdown/props-format';
import { applyProps } from '@/lib/props-apply';
import { tagsOf } from '@/types';

export function CardPropsPanel({ cardId }: { cardId: string }) {
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));
  const cards = useStore((s) => s.cards);
  const tags = useStore((s) => s.tags);
  const cardTags = useStore((s) => s.cardTags);
  const relations = useStore((s) => s.relations);
  const updateCard = useStore((s) => s.updateCard);
  const ensureTag = useStore((s) => s.ensureTag);
  const setCardTagsOf = useStore((s) => s.setCardTagsOf);
  const addRelation = useStore((s) => s.addRelation);
  const updateRelation = useStore((s) => s.updateRelation);
  const toast = useStore((s) => s.toast);

  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [report, setReport] = useState<string>('');
  const seeded = useRef(false);

  /** 由卡片数据生成文本（卡片没变时结果稳定，useMemo 有意义） */
  const generated = useMemo(() => {
    if (!card) return '';
    const titleOf = (id: string) => cards.find((c) => c.id === id)?.title ?? '（已删除的卡片）';
    const mine = relations.filter((r) => r.from_id === card.id || r.to_id === card.id);
    const tagNames = tagsOf(card.id, cardTags, tags).map((t) => t.name);
    return renderPropsBlock({ card, tags: tagNames, relations: joinRelations(mine, card.id, titleOf) });
  }, [card, cards, tags, cardTags, relations]);

  // 换卡片时无条件重来；同一张卡片在别处被改过、且本地没有未保存草稿时才刷新
  useEffect(() => {
    if (!seeded.current || !dirty) setText(generated);
    if (!seeded.current) seeded.current = true;
  }, [generated, dirty, cardId]);

  if (!card) return null;

  const apply = () => {
    const parsed = parseProps(text);
    if (parsed.type && !parsed.type.match(/^[a-z_]+$/)) {
      toast(`类型名只支持小写字母与下划线：${parsed.type}`, 'warn');
      return;
    }
    const result = applyProps(card, parsed, {
      cards,
      relations,
      ensureTag,
      setCardTagsOf,
      addRelation,
      updateRelation,
      updateCard,
      existingTagIds: cardTags.filter((ct) => ct.card_id === card.id).map((ct) => ct.tag_id),
    });
    setDirty(false);
    const bits = [`字段 ${result.fields} 个`];
    if (result.tagsAdded) bits.push(`新增标签 ${result.tagsAdded}`);
    if (result.relationsAdded) bits.push(`新增关联 ${result.relationsAdded}`);
    if (result.relationsUpdated) bits.push(`更新关联 ${result.relationsUpdated}`);
    if (result.codeChanged) bits.push(`编号 → ${result.codeChanged}（旧编号留为别名）`);
    const warn = result.unresolved.length ? `；${result.unresolved.length} 条关联找不到对端卡片：${result.unresolved.join('、')}` : '';
    const problem = result.codeProblem ? `；${result.codeProblem}` : '';
    setReport(`已应用：${bits.join('，')}${warn}${problem}`);
    toast(result.codeProblem ? '属性区已应用（编号未改）' : '属性区已应用到卡片', result.unresolved.length || result.codeProblem ? 'warn' : 'success');
  };

  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => toast('属性区已复制到剪贴板', 'success'),
      () => toast('复制失败，请手动选中复制', 'warn'),
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <SectionTitle>属性区</SectionTitle>
        <span className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" className="gap-1" onClick={copy}>
            <Copy className="size-3" /> 复制
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            disabled={!dirty}
            onClick={() => {
              setText(generated);
              setDirty(false);
              setReport('');
            }}
          >
            <RotateCcw className="size-3" /> 重置
          </Button>
          <Button size="sm" className="gap-1" disabled={!dirty} onClick={apply}>
            <Wand2 className="size-3" /> 应用到卡片
          </Button>
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        spellCheck={false}
        className="min-h-[320px] flex-1 resize-none bg-transparent px-3 py-2 font-mono text-[12px] leading-5 outline-none"
      />

      <div className="border-t border-border px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
        {report ? (
          <span className="flex items-center gap-1 text-primary">
            <Check className="size-3" /> {report}
          </span>
        ) : (
          <>
            块首 `code` / `type` / `subtitle` / `summary` / `tags`，缩进的 `fields:` 是结构化字段，
            `relations:` 每行一条关联（→ 出边、← 入边、↔ 无向，行尾 `[[卡片id]]` 保证改标题也不指错）。
            改完点「应用到卡片」写回；这里只做单向投影，卡片表单仍是唯一数据源。
          </>
        )}
      </div>
    </div>
  );
}
