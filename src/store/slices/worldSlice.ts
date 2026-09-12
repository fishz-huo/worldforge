/**
 * World Slice —— 世界观体系与平行世界分支的管理
 * ------------------------------------------------------------------
 * 需求 8：在一套世界观体系下可以调出相对应的平行世界设定。
 * 关键约定：
 *  - 主世界（branch_id = null）的卡片在所有分支下都可见，是「基准设定」；
 *  - 分支可以新增自己的卡片（覆盖 / 补充），也可以从当前分支「派生」出副本；
 *  - 切换分支只改视图过滤，不重查数据库，因此瞬时完成。
 */
import type { Branch, World } from '@/types';
import { BRANCH_COLORS } from '@/types';
import { newBranchId, newCardId, newWorldId } from '@/lib/id';
import { removeAsset } from '@/lib/assets';
import { buildSeed } from '@/lib/seed';
import { branchesRepo, cardsRepo, setSetting, worldsRepo } from '@/lib/db';
import { purgeBranch, purgeWorld } from '@/lib/db/purge';
import { writeBundle } from '../bundle';
import type { Slice } from '../types';

export interface WorldSlice {
  /** 切换当前世界观 */
  switchWorld: (id: string) => void;
  /** 切换平行世界分支（null = 主世界） */
  switchBranch: (id: string | null) => void;
  createWorld: (name: string, description?: string) => string;
  updateWorld: (id: string, patch: Partial<World>) => void;
  deleteWorld: (id: string) => void;
  createBranch: (name: string, description?: string) => string;
  updateBranch: (id: string, patch: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  /** 从当前分支复制出一个新的平行世界分支 */
  forkBranch: (name: string, note?: string) => string;
  /** 重新写入示例数据（会先清空当前世界观） */
  reseedDemo: () => void;
}

export const createWorldSlice: Slice<WorldSlice> = (set, get) => ({
  switchWorld: (id) => {
    setSetting('currentWorldId', id);
    setSetting('currentBranchId', null);
    const branches = branchesRepo.list('world_id = ?', [id], 'created_at ASC');
    set({
      currentWorldId: id,
      currentBranchId: null,
      branches,
      selectedCardId: null,
      selectedMapId: null,
      selectedDocId: null,
      selectedOutlineId: null,
    });
    get().reload();
  },

  switchBranch: (id) => {
    setSetting('currentBranchId', id);
    set({ currentBranchId: id, selectedCardId: null });
  },

  createWorld: (name, description = '') => {
    const now = Date.now();
    const world: World = { id: newWorldId(), name, description, meta: {}, created_at: now, updated_at: now };
    worldsRepo.save(world);
    set({ worlds: worldsRepo.list(undefined, undefined, 'created_at ASC') });
    get().switchWorld(world.id);
    get().toast(`已创建世界观「${name}」`, 'success');
    return world.id;
  },

  updateWorld: (id, patch) => {
    const world = worldsRepo.get(id);
    if (!world) return;
    worldsRepo.save({ ...world, ...patch, updated_at: Date.now() });
    set({ worlds: worldsRepo.list(undefined, undefined, 'created_at ASC') });
  },

  deleteWorld: (id) => {
    const { assetIds } = purgeWorld(id);
    // 图片二进制在 IndexedDB 里，需要单独回收（元数据、Blob 与对象 URL 都要释放）
    assetIds.forEach((assetId) => void removeAsset(assetId));

    const worlds = worldsRepo.list(undefined, undefined, 'created_at ASC');
    set({ worlds });
    if (worlds.length === 0) {
      // 不允许出现「一个世界观都没有」的状态，自动补一个示例世界
      const bundle = buildSeed();
      writeBundle(bundle);
      set({ worlds: worldsRepo.list(undefined, undefined, 'created_at ASC') });
      get().switchWorld(bundle.world.id);
    } else if (get().currentWorldId === id) {
      get().switchWorld(worlds[0].id);
    }
    get().toast('世界观已删除', 'warn');
  },

  createBranch: (name, description = '') => {
    const worldId = get().currentWorldId;
    if (!worldId) return '';
    const now = Date.now();
    const branch: Branch = {
      id: newBranchId(),
      world_id: worldId,
      name,
      description,
      color: BRANCH_COLORS[get().branches.length % BRANCH_COLORS.length],
      divergence: '',
      divergence_t: null,
      forked_from: null,
      created_at: now,
      updated_at: now,
    };
    branchesRepo.save(branch);
    set({ branches: branchesRepo.list('world_id = ?', [worldId], 'created_at ASC') });
    get().toast(`已创建平行世界「${name}」`, 'success');
    return branch.id;
  },

  updateBranch: (id, patch) => {
    const branch = branchesRepo.get(id);
    if (!branch) return;
    branchesRepo.save({ ...branch, ...patch, updated_at: Date.now() });
    set({ branches: branchesRepo.list('world_id = ?', [get().currentWorldId!], 'created_at ASC') });
  },

  deleteBranch: (id) => {
    purgeBranch(id);
    if (get().currentBranchId === id) set({ currentBranchId: null });
    set({ branches: branchesRepo.list('world_id = ?', [get().currentWorldId!], 'created_at ASC') });
    get().reload();
    get().toast('平行世界分支已删除', 'warn');
  },

  forkBranch: (name, note = '') => {
    const source = get().currentBranchId;
    const worldId = get().currentWorldId;
    if (!worldId) return '';
    const now = Date.now();
    const branch: Branch = {
      id: newBranchId(),
      world_id: worldId,
      name,
      description: note,
      color: BRANCH_COLORS[get().branches.length % BRANCH_COLORS.length],
      divergence: note,
      divergence_t: null,
      forked_from: source,
      created_at: now,
      updated_at: now,
    };
    branchesRepo.save(branch);

    // 复制源分支可见的卡片，形成「可独立修改的快照」
    const sourceCards = get().cards.filter(
      (c) => c.branch_id === source || (source === null && c.branch_id === null),
    );
    const clones = sourceCards.map((c) => ({ ...c, id: newCardId(), branch_id: branch.id }));
    cardsRepo.saveMany(clones);

    set({ branches: branchesRepo.list('world_id = ?', [worldId], 'created_at ASC') });
    get().reload();
    get().toast(`已从当前分支派生「${name}」（复制 ${clones.length} 张卡片）`, 'success');
    return branch.id;
  },

  reseedDemo: () => {
    const worldId = get().currentWorldId;
    if (worldId) purgeWorld(worldId);
    const bundle = buildSeed();
    writeBundle(bundle);
    set({ worlds: worldsRepo.list(undefined, undefined, 'created_at ASC') });
    get().switchWorld(bundle.world.id);
    get().toast('示例数据已重建', 'success');
  },
});
