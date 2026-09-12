/**
 * 测试世界观文本解析 · 基础层
 * ------------------------------------------------------------------
 * 手册（docs/猫猫的冒险·世界观设定.txt）里混用了四种「标签 值」排版：
 *   `● 标题：灰尾`          全角冒号，卡片字段
 *   `  刻度单位名 = 年`     空格 + 等号 + 空格，世界观设置
 *   `名称      迁徙路线图`  空格对齐，地图与文稿属性
 *   `[世界观名称] 猫猫的冒险`  方括号标签
 * 这个模块把它们统一成同一套取值逻辑，并负责切分顶层小节。
 * 只做解析，不做业务校验（校验在 sample-lint.mjs / sample-check.mjs）。
 */

/** 顶层小节标题（只有这些才算小节，卡片分组标题不会被误认） */
const TOP_TITLES = [
  '一、顶层设定', '二、猫群的术语表（各卡片正文里会用到）', '三、卡片', '四、标签',
  '五、关联', '六、地图', '七、时间轴', '八、文稿', '九、大纲树',
  '十、功能核对清单', '十一、结尾',
];

/**
 * 切分顶层小节。
 * 排版约定：顶层小节用 60 个横线做边框；卡片分组 / 地图 / 文稿的小标题用 64 个横线，
 * 因此后者不会被误当成顶层小节。小节之外的说明放在 '（开头）' 里。
 */
export function splitTopSections(text) {
  const out = {};
  const re = /^─{60,64}$\n(.+?)\n─{60,64}$/gm;
  const marks = [...text.matchAll(re)].filter((m) => TOP_TITLES.includes(m[1].trim()));
  if (marks.length) out['（开头）'] = text.slice(0, marks[0].index);
  marks.forEach((m, i) => {
    const from = m.index + m[0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : text.length;
    out[m[1].trim()] = text.slice(from, to);
  });
  return out;
}

/** 正则元字符转义（标签里可能出现 `[` `]` 等符号） */
function esc(ch) {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

/** 值一定是数字的标签：一行里可能挤了多个属性，这类标签只取行内第一个数字 */
const NUMERIC_LABELS = new Set([
  '默认起始刻度', '默认结束刻度', '年龄换算系数', '分歧刻度', '时期刻度', '不透明度',
]);

/**
 * 按「标签 值」取一行。
 * 标签内部的空白会被忽略（这样 `● 标题：` 与 `●标题:` 等价），
 * 标签与值之间的分隔符（全角冒号 / 半角冒号 / 等号）可有可无。
 * 注意标签之间不能互为前缀（例如「标题」与「副标题」），否则短标签会先命中。
 */
export function pick(block, label) {
  const target = String(label).replace(/\s+/g, '').replace(/[：:=]$/, '');
  if (!target) return '';
  const head = [...target].map(esc).join('[ \\u3000]*');
  const hit = new RegExp(`[ \\u3000]*${head}[ \\u3000]*[：:=]?[ \\u3000]*(.*)$`, 'gm').exec(block);
  if (!hit) return '';
  const value = hit[1].trim();
  if (NUMERIC_LABELS.has(target)) return /-?\d+(?:\.\d+)?/.exec(value)?.[0] ?? value;
  return value;
}

/** 逗号列表 → 数组（空值返回空数组） */
export function listOf(text) {
  return text ? text.split(/[,，、]/).map((s) => s.trim()).filter(Boolean) : [];
}

/** 按 `[小节标记]` 切块：返回标记之后的若干块（标记本身不带回） */
export function splitBy(text, marker) {
  return text.split(marker).slice(1);
}
