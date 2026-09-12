/**
 * 卡片检查器（右侧）
 * ------------------------------------------------------------------
 * 需求 1：信息互相关联。这里回答四个问题：
 *  1. 这张卡出现在哪些文稿里？
 *  2. 这张卡在时间轴上有哪些出场？
 *  3. 这张卡标在地图的哪些位置？
 *  4. 还有哪些卡片指向它？
 */
import { CalendarClock, FileText, Link2, MapPin, MousePointerClick, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionTitle } from '@/components/ui/primitives';
import { Icon } from '@/components/Icon';
import { InspectorPanel } from '@/components/layout/Panel';
import { getCardType } from '@/lib/plugin/registry';
import { useStore } from '@/store';

export function CardsInspector() {
  const card = useStore((s) => s.cards.find((c) => c.id === s.selectedCardId));
  const cards = useStore((s) => s.cards);
  const docs = useStore((s) => s.docs);
  const entries = useStore((s) => s.entries);
  const tracks = useStore((s) => s.tracks);
  const pins = useStore((s) => s.pins);
  const maps = useStore((s) => s.maps);
  const relations = useStore((s) => s.relations);
  const setModule = useStore((s) => s.setModule);
  const selectDoc = useStore((s) => s.selectDoc);
  const selectEntry = useStore((s) => s.selectEntry);
  const selectMap = useStore((s) => s.selectMap);
  const selectCard = useStore((s) => s.selectCard);

  if (!card) {
    return (
      <InspectorPanel title="检查器">
        <EmptyState
          icon={<MousePointerClick />}
          title="未选中卡片"
          description="从左侧列表点选一张卡片，这里会显示它的引用关系、时间轴出场与地图位置。"
        />
      </InspectorPanel>
    );
  }

  const def = getCardType(card.type);
  /** 正文里通过双链或标题提到过这张卡的文稿 */
  const mentioning = docs.filter((d) => d.content.includes(`[[${card.title}]]`) || d.content.includes(card.title));
  const cardEntries = entries.filter((e) => e.card_id === card.id);
  const cardPins = pins.filter((p) => p.card_id === card.id);
  const incoming = relations.filter((r) => r.to_id === card.id);

  return (
    <InspectorPanel
      title={
        <span className="flex items-center gap-1.5">
          <Icon name={def.icon} className="size-3.5" style={{ color: def.color }} />
          {card.title}
        </span>
      }
    >
      <div className="space-y-3 p-2">
        <div className="rounded-md border border-border bg-card/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
          {card.summary || '（还没有摘要）'}
        </div>

        <section>
          <SectionTitle>
            <span className="flex items-center gap-1">
              <FileText className="size-3" /> 被文稿引用（{mentioning.length}）
            </span>
          </SectionTitle>
          {mentioning.length === 0 ? (
            <div className="px-2 text-[11px] text-muted-foreground">还没有文稿提到它</div>
          ) : (
            mentioning.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setModule(d.kind === 'outline' ? 'outline' : 'writer');
                  selectDoc(d.id);
                }}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-accent"
              >
                <FileText className="size-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
              </button>
            ))
          )}
        </section>

        <section>
          <SectionTitle>
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3" /> 时间轴出场（{cardEntries.length}）
            </span>
          </SectionTitle>
          {cardEntries.length === 0 ? (
            <div className="px-2 text-[11px] text-muted-foreground">还没有时间轴条目</div>
          ) : (
            cardEntries.map((e) => {
              const track = tracks.find((t) => t.id === e.track_id);
              return (
                <button
                  key={e.id}
                  onClick={() => {
                    setModule('timeline');
                    selectEntry(e.id);
                  }}
                  className="flex w-full items-start gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: track?.color ?? '#888' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{e.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {track?.name} · {e.start_t}
                      {e.end_t !== null ? ` → ${e.end_t}` : ''}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </section>

        <section>
          <SectionTitle>
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> 地图位置（{cardPins.length}）
            </span>
          </SectionTitle>
          {cardPins.length === 0 ? (
            <div className="px-2 text-[11px] text-muted-foreground">还没有在地图上标记</div>
          ) : (
            cardPins.map((p) => {
              const map = maps.find((m) => m.id === p.map_id);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setModule('map');
                    selectMap(p.map_id);
                  }}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  <span>{p.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{map?.name ?? '地图'}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(p.x * 100)}, {Math.round(p.y * 100)}
                  </span>
                </button>
              );
            })
          )}
        </section>

        <section>
          <SectionTitle>
            <span className="flex items-center gap-1">
              <Link2 className="size-3" /> 被关联（{incoming.length}）
            </span>
          </SectionTitle>
          {incoming.length === 0 ? (
            <div className="px-2 text-[11px] text-muted-foreground">还没有其它卡片指向它</div>
          ) : (
            incoming.map((r) => {
              const source = cards.find((c) => c.id === r.from_id);
              return (
                <button
                  key={r.id}
                  onClick={() => selectCard(r.from_id)}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="border-0 bg-muted text-[10px]">
                    {r.label || '相关'}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">{source?.title ?? '（已删除）'}</span>
                </button>
              );
            })
          )}
        </section>

        <footer className="flex items-center gap-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
          <Star className="size-3" />
          创建 {new Date(card.created_at).toLocaleDateString('zh-CN')}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 text-[10px]"
            onClick={() => useStore.getState().togglePin(card.id)}
          >
            {card.pinned ? '取消置顶' : '置顶'}
          </Button>
        </footer>
      </div>
    </InspectorPanel>
  );
}
