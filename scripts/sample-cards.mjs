/**
 * 测试世界观文本解析 · 设定层（卡片 / 标签 / 关联 / 世界与分支）
 * ------------------------------------------------------------------
 * 字段中文名 → fields JSON 键名的映射必须与 src/types/card-types.ts 一致：
 * 抄错一个字段名，导入后那个字段就是空的，所以映射集中放在这里，
 * 由 sample-check.mjs 拿真实的 FieldDef 逐个核对。
 */
import { pick, listOf } from './sample-text.mjs';

/**
 * 字段中文名 → fields JSON 的键名。
 * 「类别 / 规模 / 来源」这三个中文词在不同卡片类型里指向不同键，
 * 因此手册给它们起了互不相同的名字（类别 → 领域、规模 → 体量、来源 → 来历），
 * 做到"一个中文标签只对应一个键"，抄进应用时不会填错框。
 */
export const FIELD_KEYS = {
  '出生刻度': 'birth_t', '死亡刻度': 'death_t', '性别': 'gender', '种族': 'race',
  '所属势力': 'affiliation', '身份/职业': 'identity', '身份 / 职业': 'identity',
  '外貌': 'appearance', '性格': 'personality', '目标/动机': 'goal', '目标 / 动机': 'goal',
  '能力/特长': 'ability', '能力 / 特长': 'ability', '弱点/缺陷': 'weakness', '弱点 / 缺陷': 'weakness',
  '类型': 'category', '地形': 'terrain', '气候': 'climate', '人口': 'population',
  '农业': 'agriculture', '矿产': 'mineral', '其它资源': 'resource_note',
  '控制势力': 'faction', '地标': 'landmark',
  '开始刻度': 'start_t', '结束刻度': 'end_t', '影响范围': 'scale',
  '起因': 'cause', '经过': 'process', '结果/影响': 'outcome', '结果 / 影响': 'outcome',
  '类别': 'category', '作用范围': 'scope', '来源': 'source', '核心规则': 'rule',
  '代价/限制': 'cost', '代价 / 限制': 'cost', '对世界的影响': 'impact', '演变趋势': 'evolution',
  '领袖': 'leader', '体量': 'scale', '理念/目标': 'ideology', '理念 / 目标': 'ideology',
  '势力范围': 'territory', '成立刻度': 'founded_t', '解散刻度': 'dissolved_t',
  '稀有度': 'rarity', '来历': 'origin', '效果': 'effect', '持有者': 'owner',
  '领域': 'domain', '别名': 'alias', '详细解释': 'detail',
  '资料类型': 'source_type', '作者': 'author', '链接': 'url', '年份': 'year',
  '关键摘录': 'quote', '可借鉴点': 'takeaway',
};

/** 数值型字段（其它按字符串存，避免出现 "46" 这种字符串数字） */
const NUMERIC_KEYS = new Set([
  'birth_t', 'death_t', 'start_t', 'end_t', 'population', 'agriculture',
  'mineral', 'founded_t', 'dissolved_t',
]);

/** 中文下拉项 → 英文值的索引（手册里直接写中文，手抄时不用记英文值） */
export const SELECT_LABELS = {
  '建筑 / 设施': 'site', '遗迹 / 秘境': 'ruin', '自然奇观': 'nature',
  '大陆 / 大区': 'continent', '国家 / 政权': 'country', '城市 / 聚落': 'city', '其它': 'other',
  '魔法 / 超凡体系': 'magic', '修炼 / 等级体系': 'cultivation', '神系 / 信仰': 'divine',
  '关键物质 / 能量': 'substance', '世界规则 / 物理法则': 'rule', '社会制度 / 经济': 'society',
  '科技树 / 技术水平': 'tech',
  '个人': 'personal', '区域': 'regional', '国家': 'national', '世界级': 'world',
  '书籍 / 专著': 'book', '论文 / 研究': 'paper', '网页 / 文章': 'web', '影视 / 视频': 'video',
  '游戏': 'game', '神话 / 传说': 'myth', '图片 / 画集': 'image',
};
const squeeze = (text) => String(text).replace(/\s+/g, '');
const SELECT_BY_LABEL = new Map(Object.entries(SELECT_LABELS).map(([k, v]) => [squeeze(k), v]));

/** 取 [正文开始] / [正文结束] 之间的原文 */
export function bodyOf(block) {
  const lines = block.split('\n');
  const start = lines.findIndex((l) => l.trim() === '● 正文开始');
  const end = lines.findIndex((l) => l.trim() === '● 正文结束');
  if (start < 0 || end < 0) return '';
  return lines.slice(start + 1, end).join('\n').trim();
}

/** 解析一张卡片的字段行 → fields 对象 + 问题列表 */
function parseFields(block) {
  const fields = {};
  const problems = [];
  const raw = pick(block, '●字段');
  if (raw && raw !== '空') {
    raw.split(/[；;]/).forEach((pair) => {
      const at = pair.indexOf('=');
      if (at < 0) return;
      const label = pair.slice(0, at).trim();
      const value = pair.slice(at + 1).trim();
      const key = FIELD_KEYS[label];
      if (!key) { problems.push(`未知字段名「${label}」`); return; }
      if (value === '空' || value === '') return;
      fields[key] = NUMERIC_KEYS.has(key) ? Number(value) : (SELECT_BY_LABEL.get(squeeze(value)) ?? value);
    });
  }
  return { fields, problems };
}

/** 解析一张卡片块 */
function parseCard(type, block, index) {
  const { fields, problems } = parseFields(block);
  return {
    index,
    type,
    title: pick(block, '●标题'),
    subtitle: pick(block, '●副标题'),
    summary: pick(block, '●摘要'),
    fields,
    body: bodyOf(block),
    problems,
  };
}

/** 解析「三、卡片」整节 → 卡组（按 `[三·N 类型（type）· N 张]` 分组） */
export function parseCards(sectionText) {
  const cards = [];
  const re = /^\[三·\d+\s*([^（(]+)[（(]([a-z]+)[）)]/gm;
  const marks = [...sectionText.matchAll(re)];
  marks.forEach((m, i) => {
    const from = m.index + m[0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : sectionText.length;
    const blocks = sectionText.slice(from, to).split(/^● 类型：/m).slice(1);
    blocks.forEach((block, bi) => cards.push(parseCard(m[2], `● 类型：${block}`, bi)));
  });
  return cards;
}

/** 解析「四、标签」：标签定义行 + 挂标签清单 */
export function parseTags(sectionText) {
  const tags = [];
  sectionText.split('\n').forEach((line) => {
    const m = /^(\S+)\s{2,}(#[0-9a-fA-F]{6})\s{2,}(\S+)$/.exec(line.trim());
    if (m) tags.push({ name: m[1], color: m[2], note: m[3] });
  });
  const map = [];
  (sectionText.split('[挂标签清单]')[1] ?? '').split('\n').forEach((line) => {
    // 跳过小标题与说明行，只认「卡片名 → 标签、标签」这种行
    if (line.includes('（') || !line.includes('→') || line.includes('共计')) return;
    const at = line.indexOf('→');
    map.push({ card: line.slice(0, at).trim(), tags: listOf(line.slice(at + 1)) });
  });
  return { tags, map };
}

/** 解析「五、关联」的表格行（卡片标题可能带空格与括号，所以用「两个以上空格」分列） */
export function parseRelations(sectionText) {
  const out = [];
  sectionText.split('\n').forEach((line) => {
    const m = /^(\d+)\s{2,}(.+?)\s{2,}(\S+)\s{2,}(.+?)(?:\s{2,}(\S.*))?$/.exec(line.trim());
    if (!m || m[1].length > 2) return;
    out.push({
      no: Number(m[1]), from: m[2].trim(), label: m[3],
      to: m[4].trim(), note: (m[5] ?? '').trim(),
    });
  });
  return out.filter((r) => r.from && r.to);
}

/** 解析「一、顶层设定」里的世界信息与分支（分支以「名称」起头） */
export function parseWorld(sectionText) {
  const branches = [];
  sectionText.split(/^\s*[①②③④⑤]\s*(?=名称)/m).slice(1).forEach((chunk) => {
    const name = pick(chunk, '名称');
    if (!name) return;
    branches.push({
      name,
      divergence: pick(chunk, '设定说明') || pick(chunk, '分歧点描述'),
      divergence_t: Number(pick(chunk, '分歧刻度')) || null,
      color: pick(chunk, '分支色') || '#8b5cf6',
      // 只有第一行写了「派生」才算派生：说明文字里也会出现这个词
      forkOf: /派生/.test(chunk.split('\n')[0]),
    });
  });
  return {
    name: pick(sectionText, '[世界观名称]'),
    description: pick(sectionText, '[一句话简介]'),
    time: {
      unit: pick(sectionText, '刻度单位名'),
      zeroLabel: pick(sectionText, '零点称呼'),
      defaultStart: Number(pick(sectionText, '默认起始刻度')),
      defaultEnd: Number(pick(sectionText, '默认结束刻度')),
      ageFactor: Number(pick(sectionText, '年龄换算系数')),
      allowNegative: true,
    },
    branches,
  };
}
