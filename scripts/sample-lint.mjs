/**
 * 测试世界观：结构校验
 * ------------------------------------------------------------------
 * 这里只做「数据本身是否合法」的静态检查，不碰数据库、不读手册声明：
 *   1. 卡片字段名与 src/types/card-types.ts 的 FieldDef 逐个对照；
 *   2. 下拉字段的取值必须在 options 里；
 *   3. 所有 id 引用（关联 / 标签 / 标记点 / 条目 / 大纲 / 分支）都能落到实处；
 *   4. 坐标、刻度、瞬时事件这些数值约束。
 * 手册与备份是否一致、能不能真的导入，由 sample-check.mjs 负责。
 * 注意：卡片类型字典要由调用方传进来（动态 import），因为 `@/` 别名依赖
 * db-harness.mjs 注册的解析钩子，静态 import 会在钩子装好之前就失败。
 */

/** 收集检查结果的小工具（与其它自测脚本保持同一种输出风格） */
export function createReporter() {
  const state = { pass: 0, fails: [], warnings: [] };
  const check = (name, ok, detail = '') => {
    if (ok) state.pass += 1;
    else state.fails.push(detail ? `${name} —— ${detail}` : name);
  };
  const warn = (name, detail) => state.warnings.push(detail ? `${name} —— ${detail}` : name);
  return { state, check, warn };
}

/** 校验一组实体引用的 id 是否都存在，返回坏引用列表（kind 用于可读报错） */
export function badRefs(list, getRefs, pool, kind) {
  const bad = [];
  list.forEach((item) => {
    getRefs(item).filter(Boolean).forEach((id) => {
      if (!pool.has(id)) bad.push(`${kind}: ${id}`);
    });
  });
  return bad;
}

/** 手册里解析出来的卡片 → 与真实字段定义对照（typeMap 来自 src/types/card-types.ts） */
export function lintCards(cards, typeMap, { check, warn }) {
  check('手册能解析出卡片', cards.length > 0, `解析到 ${cards.length} 张`);
  const problems = cards.filter((c) => c.problems.length);
  check('卡片字段名都能对上表结构', problems.length === 0,
    problems.map((c) => `${c.title}: ${c.problems.join('、')}`).join('；'));

  cards.forEach((card) => {
    const def = typeMap[card.type];
    if (!def) { check(`卡片类型合法（${card.title}）`, false, `未知类型 ${card.type}`); return; }
    const byKey = new Map(def.fields.map((f) => [f.key, f]));
    Object.entries(card.fields).forEach(([key, value]) => {
      const field = byKey.get(key);
      if (!field) { check(`字段属于该类型（${card.title}.${key}）`, false, `${def.label}没有这个字段`); return; }
      if (field.kind === 'select') {
        const allowed = (field.options ?? []).map((o) => o.value);
        check(`下拉取值合法（${card.title}.${key}）`, allowed.includes(String(value)), `${value} 不在 ${allowed.join('/')}`);
      }
      if (field.kind === 'number' || field.kind === 'time') {
        check(`数值字段是数字（${card.title}.${key}）`, typeof value === 'number' && Number.isFinite(value), `实际是 ${typeof value}`);
      }
    });
    // 标题长度：超过 40 字或短于 2 字的标题都不参与「关键词自动关联」
    // （见 lib/markdown/inline.ts 的 autoLinkTitles）
    if (card.title.length > 40) warn('标题超过 40 字，不会自动关联', `${card.title}（${card.title.length} 字）`);
    if (card.title.length < 2) check(`标题至少 2 字（${card.title}）`, false, '太短不会参与自动关联');
  });
}

/** 备份结构校验：id 引用与数值约束 */
export function lintSnapshot(snap, { check, warn }) {
  const cardIds = new Set(snap.cards.map((c) => c.id));
  const titles = new Set(snap.cards.map((c) => c.title));
  const tagIds = new Set(snap.tags.map((t) => t.id));
  const trackIds = new Set(snap.tracks.map((t) => t.id));
  const docIds = new Set(snap.docs.map((d) => d.id));
  const nodeIds = new Set(snap.outlineNodes.map((n) => n.id));
  const branchIds = new Set(snap.branches.map((b) => b.id));
  const where = (kind) => badRefs(snap.relations, (r) => [r.from_id, r.to_id], cardIds, kind);

  check('卡片 id 唯一', cardIds.size === snap.cards.length);
  check('关联指向的卡片都存在', where('relation').length === 0, where('relation').join('；'));
  check('标签挂载引用合法',
    snap.cardTags.every((ct) => cardIds.has(ct.card_id) && tagIds.has(ct.tag_id)));
  check('标记点绑定的卡片存在（或为空）',
    snap.pins.every((p) => p.card_id === null || cardIds.has(p.card_id)));
  check('标记点坐标在 0~1 之间',
    snap.pins.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
  check('区域顶点都是 0~1 的数值对',
    snap.regions.every((r) => r.points.length >= 3
      && r.points.every((p) => Array.isArray(p) && p.length === 2
        && p.every((v) => typeof v === 'number' && v >= 0 && v <= 1))));
  check('区域资源只有已知指标',
    snap.regions.every((r) => Object.keys(r.resources ?? {})
      .every((k) => ['population', 'agriculture', 'mineral', 'military', 'trade', 'custom'].includes(k))));
  check('时间轴条目引用合法',
    badRefs(snap.entries, (e) => [e.track_id], trackIds, 'entry.track').length === 0
    && badRefs(snap.entries, (e) => [e.card_id], cardIds, 'entry.card').length === 0);
  check('瞬时条目的 end_t 为空', snap.entries.every((e) => (e.instant === 1 ? e.end_t === null : e.end_t !== null)));
  check('数值折线只出现在 valued 泳道',
    snap.entries.filter((e) => e.value !== null)
      .every((e) => snap.tracks.find((t) => t.id === e.track_id)?.valued === 1));
  check('纪元起止刻度递增', snap.eras.every((e) => e.end_t > e.start_t));
  check('文稿 id 都存在', badRefs(snap.outlineNodes, (n) => [n.doc_id], docIds, 'node.doc').length === 0);
  check('大纲父子关系自洽',
    snap.outlineNodes.every((n) => n.parent_id === null || nodeIds.has(n.parent_id))
    && snap.outlineNodes.every((n) => n.parent_id !== n.id));
  check('大纲节点卡片引用存在（或为空）',
    snap.outlineNodes.every((n) => n.card_id === null || cardIds.has(n.card_id)));
  check('分支派生关系自洽',
    snap.branches.every((b) => b.forked_from === null || branchIds.has(b.forked_from)));
  check('所有实体都属于这个世界观',
    [...snap.cards, ...snap.tags, ...snap.relations, ...snap.maps, ...snap.tracks,
      ...snap.entries, ...snap.eras, ...snap.docs].every((x) => x.world_id === snap.world.id));

  // 双链：指向不存在的卡片不算错（应用里会显示成"尚未创建"），但值得提醒
  const linkRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const missing = [];
  const scan = (text, at) => {
    [...String(text).matchAll(linkRe)].forEach((m) => {
      const target = m[1].trim();
      if (!titles.has(target)) missing.push(`${at} → ${target}`);
    });
  };
  snap.cards.forEach((c) => scan(c.body, `卡片「${c.title}」`));
  snap.docs.forEach((d) => scan(d.content, `文稿「${d.title}」`));
  if (missing.length) warn('有指向未创建卡片的双链（会显示为"尚未创建"样式）', missing.join('；'));

  return { cardIds, titles };
}
