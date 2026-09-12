/**
 * 示例世界观 · 设定层数据
 * ------------------------------------------------------------------
 * 卡片、标签、关联。用 byKey 暴露常用卡片，供场景数据（地图/时间轴/大纲）引用，
 * 避免在多个文件之间传递一长串局部变量。
 */
import type { Card, Relation, Tag } from '@/types';
import { newCardId, newRelationId, newTagId } from '@/lib/id';

/** 建卡小工具，减少样板代码 */
function makeCardFactory(worldId: string, now: number) {
  return (
    type: string,
    title: string,
    subtitle: string,
    summary: string,
    body: string,
    fields: Card['fields'],
    branchId: string | null = null,
  ): Card => ({
    id: newCardId(),
    world_id: worldId,
    branch_id: branchId,
    type,
    title,
    subtitle,
    summary,
    body,
    fields,
    cover_asset: null,
    pinned: 0,
    created_at: now,
    updated_at: now,
  });
}

/** 设定层数据包 */
export interface SeedCards {
  cards: Card[];
  tags: Tag[];
  cardTags: { card_id: string; tag_id: string }[];
  relations: Relation[];
  /** 具名索引，供场景数据引用 */
  byKey: Record<string, Card>;
}

/** 构建示例卡组 */
export function buildSeedCards(worldId: string, now: number): SeedCards {
  const card = makeCardFactory(worldId, now);

  const lore = card('lore', '灵息', '世界底层能量',
    '一种由地脉涌出的能量，可被特定血脉感知并转化为力量，但过度汲取会「灰化」使用者的躯体。',
    '## 定义\n灵息是大陆一切超凡现象的根源。\n\n## 三条铁律\n1. **守恒**：灵息总量恒定，一方多得必有一方枯竭。\n2. **代价**：每次汲取都会让躯体灰化一分。\n3. **血脉**：只有「燃血者」能直接感知灵息。\n\n> 灰化不可逆，这是整个纪元悲剧的起点。',
    {
      category: 'substance', scope: '全局', source: '焚天陨落时渗入地脉',
      rule: '灵息守恒、汲取必付灰化代价、仅燃血者可感知',
      cost: '躯体灰化，最终成为「灰像」',
      impact: '决定政治格局：谁掌握灵脉，谁就掌握王国',
      evolution: '灵息浓度每百年下降约 3%，文明正在倒计时',
    });

  const loreTech = card('lore', '灵械技术', '由灵息驱动的机械体系',
    '把灵息封入「息匣」驱动机械，使非燃血者也能使用超凡力量，正在动摇旧贵族秩序。',
    '## 阶段\n- 第一代：息匣粗笨，仅用于矿场起重\n- 第二代：小型化，可装配于弩机与车驾\n- 第三代（进行中）：军用化，威胁到燃血者垄断',
    { category: 'tech', scope: '全局', rule: '息匣容量决定输出上限', impact: '平民武装化，燃血贵族恐慌' });

  const protagonist = card('character', '烬·阿舒尔', '灰烬骑士团 末席',
    '能听见灵息低语的前矿工，被迫成为「人形息匣」的少年。',
    '## 生平\n出生于灰港矿镇，十四岁那年矿难夺走全家，唯有他被灵息「选中」。\n\n## 矛盾\n他越强，就越接近灰化——而他的敌人正需要一枚可弃的息匣。',
    {
      birth_t: 221, death_t: null, gender: '男', race: '人类（燃血者）', affiliation: '灰烬骑士团',
      identity: '骑士团末席 / 人形息匣', appearance: '左臂自肘部以下呈灰白色，瞳孔有细密裂纹',
      personality: '沉默、固执，对「被使用」极度敏感',
      goal: '找到不用灰化也能活下来的办法',
      ability: '灵息感知范围远超常人，可徒手稳定暴走的灵脉',
      weakness: '灰化已蔓延至心肺，剧烈战斗会加速',
    });

  const mentor = card('character', '薇拉·索恩', '灰烬骑士团 团长',
    '把阿舒尔从矿难里挖出来的人，也是最想把他当兵器用的人。',
    '她相信「少数人的灰化能换多数人的活」，并愿意亲手执行这笔账。',
    {
      birth_t: 178, death_t: null, gender: '女', race: '人类（非燃血者）', affiliation: '灰烬骑士团',
      identity: '团长', personality: '理性到冷酷，唯独在阿舒尔面前会犹豫',
      goal: '在灵息枯竭前统一大陆，建立配给制度',
      ability: '灵械战术大师，不依赖灵息作战',
      weakness: '没有任何超凡感知，情报永远慢半拍',
    });

  const capital = card('location', '焚天城', '灰烬王国 首都',
    '建在陨落星体之上的环形都城，城墙内即是最大的灵脉节点。',
    '## 结构\n三重环墙：外环矿工与灵械工坊，中环商贾与神殿，内环燃血贵族。\n\n## 隐患\n城基的灵脉已被抽取三百年，地陷每年扩大。',
    {
      category: 'city', terrain: '陨石坑盆地', climate: '常年灰霾', population: 120,
      agriculture: 20, mineral: 95, resource_note: '灵脉节点、息匣工坊',
      faction: '灰烬王国', landmark: '焚天塔',
    });

  const mineTown = card('location', '灰港矿镇', '王国西北 矿业聚落',
    '主角故乡。矿难后灵息外溢，全镇三分之一居民灰化。',
    '## 现状\n矿井封闭，居民以回收废息匣为生。',
    {
      category: 'city', terrain: '丘陵 + 深井', climate: '干冷', population: 3,
      agriculture: 5, mineral: 88, resource_note: '废弃灵息矿脉',
      faction: '灰烬王国', landmark: '一号竖井',
    });

  const warEvent = card('event', '烬关之战', '灵息战争 转折点',
    '双方为争夺灵脉在烬关决战，最终以点燃灵脉、半个关隘灰化收场。',
    '## 经过\n薇拉命令阿舒尔点燃烬关灵脉，以灰化三千人为代价阻断敌军。\n\n## 后果\n王国胜，但「人形息匣」的存在被公开，阿舒尔成为各国争夺目标。',
    {
      start_t: 245, end_t: 245.3, scale: 'national', cause: '灵脉枯竭导致的资源战争',
      process: '阿舒尔被推上灵脉节点，强制汲取',
      outcome: '敌军溃退，烬关以西全部灰化',
    });

  const reference = card('reference', '《能源与文明：化石燃料简史》', '参考书目',
    '梳理能源形态如何决定社会结构，可直接迁移到「灵息—政治」的映射。',
    '## 可借鉴点\n- 能源密度决定战争形态\n- 垄断能源的阶层必然走向封闭\n- 新能源出现时，旧秩序的反扑最激烈',
    {
      source_type: 'book', author: '阿尔弗雷德·克劳士比', url: '', year: '2006',
      quote: '每一次能源更替，都伴随一次政治秩序的重写。',
      takeaway: '灵械技术普及 = 旧贵族反扑的导火索',
    });

  const cards = [lore, loreTech, protagonist, mentor, capital, mineTown, warEvent, reference];

  /* ------------------------------ 标签 ------------------------------ */
  const tagDefs: [string, string][] = [
    ['主线', '#ef4444'], ['主角团', '#8b5cf6'], ['灵息体系', '#10b981'],
    ['已定稿', '#64748b'], ['待补充', '#f59e0b'],
  ];
  const tags: Tag[] = tagDefs.map(([name, color]) => ({
    id: newTagId(), world_id: worldId, name, color, created_at: now,
  }));
  const tag = (name: string) => tags.find((t) => t.name === name)!.id;

  const cardTags = [
    { card_id: protagonist.id, tag_id: tag('主角团') },
    { card_id: protagonist.id, tag_id: tag('主线') },
    { card_id: mentor.id, tag_id: tag('主角团') },
    { card_id: warEvent.id, tag_id: tag('主线') },
    { card_id: warEvent.id, tag_id: tag('已定稿') },
    { card_id: lore.id, tag_id: tag('灵息体系') },
    { card_id: loreTech.id, tag_id: tag('灵息体系') },
    { card_id: loreTech.id, tag_id: tag('待补充') },
    { card_id: capital.id, tag_id: tag('已定稿') },
  ];

  /* ------------------------------ 关联 ------------------------------ */
  const rel = (from: Card, to: Card, label: string, note = ''): Relation => ({
    id: newRelationId(), world_id: worldId, branch_id: null,
    from_id: from.id, to_id: to.id, label, note, directed: 1,
    start_t: null, end_t: null, created_at: now,
  });
  const relations: Relation[] = [
    rel(protagonist, mentor, '受制于', '名义上是师徒，实质是使用者与工具'),
    rel(protagonist, capital, '出生于', ''),
    rel(protagonist, mineTown, '出生于', '十四岁前生活于此'),
    rel(protagonist, lore, '被灵息选中', '唯一能徒手稳定灵脉的人'),
    rel(protagonist, warEvent, '参与', '被强制点燃灵脉'),
    rel(warEvent, lore, '导致', '加速了灵息枯竭'),
    rel(loreTech, lore, '依赖', '息匣必须以灵息为燃料'),
    rel(loreTech, reference, '参考自', '能源与文明史的类比'),
    rel(capital, lore, '建于', '城基建在最大灵脉节点上'),
  ];

  return {
    cards, tags, cardTags, relations,
    byKey: { lore, loreTech, protagonist, mentor, capital, mineTown, warEvent, reference },
  };
}
