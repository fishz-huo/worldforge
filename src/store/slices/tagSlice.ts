/**
 * Tag Slice —— 标签的创建与维护
 * ------------------------------------------------------------------
 * 需求 11：tag 内容自由填写。
 * 操作习惯约定：在卡片标签选择器里直接输入不存在的名字 → 回车即建，
 * 因此 ensureTag 必须「同名复用」而不是重复创建。
 */
import type { Tag } from '@/types';
import { TAG_COLORS } from '@/types';
import { newTagId } from '@/lib/id';
import { tagsRepo } from '@/lib/db';
import { removeById, removeWhere, upsert } from '../helpers';
import type { Slice } from '../types';

export interface TagSlice {
  /** 按名称取标签，不存在则创建 */
  ensureTag: (name: string) => Tag;
  /** 显式创建标签（可指定颜色） */
  createTag: (name: string, color?: string) => Tag;
  /** 内部：真正创建标签（ensureTag 与 createTag 共用） */
  createTagInternal: (name: string, color?: string) => Tag;
  updateTag: (id: string, patch: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
}

export const createTagSlice: Slice<TagSlice> = (set, get) => ({
  ensureTag: (name) => {
    const trimmed = name.trim();
    const existing = get().tags.find((t) => t.name === trimmed);
    if (existing) return existing;
    return get().createTagInternal(trimmed);
  },

  createTag: (name: string, color?: string) => get().createTagInternal(name, color),

  createTagInternal: (name: string, color?: string) => {
    const worldId = get().currentWorldId!;
    const tag: Tag = {
      id: newTagId(),
      world_id: worldId,
      name: name.trim(),
      color: color ?? TAG_COLORS[get().tags.length % TAG_COLORS.length],
      created_at: Date.now(),
    };
    tagsRepo.save(tag);
    set({ tags: [...get().tags, tag].sort((a, b) => a.name.localeCompare(b.name)) });
    return tag;
  },

  updateTag: (id, patch) => {
    const tag = get().tags.find((t) => t.id === id);
    if (!tag) return;
    const next = { ...tag, ...patch };
    tagsRepo.save(next);
    set({ tags: upsert(get().tags, next) });
  },

  deleteTag: (id) => {
    tagsRepo.remove(id);
    set({
      tags: removeById(get().tags, id),
      cardTags: removeWhere(get().cardTags, (ct) => ct.tag_id === id),
      selectedTagIds: get().selectedTagIds.filter((t) => t !== id),
    });
  },
});
