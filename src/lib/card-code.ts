/**
 * 卡片永久编号
 * ==================================================================
 * 需求：给每张卡片一个**永久不变、可读、可引用**的编号（如 CHR-001）。
 * 标题可以随便改，而文稿与卡片正文里的 [[CHR-001]] 永远指向同一张卡片。
 *
 * 四条约定（都集中在这里实现，界面与 store 只调用，不各写一份）：
 *   1. **前缀按类型**：character → CHR、location → LOC …… 插件注册的类型
 *      按类型名推导前缀（前三位大写），所以不必给插件开白名单。
 *   2. **序号不复用**：已发到几号记在 world.meta.codeSeq。删掉 CHR-007 之后
 *      最大号会退回 6，若只看库里的最大号，下一张新卡又会拿到 CHR-007，
 *      旧文稿里的 [[CHR-007]] 就指错卡片了 —— 所以必须有这份「发号记录」。
 *   3. **编号优先于标题**：解析 [[X]] 时先当编号找，再当标题找（见 query.ts），
 *      两者重名时结果可预期。
 *   4. **编号为空 = 未编号**：老数据与旧备份导入的卡片都是这个状态，
 *      用户在详情页补填，或用「批量补全编号」一次生成。
 */
import type { Card, WorldMeta } from '@/types';
import { escapeRegExp } from './markdown/inline';

/** 内置类型 → 编号前缀（插件类型走 codePrefixOf 的推导分支） */
const TYPE_PREFIX: Record<string, string> = {
  character: 'CHR',
  location: 'LOC',
  event: 'EVT',
  lore: 'LOR',
  faction: 'FAC',
  item: 'ITM',
  concept: 'CON',
  reference: 'REF',
  note: 'NOT',
  /** 「其他类型」卡片：用户可以自己把编号改成更贴切的前缀 */
  custom: 'CUS',
};

/** 取某个卡片类型的前缀（未知类型按类型名推导，保证永远有前缀可用） */
export function codePrefixOf(type: string): string {
  const mapped = TYPE_PREFIX[type];
  if (mapped) return mapped;
  const derived = String(type ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  return derived || 'CARD';
}

/** 前缀 + 序号 → 编号（序号补足三位；超过 999 自然变成四位，不截断） */
export function formatCode(prefix: string, n: number): string {
  return `${prefix}-${String(Math.max(1, Math.floor(n))).padStart(3, '0')}`;
}

/** 编号的前缀部分（`ELARA-001` → `ELARA`）；不是「前缀-数字」形状返回空串 */
export function codePrefix(code: string): string {
  const m = /^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/.exec(String(code ?? '').trim());
  return m ? m[1].toUpperCase() : '';
}

/** 从编号里读回序号；指定 prefix 时前缀不符返回 null */
export function codeNumber(code: string, prefix?: string): number | null {
  const m = /^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/.exec(String(code ?? '').trim());
  if (!m) return null;
  if (prefix && m[1].toUpperCase() !== prefix.toUpperCase()) return null;
  return Number(m[2]);
}

/* ------------------------------ 读取卡片上的编号 ------------------------------ */

/** 卡片的编号（容错：老数据可能是 null，一律当未编号） */
export function codeOf(card: Card): string {
  return typeof card.code === 'string' ? card.code.trim() : '';
}

/** 卡片保留的旧编号列表 */
export function aliasesOf(card: Card): string[] {
  const raw = (card as { code_aliases?: unknown }).code_aliases;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

/** 能跳转到这张卡片的全部「编号类」键：现用编号 + 旧编号 */
export function linkKeysOf(card: Card): string[] {
  return [codeOf(card), ...aliasesOf(card)].filter(Boolean);
}

/**
 * 正文里该用什么写法引用这张卡片：
 *   - 有编号 → `[[CHR-001|艾拉]]`（显示标题，靠编号定位，改标题不断链）
 *   - 没编号 → `[[艾拉]]`（老写法，照旧可用）
 */
export function wikiRefOf(card: Card): string {
  const code = codeOf(card);
  return code ? `[[${code}|${card.title}]]` : `[[${card.title}]]`;
}

/* ------------------------------ 校验与查重 ------------------------------ */

/**
 * 编号允许的字符：字母 / 数字 / 下划线 / 连字符 / 中文，且首字符不能是符号。
 * 明确不许出现空白与 `[` `]` `|`：它们是 [[双链]] 语法本身的分隔符，
 * 含这些字符的编号根本解析不出来（能存进去却点不动，是最糟的一种"成功"）。
 */
const CODE_OK = /^[A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9_\-\u4e00-\u9fa5]*$/;

/** 校验编号；合法返回 null，否则返回给用户看的错误文案 */
export function validateCode(code: string): string | null {
  if (!code) return '编号不能为空';
  if (code.length > 32) return '编号太长了（最多 32 个字符）';
  if (!CODE_OK.test(code)) return '编号只能用字母、数字、下划线、连字符与中文，不能含空格或 [ ] |';
  return null;
}

/** 去掉用户可能一起粘进来的写法包装：`[[CHR-001]]`、前后空白 */
export function normalizeCode(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^\[\[/, '')
    .replace(/\]\]$/, '')
    .trim();
}

/**
 * 编号是否已被别的卡片占用（现用编号与旧编号都算占用）。
 * 编号本身不区分大小写：`chr-001` 与 `CHR-001` 视为同一个。
 * @param exceptId 排除自己（改自己的编号时不算冲突）
 */
export function findCodeConflict(cards: Card[], code: string, exceptId?: string): Card | null {
  const want = normalizeCode(code).toLowerCase();
  if (!want) return null;
  return cards.find(
    (c) => c.id !== exceptId && linkKeysOf(c).some((key) => key.toLowerCase() === want),
  ) ?? null;
}

/* ------------------------------ 发号 ------------------------------ */

/** 库里某个前缀已经用过的全部序号 */
export function numbersWithPrefix(cards: Card[], prefix: string): number[] {
  return cards
    .map((c) => codeNumber(codeOf(c), prefix))
    .filter((n): n is number => n !== null);
}

/**
 * 给某个类型发下一个编号。
 * 取「发号记录 meta.codeSeq」与「库里现有最大号」的较大者 +1，
 * 所以既不会与现存编号撞车，也不会复用已经删掉的编号。
 */
export function nextCode(cards: Card[], type: string, seq: WorldMeta['codeSeq'] = {}): string {
  const prefix = codePrefixOf(type);
  const fromSeq = seq?.[prefix] ?? 0;
  const max = numbersWithPrefix(cards, prefix).reduce((acc, n) => Math.max(acc, n), fromSeq);
  return formatCode(prefix, max + 1);
}

/**
 * 按数组顺序给「还没有编号」的卡片依次发号（每个前缀各自从 001 开始）。
 * 示例数据与「批量补全编号」共用同一套规则，两处不会出现不同口径。
 */
export function assignSequentialCodes(cards: Card[]): void {
  const counters = new Map<string, number>();
  cards.forEach((card) => {
    if (codeOf(card)) return;
    const prefix = codePrefixOf(card.type);
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    card.code = formatCode(prefix, n);
    if (!Array.isArray(card.code_aliases)) card.code_aliases = [];
  });
}

/* ------------------------------ 引用替换 ------------------------------ */

/**
 * 把文本里所有 `[[旧编号]]` / `[[旧编号|显示名]]` 换成新编号（保留显示名）。
 * 只认双链写法：正文里裸写的 CHR-001 不动 —— 那种地方可能是别的东西
 * （编号也是普通字符串），自动改写风险大于收益。
 */
export function replaceCodeRefs(text: string, from: string, to: string): { text: string; count: number } {
  if (!text || !from || from === to) return { text, count: 0 };
  const pattern = new RegExp(`\\[\\[\\s*${escapeRegExp(from)}\\s*(\\|[^\\]]*)?\\]\\]`, 'gi');
  let count = 0;
  const next = text.replace(pattern, (_match, label?: string) => {
    count += 1;
    const shown = label ? `|${label.slice(1).trim()}` : '';
    return `[[${to}${shown}]]`;
  });
  return { text: next, count };
}
