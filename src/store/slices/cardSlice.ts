/**
 * Card Slice —— 卡片、关联、卡片图库
 * ------------------------------------------------------------------
 * 覆盖需求 1（卡片式管理 + 自由关联）与需求 5（图片）。
 * 标签相关操作见 tagSlice.ts。
 * 所有写操作都是「先落库、再更新内存」，保证界面与持久层永远一致。
 */
import type { Card, CardAsset, Relation } from '@/types';
import { newCardId, newId, newRelationId } from '@/lib/id';
import { importImage } from '@/lib/assets';
import { cardAssetsRepo, cardsRepo, relationsRepo, setCardTags } from '@/lib/db';
import { purgeCard } from '@/lib/db/purge';
import { emitPluginEvent } from '@/lib/plugin/events';
import { removeById, removeWhere, upsert } from '../helpers';
import type { Slice } from '../types';

export interface CardSlice {
  /** 新建卡片；type 可为插件注册的自定义类型 */
  createCard: (type: string, init?: Partial<Card>) => Card;
  updateCard: (id: string, patch: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  duplicateCard: (id: string) => string | null;
  togglePin: (id: string) => void;
  /** 覆盖式设置卡片标签 */
  setCardTagsOf: (cardId: string, tagIds: string[]) => void;
  /** 关联：from --label--> to */
  addRelation: (input: { from_id: string; to_id: string; label: string; note?: string }) => void;
  updateRelation: (id: string, patch: Partial<Relation>) => void;
  deleteRelation: (id: string) => void;
  /** 批量导入图片到卡片图库 */
  addImagesToCard: (cardId: string, files: File[]) => Promise<void>;
  removeCardAsset: (cardAssetId: string) => void;
  setCoverAsset: (cardId: string, assetId: string | null) => void;
}

export const createCardSlice: Slice<CardSlice> = (set, get) => ({
  createCard: (type, init = {}) => {
    const worldId = get().currentWorldId;
    if (!worldId) throw new Error('尚未选择世界观');
    const now = Date.now();
    const card: Card = {
      id: newCardId(),
      world_id: worldId,
      branch_id: init.branch_id ?? get().currentBranchId,
      type,
      title: init.title ?? '未命名',
      subtitle: init.subtitle ?? '',
      summary: init.summary ?? '',
      body: init.body ?? '',
      fields: init.fields ?? {},
      cover_asset: init.cover_asset ?? null,
      pinned: init.pinned ?? 0,
      created_at: now,
      updated_at: now,
    };
    cardsRepo.save(card);
    set({ cards: [card, ...get().cards] });
    emitPluginEvent('card:save', card);
    return card;
  },

  updateCard: (id, patch) => {
    const existing = get().cards.find((c) => c.id === id);
    if (!existing) return;
    const next: Card = { ...existing, ...patch, updated_at: Date.now() };
    cardsRepo.save(next);
    set({ cards: upsert(get().cards, next) });
    emitPluginEvent('card:save', next);
  },

  deleteCard: (id) => {
    purgeCard(id);
    set({
      cards: removeById(get().cards, id),
      cardAssets: removeWhere(get().cardAssets, (ca) => ca.card_id === id),
      cardTags: removeWhere(get().cardTags, (ct) => ct.card_id === id),
      relations: removeWhere(get().relations, (r) => r.from_id === id || r.to_id === id),
      entries: removeWhere(get().entries, (e) => e.card_id === id),
      pins: get().pins.map((p) => (p.card_id === id ? { ...p, card_id: null } : p)),
      outlineNodes: get().outlineNodes.map((n) => (n.card_id === id ? { ...n, card_id: null } : n)),
    });
    if (get().selectedCardId === id) set({ selectedCardId: null });
    emitPluginEvent('card:delete', { id });
  },

  duplicateCard: (id) => {
    const source = get().cards.find((c) => c.id === id);
    if (!source) return null;
    const copy = get().createCard(source.type, { ...source, title: `${source.title} 副本` });
    // 一并复制标签，副本才有完整的上下文
    const tagIds = get().cardTags.filter((ct) => ct.card_id === id).map((ct) => ct.tag_id);
    if (tagIds.length) get().setCardTagsOf(copy.id, tagIds);
    return copy.id;
  },

  togglePin: (id) => {
    const card = get().cards.find((c) => c.id === id);
    if (card) get().updateCard(id, { pinned: card.pinned ? 0 : 1 });
  },

  setCardTagsOf: (cardId, tagIds) => {
    setCardTags(cardId, tagIds);
    set({
      cardTags: [
        ...get().cardTags.filter((ct) => ct.card_id !== cardId),
        ...tagIds.map((tag_id) => ({ card_id: cardId, tag_id })),
      ],
    });
  },

  addRelation: ({ from_id, to_id, label, note = '' }) => {
    const worldId = get().currentWorldId;
    if (!worldId || from_id === to_id) return;
    const relation: Relation = {
      id: newRelationId(),
      world_id: worldId,
      branch_id: get().currentBranchId,
      from_id,
      to_id,
      label: label.trim(),
      note,
      directed: 1,
      start_t: null,
      end_t: null,
      created_at: Date.now(),
    };
    relationsRepo.save(relation);
    set({ relations: [...get().relations, relation] });
  },

  updateRelation: (id, patch) => {
    const relation = get().relations.find((r) => r.id === id);
    if (!relation) return;
    const next = { ...relation, ...patch };
    relationsRepo.save(next);
    set({ relations: upsert(get().relations, next) });
  },

  deleteRelation: (id) => {
    relationsRepo.remove(id);
    set({ relations: removeById(get().relations, id) });
  },

  addImagesToCard: async (cardId, files) => {
    const worldId = get().currentWorldId;
    if (!worldId) return;
    const created: CardAsset[] = [];
    for (const file of files) {
      const asset = await importImage(file, worldId);
      const link: CardAsset = {
        id: newId('l'),
        card_id: cardId,
        asset_id: asset.id,
        caption: '',
        order_index: created.length,
      };
      cardAssetsRepo.save(link);
      created.push(link);
    }
    // 图片元数据也要进入内存态，重新装载一次最稳妥
    get().reload();
    get().toast(`已添加 ${created.length} 张图片`, 'success');
  },

  removeCardAsset: (cardAssetId) => {
    cardAssetsRepo.remove(cardAssetId);
    set({ cardAssets: removeById(get().cardAssets, cardAssetId) });
  },

  setCoverAsset: (cardId, assetId) => {
    get().updateCard(cardId, { cover_asset: assetId });
  },
});
