/**
 * 数据包写入
 * ------------------------------------------------------------------
 * 「首次播种」与「导入备份」都要把一整套实体按顺序写进数据库。
 * 顺序不能乱：主表在前、关联表在后（虽然没有外键，但保持语义清晰）。
 */
import type { SeedBundle } from '@/lib/seed';
import {
  branchesRepo, cardsRepo, docsRepo, entriesRepo, erasRepo, mapsRepo,
  outlineRepo, pinsRepo, regionsRepo, relationsRepo, setCardTags,
  tagsRepo, tracksRepo, worldsRepo,
} from '@/lib/db';

/** 把整套数据写入数据库（首次播种 / 导入备份复用） */
export function writeBundle(bundle: SeedBundle): void {
  worldsRepo.save(bundle.world);
  branchesRepo.save(bundle.branch);
  cardsRepo.saveMany(bundle.cards);
  tagsRepo.saveMany(bundle.tags);
  // 卡片↔标签是复合主键，走专门的覆盖式写入
  bundle.cardTags.forEach((ct) => setCardTags(ct.card_id, [ct.tag_id]));
  relationsRepo.saveMany(bundle.relations);
  mapsRepo.saveMany(bundle.maps);
  pinsRepo.saveMany(bundle.pins);
  regionsRepo.saveMany(bundle.regions);
  tracksRepo.saveMany(bundle.tracks);
  entriesRepo.saveMany(bundle.entries);
  erasRepo.saveMany(bundle.eras);
  docsRepo.saveMany(bundle.docs);
  outlineRepo.saveMany(bundle.outlineNodes);
}
