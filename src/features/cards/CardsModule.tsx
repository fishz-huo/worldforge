/**
 * 卡片 Wiki 模块
 * ------------------------------------------------------------------
 * 三栏：筛选侧栏 | 卡片网格或详情 | 检查器。
 * 需求 1：卡片式的角色 / 地点 / 事件 / 底层逻辑 / 大纲 / 参考管理 + 自由关联。
 */
import { ModuleBody, ModuleLayout } from '@/components/layout/Panel';
import { useStore } from '@/store';
import { CardDetailView } from './CardDetailView';
import { CardsGrid } from './CardsGrid';
import { CardsInspector } from './CardsInspector';
import { CardsSidebar } from './CardsSidebar';

export function CardsModule() {
  const selectedCardId = useStore((s) => s.selectedCardId);
  const cardExists = useStore((s) => (s.selectedCardId ? s.cards.some((c) => c.id === s.selectedCardId) : false));

  return (
    <ModuleLayout>
      <CardsSidebar />
      <ModuleBody>{selectedCardId && cardExists ? <CardDetailView cardId={selectedCardId} /> : <CardsGrid />}</ModuleBody>
      <CardsInspector />
    </ModuleLayout>
  );
}
