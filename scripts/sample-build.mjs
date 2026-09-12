/**
 * 测试世界观：把解析结果翻译成数据库行
 * ------------------------------------------------------------------
 * 输出结构与 lib/snapshot.ts 的 SnapshotPayload 完全一致，
 * 因此生成的 JSON 能直接喂给「设置 → 数据 → 导入设定」。
 * 所有 id 都是可读的固定值（而不是随机短 id）：方便在 JSON 里对照，
 * 也让两次生成的产物完全一致（不会每次都产生一堆 diff）。
 * 引用写错（比如关联指向一张不存在的卡片）在这里直接抛错。
 */

/** 固定时间戳：让生成结果可复现，不随运行时间变化 */
export const NOW = 1_700_000_000_000;
export const WORLD_ID = 'world-maomao';
/** 三条分支的固定 id；第三条是从第二条派生出来的 */
export const BRANCH_IDS = ['branch-stay', 'branch-no-tieclaw', 'branch-duntail-first'];

/** 把标题转成可读的 id 片段，中文原样保留 */
export function slug(title) {
  return title
    .replace(/^《|》$/g, '')
    .replace(/[·（()）\s/|:：、，,。"'「」]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'x';
}

/** 统计用：按某个字段分组计数 */
export function countBy(list, key) {
  return list.reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : item[key];
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * 组装快照。
 * @param data 解析结果：{ worldInfo, cards, tagDefs, tagMap, relationRows, maps, timeline, docs, outlineRows }
 */
export function buildSnapshot(data) {
  const { worldInfo, cards, tagDefs, tagMap, relationRows, maps, timeline, docs, outlineRows } = data;
  const id = WORLD_ID;

  /* 卡片 id 与「标题 → id」索引（双链、关联、标记点、大纲都靠标题引用卡片） */
  const byTitle = new Map();
  cards.forEach((c, i) => {
    c.id = `card-${c.type}-${slug(c.title)}-${i}`;
    if (!byTitle.has(c.title)) byTitle.set(c.title, c);
  });
  const titleToId = (title) => byTitle.get(title)?.id ?? null;

  const world = {
    id, name: worldInfo.name, description: worldInfo.description,
    meta: { time: worldInfo.time }, created_at: NOW, updated_at: NOW,
  };

  const branches = worldInfo.branches.map((b, i) => ({
    id: BRANCH_IDS[i] ?? `branch-${i}`,
    world_id: id,
    name: b.name,
    description: b.divergence,
    color: b.color,
    divergence: b.divergence,
    divergence_t: b.divergence_t,
    forked_from: i === 2 ? BRANCH_IDS[1] : null,
    created_at: NOW + i,
    updated_at: NOW + i,
  }));

  const outCards = cards.map((c) => ({
    id: c.id, world_id: id, branch_id: null, type: c.type, title: c.title,
    subtitle: c.subtitle, summary: c.summary, body: c.body, fields: c.fields,
    cover_asset: null, pinned: 0, created_at: NOW, updated_at: NOW,
  }));

  const tags = tagDefs.map((t, i) => ({
    id: `tag-${slug(t.name)}`, world_id: id, name: t.name, color: t.color, created_at: NOW + i,
  }));
  const tagByName = new Map(tags.map((t) => [t.name, t.id]));
  const cardTags = [];
  tagMap.forEach(({ card, tags: names }) => {
    const cardId = titleToId(card);
    if (!cardId) throw new Error(`挂标签清单里的卡片不存在：「${card}」`);
    names.forEach((name) => {
      const tagId = tagByName.get(name);
      if (!tagId) throw new Error(`挂标签清单里的标签不存在：「${name}」`);
      cardTags.push({ card_id: cardId, tag_id: tagId });
    });
  });

  const relations = relationRows.map((r, i) => {
    const from = titleToId(r.from);
    const to = titleToId(r.to);
    if (!from || !to) throw new Error(`关联第 ${r.no} 条引用了不存在的卡片：${r.from} / ${r.to}`);
    return {
      id: `rel-${r.no}`, world_id: id, branch_id: null, from_id: from, to_id: to,
      label: r.label, note: r.note, directed: 1, start_t: null, end_t: null, created_at: NOW + i,
    };
  });

  const pins = [];
  const regions = [];
  const outMaps = maps.map((m, mi) => {
    const mapId = `map-${mi + 1}`;
    m.pins.forEach((p) => {
      pins.push({
        id: `pin-${mi + 1}-${p.no}`, map_id: mapId, card_id: titleToId(p.label),
        x: p.x, y: p.y, label: p.label, icon: p.icon, color: p.color, note: p.note,
      });
    });
    m.regions.forEach((r, ri) => {
      regions.push({
        id: `region-${mi + 1}-${ri + 1}`, map_id: mapId, name: r.name, color: r.color,
        points: r.points, resources: r.resources ?? {}, period: r.period || m.period, note: r.note,
      });
    });
    return {
      id: mapId, world_id: id, branch_id: null, name: m.name, description: m.description,
      asset_id: null, period: m.period, period_t: m.period_t, opacity: m.opacity, meta: {},
      created_at: NOW + mi, updated_at: NOW + mi,
    };
  });

  const tracks = timeline.tracks.map((t, i) => ({
    id: `track-${i + 1}`, world_id: id, branch_id: null, name: t.name, kind: t.kind,
    color: t.color, order_index: i, hidden: 0, valued: t.valued ? 1 : 0,
  }));
  const trackByName = new Map(tracks.map((t) => [t.name, t.id]));
  const entries = timeline.entries.map((e, i) => {
    const trackId = trackByName.get(e.track);
    if (!trackId) throw new Error(`条目第 ${e.no} 条的泳道不存在：「${e.track}」`);
    const cardId = e.card ? titleToId(e.card) : null;
    if (e.card && !cardId) throw new Error(`条目第 ${e.no} 条的卡片不存在：「${e.card}」`);
    return {
      id: `entry-${e.no}`, world_id: id, branch_id: null, track_id: trackId, card_id: cardId,
      title: e.title, start_t: e.start_t ?? 0, end_t: e.end_t,
      instant: e.end_t === null ? 1 : 0, note: '', state: e.state, value: e.value,
      map_id: null, created_at: NOW + i,
    };
  });
  const eras = timeline.eras.map((e, i) => ({
    id: `era-${i + 1}`, world_id: id, name: e.name,
    start_t: e.start_t, end_t: e.end_t, color: e.color, note: e.note,
  }));

  const outDocs = docs.map((d, i) => ({
    id: `doc-${i + 1}`, world_id: id, branch_id: null, kind: d.kind, title: d.title,
    content: d.content, summary: d.summary, order_index: i, card_id: null,
    created_at: NOW + i, updated_at: NOW + i,
  }));

  const outlineDoc = outDocs.find((d) => d.kind === 'outline');
  const STATUS = { 构思: 'idea', 写作中: 'draft', 已完成: 'done', 已废弃: 'cut' };
  const outlineNodes = outlineRows.map((row, i) => {
    const cardId = row.card ? titleToId(row.card) : null;
    if (row.card && !cardId) throw new Error(`大纲节点引用了不存在的卡片：「${row.card}」`);
    return {
      id: `node-${i + 1}`, doc_id: outlineDoc?.id ?? null,
      parent_id: row.parentIndex === undefined ? null : `node-${row.parentIndex + 1}`,
      order_index: i, title: row.title, summary: row.summary, status: STATUS[row.status],
      card_id: cardId, link_doc_id: null, meta: {},
    };
  });

  return {
    schemaVersion: 1,
    world,
    branches,
    cards: outCards,
    tags,
    cardTags,
    relations,
    maps: outMaps,
    pins,
    regions,
    tracks,
    entries,
    eras,
    docs: outDocs,
    outlineNodes,
  };
}
