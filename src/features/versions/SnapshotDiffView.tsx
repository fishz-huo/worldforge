/**
 * 版本差异视图
 * ------------------------------------------------------------------
 * 需求 12：设定版本切换对比。
 * 顶上是总览统计，下面是分实体的差异清单；
 * 卡片正文/摘要用行级 diff 展示具体改动。
 * 基础展示组件见 DiffBlocks.tsx。
 */
import { FileDiff } from 'lucide-react';
import { EmptyState, SectionTitle } from '@/components/ui/primitives';
import type { SnapshotDiff } from '@/lib/snapshot-diff';
import { CardChangeDetail, CardDiffRow, DiffSection, LineDiff } from './DiffBlocks';

export function SnapshotDiffView({ diff }: { diff: SnapshotDiff }) {
  if (diff.total === 0) {
    return (
      <EmptyState
        icon={<FileDiff />}
        title="与当前设定完全一致"
        description="保存这个快照之后没有任何改动。"
      />
    );
  }

  const otherCount =
    diff.tags.added.length +
    diff.tags.removed.length +
    diff.maps.added.length +
    diff.maps.removed.length +
    diff.maps.changed.length +
    diff.outline.added +
    diff.outline.removed +
    diff.outline.changed;

  return (
    <div className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/50 p-2 text-xs">
        <span className="font-medium">共 {diff.total} 处差异</span>
        <span className="text-emerald-400">新增卡片 {diff.cards.added.length}</span>
        <span className="text-destructive">删除卡片 {diff.cards.removed.length}</span>
        <span className="text-amber-400">修改卡片 {diff.cards.changed.length}</span>
        <span className="text-muted-foreground">关联 ±{diff.relations.added + diff.relations.removed}</span>
        <span className="text-muted-foreground">时间轴 ±{diff.entries.added + diff.entries.removed}</span>
      </div>

      <DiffSection title="新增卡片" count={diff.cards.added.length}>
        <div className="space-y-1">
          {diff.cards.added.map((card) => (
            <CardDiffRow key={card.id} card={card} kind="add" />
          ))}
        </div>
      </DiffSection>

      <DiffSection title="删除卡片" count={diff.cards.removed.length}>
        <div className="space-y-1">
          {diff.cards.removed.map((card) => (
            <CardDiffRow key={card.id} card={card} kind="del" />
          ))}
        </div>
      </DiffSection>

      <DiffSection title="修改卡片" count={diff.cards.changed.length}>
        <div className="space-y-1.5">
          {diff.cards.changed.map(({ before, after }) => (
            <CardDiffRow
              key={after.id}
              card={after}
              kind="change"
              detail={<CardChangeDetail before={before} after={after} />}
            />
          ))}
        </div>
      </DiffSection>

      <DiffSection
        title="文稿改动"
        count={diff.docs.changed.length + diff.docs.added.length + diff.docs.removed.length}
      >
        <div className="space-y-2">
          {diff.docs.added.map((title) => (
            <div key={title} className="text-xs text-emerald-400">
              + 新增文稿《{title}》
            </div>
          ))}
          {diff.docs.removed.map((title) => (
            <div key={title} className="text-xs text-destructive">
              - 删除文稿《{title}》
            </div>
          ))}
          {diff.docs.changed.map((doc) => (
            <div key={doc.title} className="rounded border border-border/60 p-1.5">
              <div className="text-xs font-medium">《{doc.title}》</div>
              <LineDiff
                before={doc.lines.filter((l) => l.type !== 'add').map((l) => l.text).join('\n')}
                after={doc.lines.filter((l) => l.type !== 'del').map((l) => l.text).join('\n')}
              />
            </div>
          ))}
        </div>
      </DiffSection>

      <DiffSection title="其它变化" count={otherCount}>
        <div className="space-y-1 text-xs">
          {diff.tags.added.length > 0 && <div className="text-emerald-400">新增标签：{diff.tags.added.join('、')}</div>}
          {diff.tags.removed.length > 0 && <div className="text-destructive">删除标签：{diff.tags.removed.join('、')}</div>}
          {diff.maps.added.length > 0 && <div className="text-emerald-400">新增地图：{diff.maps.added.join('、')}</div>}
          {diff.maps.removed.length > 0 && <div className="text-destructive">删除地图：{diff.maps.removed.join('、')}</div>}
          {diff.maps.changed.length > 0 && <div className="text-amber-400">地图改动：{diff.maps.changed.join('、')}</div>}
          {(diff.outline.added > 0 || diff.outline.removed > 0 || diff.outline.changed > 0) && (
            <div className="text-muted-foreground">
              大纲节点：新增 {diff.outline.added} · 删除 {diff.outline.removed} · 改动 {diff.outline.changed}
            </div>
          )}
        </div>
      </DiffSection>

      <SectionTitle>说明</SectionTitle>
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        对比基准是「保存该快照时的设定」与「当前设定」。图片二进制不进入快照，
        因此图片不会显示为差异，只要资源还在原处就会继续可用。
      </p>
    </div>
  );
}
