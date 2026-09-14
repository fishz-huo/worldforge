/**
 * 测试世界观：手册与备份一致性校验
 * ------------------------------------------------------------------
 * 手册（docs/潮线之外·世界观设定.txt）是「唯一事实来源」，备份 JSON 由它生成。
 * 这一层要守的就是两者不许漂移：手册里声明的每一种数量，
 * 都必须等于备份里数出来的实际数量；手册里能解析出的实体，
 * 也必须与备份一一对上。
 *
 * 单独成文件的原因：校验逻辑本身有 100 多行，混在 sample-check.mjs 里
 * 会把那个文件顶过 200 行上限。
 *
 * 排版约定（解析依赖它，改手册时要遵守）：
 *   - 数量一律写成「名称 数字」，名称在前。写成「28 张卡片」解析不出来：
 *     中文没有词边界，`[\u4e00-\u9fa5]+` 会把量词一起吞进名称里（「张卡片」）。
 *   - 【快速核对清单】里每组之间留两个以上空格。
 */

/**
 * 归一化「名称 数量」里的名称，让同一指标的不同写法归到同一个键：
 *   时间轴泳道 / 泳道   → 泳道
 *   多边形区域 / 区域   → 区域
 *   标记点 / 标记       → 标记
 *   卡片 / 标签 / 关联  → 原样（「卡片」本身就是完整名称，不能被当成前缀剥掉）
 * 只剥限定词，绝不剥量词 —— 「标记」的末字与量词擦边，一剥就废。
 */
const KEY_ALIAS = {
  时间轴泳道: '泳道', 泳道: '泳道',
  时间轴条目: '条目', 条目: '条目',
  多边形区域: '区域', 区域: '区域',
  标记点: '标记', 标记: '标记',
  平行世界分支: '分支', 分支: '分支',
  大纲节点: '大纲节点', 卡片: '卡片',
};

/** 名称归一化（导出供自测与调试用） */
export function bareKey(label) {
  const name = String(label).trim();
  if (KEY_ALIAS[name]) return KEY_ALIAS[name];
  return name.replace(/^(时间轴|多边形|平行世界)/, '') || name;
}

/** 读【标题】之后几行里的「名称 数量」清单（例如【快速核对清单】） */
function countsIn(text, label) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.startsWith(label));
  const out = {};
  if (at < 0) return out;
  lines.slice(at, at + 5).join(' ').split(/\s{2,}/).forEach((chunk) => {
    const m = /^(\S+?)\s+(\d+)$/.exec(chunk.trim());
    if (m) out[bareKey(m[1])] = Number(m[2]);
  });
  return out;
}

/** 行内「名称 数字」取数；只在该小节里找，避免命中别处的同名文字 */
function numberAfter(sectionText, label) {
  const hit = new RegExp(`${label}\\s+(\\d+)`).exec(sectionText ?? '');
  return hit ? Number(hit[1]) : null;
}

/** 手册开头声明的总量（那段说明横跨三行，拼起来解析） */
function headCounts(text) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.includes('拆成了'));
  const line = at >= 0 ? lines.slice(at + 1, at + 4).join(' ') : '';
  const out = {};
  [...line.matchAll(/([\u4e00-\u9fa5]+?)\s+(\d+)/g)].forEach((m) => {
    const key = bareKey(m[1]);
    if (!(key in out)) out[key] = Number(m[2]);
  });
  return out;
}

/**
 * 逐项对照手册与备份。
 * @param text   手册全文
 * @param texts  splitTopSections(手册) 的结果
 * @param snap   备份里的 snapshot
 * @param check  报告函数 (name, ok, detail)
 * @param typeMap 卡片类型字典（来自 src/types/card-types.ts）
 * @param parsers 解析器集合：{ parseTags, parseRelations, parseTimeline }
 */
export function checkManual(text, texts, snap, check, typeMap, parsers) {
  const { parseTags, parseRelations, parseTimeline } = parsers;
  const head = headCounts(text);
  /** 取手册声明的数量：必须过 bareKey，因为 head 里存的是归一化后的键 */
  const stated = (label) => head[bareKey(label)];

  /* 各卡型的小节张数：[三·N 类型（type）· N 张] 写在分组标题里，不在顶层小节内 */
  const cardSectionCount = (label) => {
    const hit = new RegExp(`\\[三·\\d+\\s*${label}[^\\]]*?·\\s*(\\d+)\\s*张\\]`).exec(text);
    return hit ? Number(hit[1]) : null;
  };
  const actualByType = snap.cards.reduce((acc, c) => {
    const label = typeMap[c.type].label;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  Object.entries(actualByType).forEach(([label, n]) => {
    check(`手册声明的小节数量正确（${label}）`, cardSectionCount(label) === n,
      `手册写 ${cardSectionCount(label)}，实际 ${n}`);
  });

  /* 手册开头声明的总量 */
  check('手册声明的卡片总数正确', stated('卡片') === snap.cards.length, `手册 ${stated('卡片')}，实际 ${snap.cards.length}`);
  check('手册声明的标签数正确', stated('标签') === snap.tags.length, `手册 ${stated('标签')}，实际 ${snap.tags.length}`);
  check('手册声明的关联数正确', stated('关联') === snap.relations.length, `手册 ${stated('关联')}，实际 ${snap.relations.length}`);
  check('手册声明的地图/标记点/区域数正确',
    stated('地图') === snap.maps.length && stated('标记点') === snap.pins.length && stated('多边形区域') === snap.regions.length,
    `手册 ${stated('地图')}/${stated('标记点')}/${stated('多边形区域')}，实际 ${snap.maps.length}/${snap.pins.length}/${snap.regions.length}`);
  check('手册声明的泳道/条目/纪元数正确',
    stated('时间轴泳道') === snap.tracks.length
    && stated('时间轴条目') === snap.entries.length
    && stated('纪元') === snap.eras.length,
    `手册 ${stated('时间轴泳道')}/${stated('时间轴条目')}/${stated('纪元')}，实际 ${snap.tracks.length}/${snap.entries.length}/${snap.eras.length}`);
  check('手册声明的文稿/大纲节点数正确',
    stated('文稿') === snap.docs.length && stated('大纲节点') === snap.outlineNodes.length,
    `手册 ${stated('文稿')}/${stated('大纲节点')}，实际 ${snap.docs.length}/${snap.outlineNodes.length}`);
  check('手册声明的分支数正确', stated('平行世界分支') === snap.branches.length,
    `手册 ${stated('平行世界分支')}，实际 ${snap.branches.length}`);

  /* 【快速核对清单】—— 手工对照用的那份表 */
  const quick = countsIn(text, '【快速核对清单】');
  check('手册快速核对清单与备份一致',
    quick['卡片'] === snap.cards.length
    && quick['标记'] === snap.pins.length
    && quick['大纲节点'] === snap.outlineNodes.length,
    JSON.stringify(quick));

  /* 能被解析器读出来的实体，也要与备份对上 */
  const { tags: tagDefs, map: tagMap } = parseTags(texts['四、标签']);
  check('手册的标签定义与备份一致', tagDefs.length === snap.tags.length
    && tagDefs.every((t, i) => t.name === snap.tags[i].name && t.color === snap.tags[i].color));
  const mounted = tagMap.reduce((n, row) => n + row.tags.length, 0);
  check('手册的挂标签清单与备份一致', mounted === snap.cardTags.length,
    `手册 ${mounted} 条，备份 ${snap.cardTags.length} 条`);
  check('手册的关联表与备份一致', parseRelations(texts['五、关联']).length === snap.relations.length);
  const tl = parseTimeline(texts['七、时间轴']);
  check('手册的泳道/纪元/条目表与备份一致',
    tl.tracks.length === snap.tracks.length
    && tl.eras.length === snap.eras.length
    && tl.entries.length === snap.entries.length);
  const outlineTotal = numberAfter(texts['九、大纲树'], '合计');
  check('手册声明的大纲节点总数正确', outlineTotal === snap.outlineNodes.length,
    `手册 ${outlineTotal}，实际 ${snap.outlineNodes.length}`);
}
