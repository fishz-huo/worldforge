/**
 * 总览模块
 * ------------------------------------------------------------------
 * 打开软件先看到什么？一张「世界观体检表」：
 * 数据规模、最近编辑、待补充项、底层逻辑速览、下一步建议。
 * 各信息区块的实现见 BoardPanels.tsx。
 */
import { Boxes, FileText, Map as MapIcon, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionTitle } from '@/components/ui/primitives';
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { countWords } from '@/lib/markdown';
import { useStore } from '@/store';
import { NewCardButton } from '@/features/cards/CardsSidebar';
import { LoreOverview, RecentCards, TodoOverview, TypeBreakdown } from './BoardPanels';

/** 统计卡片 */
function StatCard({
  icon: Ico,
  label,
  value,
  hint,
}: {
  icon: typeof Boxes;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Ico className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** 建议的下一步（新手引导） */
function NextSteps() {
  return (
    <section className="rounded-lg border border-border p-3">
      <SectionTitle>建议的下一步</SectionTitle>
      <ol className="list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-muted-foreground">
        <li>在「卡片 Wiki」里新建「底层逻辑」卡，把世界最根本的规则写清楚。</li>
        <li>用「角色」「地点」「事件」卡填充世界，并随手用关联把角色挂到地点与事件上。</li>
        <li>在「地图」里为关键时期各建一张地图，用区域记录人口 / 农业 / 矿产的分布。</li>
        <li>在「时间轴」里把事件卡与角色卡拉成泳道，拖动游标查看任意时刻的角色年龄与状态。</li>
        <li>在「大纲」里用文本或树形搭结构，再到「写作」里写正文，输入 [[ 即可引用设定。</li>
        <li>大改之前先在「版本」里存一个快照，改完就能一眼看出差异。</li>
      </ol>
    </section>
  );
}

export function BoardModule() {
  const cards = useStore((s) => s.cards);
  const maps = useStore((s) => s.maps);
  const entries = useStore((s) => s.entries);
  const docs = useStore((s) => s.docs);
  const world = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId));
  const branches = useStore((s) => s.branches);
  const totalWords = docs.reduce((sum, d) => sum + countWords(d.content), 0);

  return (
    <ModuleLayout>
      <ModuleBody className="overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
          <header className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold">{world?.name ?? '世界观'}</h1>
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {world?.description || '还没有写简介。可以在「设置 → 世界观」里补充。'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline">{branches.length + 1} 条世界线</Badge>
              <NewCardButton />
            </div>
          </header>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard icon={Boxes} label="卡片" value={cards.length} hint="角色 / 地点 / 事件 / 设定" />
            <StatCard icon={MapIcon} label="地图" value={maps.length} hint="不同时期与分支" />
            <StatCard icon={Timer} label="时间轴条目" value={entries.length} hint="事件 / 生命线 / 变化" />
            <StatCard icon={FileText} label="文稿" value={docs.length} hint={`约 ${totalWords} 字`} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <TypeBreakdown />
            <RecentCards />
            <LoreOverview />
            <TodoOverview />
          </div>

          <NextSteps />
        </div>
      </ModuleBody>
    </ModuleLayout>
  );
}
