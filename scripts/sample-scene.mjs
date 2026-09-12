/**
 * 测试世界观文本解析 · 场景层（地图 / 时间轴 / 文稿 / 大纲树）
 * ------------------------------------------------------------------
 * 这一层的排版比卡片更松散（空格对齐的表格），所以取值统一走 sample-text.mjs
 * 的 pick()：它会忽略标签内部空白，也容忍标签与值之间的冒号或等号。
 */
import { pick } from './sample-text.mjs';

/** 解析坐标列：「0.11, 0.62」 → [0.11, 0.62] */
function coords(text) {
  const m = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(text);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** 解析一张地图（属性 + 标记点 + 区域） */
function parseMap(block) {
  const map = {
    name: pick(block, '名称'),
    description: pick(block, '描述'),
    period: pick(block, '时期标签'),
    period_t: Number(pick(block, '时期刻度')) || null,
    opacity: Number(pick(block, '不透明度')) || 0.9,
    asset_id: null,
    pins: [],
    regions: [],
  };
  // 标记点：表头行带 #，数据行形如「1   标签   0.11, 0.62   🏠   #ef4444   备注」
  block.split('\n').filter((l) => /^\d+\s{2,}\S/.test(l) && l.includes('#')).forEach((line) => {
    const [no, label, xy, icon, color, ...rest] = line.trim().split(/\s{2,}/);
    const pos = coords(xy ?? '');
    if (!pos || !color?.startsWith('#')) return;
    map.pins.push({ no: Number(no), label, x: pos[0], y: pos[1], icon, color, note: rest.join(' ').trim() });
  });
  // 区域：每个「区域 A <名称>」小节
  block.split(/^区域[ \u3000]+[A-Z][ \u3000]+/m).slice(1).forEach((chunk) => {
    const points = (pick(chunk, '顶点') || '').split('→').map((p) => coords(p)).filter(Boolean);
    map.regions.push({
      name: /^(\S+)/.exec(chunk.trim())?.[1] ?? '',
      color: pick(chunk, '颜色') || '#38bdf8',
      points,
      period: pick(chunk, '时期') || map.period,
      note: pick(chunk, '备注'),
    });
  });
  return map;
}

/** 解析「六、地图」整节 */
export function parseMaps(sectionText) {
  return sectionText.split(/^\[地图\s*\d+\]\s*/m).slice(1).map(parseMap);
}

/** 解析「七、时间轴」：泳道 / 纪元 / 条目清单 */
export function parseTimeline(sectionText) {
  const lines = sectionText.split('\n').map((l) => l.trim());
  const tracks = [];
  const eras = [];
  const entries = [];
  lines.forEach((line) => {
    const track = /^(\d+)\s{2,}(\S+)\s{2,}([a-z]+)\s{2,}(#[0-9a-fA-F]{6})\s{2,}(是|否)/.exec(line);
    if (track) tracks.push({ name: track[2], kind: track[3], color: track[4], valued: track[5] === '是' });
    const era = /^(\S+)\s{2,}(-?\d+(?:\.\d+)?)\s{2,}(-?\d+(?:\.\d+)?)\s{2,}(#[0-9a-fA-F]{6})\s{2,}(\S+)/.exec(line);
    if (era) eras.push({ name: era[1], start_t: Number(era[2]), end_t: Number(era[3]), color: era[4], note: era[5] });
    const entry = /^(\d+)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(空|-?\d+(?:\.\d+)?)\s{2,}(空|-?\d+(?:\.\d+)?)\s{2,}(\S+)\s{2,}(空|\d+(?:\.\d+)?)\s{2,}(\S+)$/.exec(line);
    if (entry) {
      entries.push({
        no: Number(entry[1]), track: entry[2], title: entry[3],
        start_t: entry[4] === '空' ? null : Number(entry[4]),
        end_t: entry[5] === '空' ? null : Number(entry[5]),
        state: entry[6],
        value: entry[7] === '空' ? null : Number(entry[7]),
        card: entry[8] === '空' ? null : entry[8],
      });
    }
  });
  return { tracks, eras, entries };
}

/** 解析「八、文稿」：类型 / 标题 / 摘要 / 内容（内容在 [内容开始] 与 [内容结束] 之间） */
export function parseDocs(sectionText) {
  const KIND = { '正文': 'manuscript', '大纲': 'outline', '笔记': 'note' };
  return sectionText.split(/^\[文稿\s*\d+\]\s*类型：/m).slice(1).map((chunk) => {
    const lines = chunk.split('\n');
    const kindLabel = lines[0].trim();
    const rest = lines.slice(1).join('\n');
    const start = rest.indexOf('内容开始');
    const end = rest.indexOf('内容结束');
    return {
      kind: KIND[kindLabel] ?? 'manuscript',
      title: pick(rest, '标题'),
      summary: pick(rest, '摘要'),
      content: start >= 0 && end > start ? rest.slice(start + 4, end).trim() : '',
    };
  });
}

const STATUSES = ['已完成', '写作中', '构思', '已废弃'];

/**
 * 解析「九、大纲树」的节点表（缩进两格表示子节点）。
 * 每行形如：`第一幕 · 离开    已完成    摘要    关联卡片`，
 * 用状态词把行切成「标题 | 状态 | 摘要 | 卡片」四段，比按列切更稳。
 */
export function parseOutline(sectionText) {
  const rows = [];
  let parent = null;
  sectionText.split('\n').forEach((line) => {
    const m = new RegExp(`^(\\s*)(.*?)\\s{2,}(${STATUSES.join('|')})\\s{2,}(.*?)\\s{2,}(.*?)\\s*$`).exec(line);
    if (!m) return;
    const card = m[5].trim();
    const row = {
      title: m[2].trim(),
      status: m[3],
      summary: m[4].trim(),
      card: card && card !== '-' ? card : null,
      child: m[1].length > 0,
    };
    if (!row.child) parent = rows.length;
    else row.parentIndex = parent;
    rows.push(row);
  });
  return rows;
}
