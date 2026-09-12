/**
 * Data Slice —— 应用启动与数据装载
 * ------------------------------------------------------------------
 * 装载策略：把「当前世界观」的全部实体一次性读进内存（世界观规模通常只有几千条），
 * 于是卡片的筛选 / 搜索 / 关联反查 / 时间轴计算全部变成内存计算，交互零延迟。
 * 分支（平行世界）不做物理隔离，靠 branch_id 在内存里做视图过滤，切换分支无需重查数据库。
 *
 * 世界观与分支的增删改见 worldSlice.ts。
 */
import { buildSeed } from '@/lib/seed';
import type { Card } from '@/types';
import {
  assetsRepo, branchesRepo, cardAssetsRepo, cardsRepo, docsRepo, entriesRepo, erasRepo,
  flush, getSetting, initDatabase, installLifecycleFlush, listAllCardTags, mapsRepo,
  outlineRepo, pinsRepo, pluginsRepo, regionsRepo, relationsRepo,
  tagsRepo, tracksRepo, versionsRepo, worldsRepo,
} from '@/lib/db';
import { writeBundle } from '../bundle';
import type { DataState, Slice } from '../types';

export interface DataSlice extends DataState {
  /** 应用启动：初始化数据库 → 必要时播种 → 装载数据 */
  bootstrap: () => Promise<void>;
  /** 重新从数据库装载当前世界观的全部数据 */
  reload: () => void;
}

/**
 * 自愈：清掉指向「已不存在的图片」的封面引用。
 * 早期版本删除图库图片时不会清 cover_asset，导入残缺备份也可能留下这种悬空引用，
 * 表现为卡片封面一直是个空白占位框。装载时顺手修掉并落库，用户无需手动处理。
 */
function healCoverRefs(cards: Card[], assetIds: Set<string>): Card[] {
  const broken = cards.filter((c) => c.cover_asset && !assetIds.has(c.cover_asset));
  if (broken.length === 0) return cards;
  const fixed = broken.map((c) => ({ ...c, cover_asset: null }));
  cardsRepo.saveMany(fixed);
  const patch = new Map(fixed.map((c) => [c.id, c]));
  return cards.map((c) => patch.get(c.id) ?? c);
}

export const createDataSlice: Slice<DataSlice> = (set, get) => ({
  /* 初始数据状态 */
  ready: false,
  error: '',
  worlds: [],
  branches: [],
  currentWorldId: null,
  currentBranchId: null,
  cards: [],
  cardAssets: [],
  tags: [],
  cardTags: [],
  relations: [],
  maps: [],
  pins: [],
  regions: [],
  tracks: [],
  entries: [],
  eras: [],
  docs: [],
  outlineNodes: [],
  versions: [],
  assets: [],
  plugins: [],

  bootstrap: async () => {
    try {
      await initDatabase();
      installLifecycleFlush();

      let worlds = worldsRepo.list(undefined, undefined, 'created_at ASC');
      if (worlds.length === 0) {
        // 首次启动：写入示例世界观，避免用户面对空白界面
        writeBundle(buildSeed());
        await flush();
        worlds = worldsRepo.list(undefined, undefined, 'created_at ASC');
      }

      const storedWorld = getSetting<string | null>('currentWorldId', null);
      const currentWorldId = worlds.some((w) => w.id === storedWorld) ? storedWorld! : worlds[0].id;
      const branches = branchesRepo.list('world_id = ?', [currentWorldId], 'created_at ASC');
      const storedBranch = getSetting<string | null>('currentBranchId', null);
      const currentBranchId = branches.some((b) => b.id === storedBranch) ? storedBranch : null;

      set({ ready: true, error: '', worlds, branches, currentWorldId, currentBranchId });
      get().reload();
    } catch (err) {
      console.error('[worldforge] 启动失败', err);
      set({ ready: true, error: err instanceof Error ? err.message : String(err) });
    }
  },

  reload: () => {
    const worldId = get().currentWorldId;
    if (!worldId) return;
    const assets = assetsRepo.list('world_id = ?', [worldId], 'created_at DESC');
    const cards = healCoverRefs(
      cardsRepo.list('world_id = ?', [worldId], 'pinned DESC, updated_at DESC'),
      new Set(assets.map((a) => a.id)),
    );
    set({
      cards,
      cardAssets: cardAssetsRepo.list(
        'card_id IN (SELECT id FROM cards WHERE world_id = ?)', [worldId], 'order_index ASC',
      ),
      tags: tagsRepo.list('world_id = ?', [worldId], 'name ASC'),
      cardTags: listAllCardTags(worldId),
      relations: relationsRepo.list('world_id = ?', [worldId]),
      maps: mapsRepo.list('world_id = ?', [worldId], 'created_at ASC'),
      pins: pinsRepo.list('map_id IN (SELECT id FROM maps WHERE world_id = ?)', [worldId]),
      regions: regionsRepo.list('map_id IN (SELECT id FROM maps WHERE world_id = ?)', [worldId]),
      tracks: tracksRepo.list('world_id = ?', [worldId], 'order_index ASC'),
      entries: entriesRepo.list('world_id = ?', [worldId], 'start_t ASC'),
      eras: erasRepo.list('world_id = ?', [worldId], 'start_t ASC'),
      docs: docsRepo.list('world_id = ?', [worldId], 'order_index ASC, created_at ASC'),
      outlineNodes: outlineRepo.list(
        'doc_id IN (SELECT id FROM docs WHERE world_id = ?)', [worldId], 'order_index ASC',
      ),
      versions: versionsRepo.list('world_id = ?', [worldId], 'created_at DESC'),
      assets,
      plugins: pluginsRepo.list(undefined, undefined, 'created_at ASC'),
      branches: branchesRepo.list('world_id = ?', [worldId], 'created_at ASC'),
    });
    // 世界观的配置（如时间单位）可能在设置页被改过，这里同步一次
    const worlds = worldsRepo.list(undefined, undefined, 'created_at ASC');
    if (JSON.stringify(worlds) !== JSON.stringify(get().worlds)) set({ worlds });
  },
});
