/**
 * zustand selector 静态检查器
 * ------------------------------------------------------------------
 * 为什么需要它：`useStore` 用 `Object.is` 比较 selector 的返回值。
 * 如果 selector 里写了 `s.cards.filter(...)`，每次调用都返回**新数组**，
 * zustand 就永远认为「状态变了」，于是无限重渲染 ——
 * React 抛 "Maximum update depth exceeded"，整棵组件树被卸载，用户看到白屏。
 *
 * 这类 bug 有两个恶劣特性：
 *   1. typecheck、构建、单元测试全都发现不了（类型正确、逻辑看着也对）；
 *   2. 只有真正渲染到那个组件时才炸，所以能潜伏很久。
 * 因此用静态检查把它拦在提交之前。
 *
 * 判断规则：selector 体里出现「每次返回新引用」或「就地修改状态」的写法就算违规。
 * 返回既有引用或原始值的写法（find / some / includes…）是安全的，不报。
 * 若显式传了第二个参数（比较函数，如 useShallow），则按 zustand 的设计放行。
 */

/** 每次返回新数组的方法 —— 直接导致无限重渲染 */
const COPYING_CALLS =
  /\.\s*(filter|map|slice|concat|flatMap|flat|split|toSorted|toReversed|toSpliced|with)\s*\(/;

/** 就地修改 store 状态的方法 —— selector 必须是只读的 */
const MUTATING_CALLS = /\.\s*(sort|reverse|splice|push|pop|shift|unshift|fill|copyWithin)\s*\(/;

/** 聚合计算 —— 每次渲染都重算，且累加器常是对象字面量 */
const AGGREGATING_CALLS = /\.\s*(reduce|reduceRight)\s*\(/;

/** 其他会产生新引用的写法 */
const ALLOCATING_FORMS = [
  { re: /\.\.\./, why: '展开运算符会创建新数组 / 新对象' },
  { re: /\|\|\s*\[\s*\]/, why: '`|| []` 每次都返回新的空数组' },
  { re: /\?\?\s*\[\s*\]/, why: '`?? []` 每次都返回新的空数组' },
  { re: /\|\|\s*\{\s*\}/, why: '`|| {}` 每次都返回新的空对象' },
  { re: /\?\?\s*\{\s*\}/, why: '`?? {}` 每次都返回新的空对象' },
  {
    re: /\bObject\s*\.\s*(keys|values|entries|assign|fromEntries)\s*\(/,
    why: 'Object 静态方法返回新对象 / 新数组',
  },
  { re: /\bArray\s*\.\s*(from|of)\s*\(/, why: 'Array.from / Array.of 返回新数组' },
  { re: /\bnew\s+(Set|Map|WeakSet|WeakMap)\s*\(/, why: 'new Set / new Map 返回新容器' },
];

/**
 * 从 `(` 开始取出配对的括号内容，能跳过字符串、注释与嵌套括号。
 * @returns {{ args: string, end: number } | null} args 为括号内的原文
 */
export function extractParens(src, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    // 注释直接跳过，避免里面的括号干扰配对
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i);
      i = close === -1 ? src.length : close + 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return { args: src.slice(openIndex + 1, i), end: i };
    }
  }
  return null;
}

/** 按顶层逗号切分参数列表（忽略嵌套里的逗号） */
export function splitTopLevel(args) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (let i = 0; i < args.length; i += 1) {
    const ch = args[i];
    if (quote) {
      cur += ch;
      if (ch === '\\') {
        cur += args[i + 1] ?? '';
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * 去掉注释，避免注释里作为「反例」写到的 .filter( 被误判。
 * 说明：这里不区分字符串字面量，selector 里出现含 // 的字符串属于极罕见情况。
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * 检查单个 selector 表达式文本。
 * @returns {string[]} 违规原因列表，空数组表示安全
 */
export function inspectSelector(selector) {
  const body = stripComments(selector).trim();
  const reasons = [];

  // 返回对象字面量：简写体 `=> ({...})` 与块级体里的 `return {...}`
  if (/=>\s*\(\s*\{/.test(body) || /return\s*\(?\s*\{/.test(body)) {
    reasons.push('selector 返回对象字面量，每次都是新对象（改用 useMemo 或逐个字段取值）');
  }

  const copying = body.match(COPYING_CALLS);
  if (copying) {
    reasons.push(`selector 里调用了 .${copying[1]}()，每次返回新引用 → 无限重渲染（挪到组件里的 useMemo）`);
  }

  const mutating = body.match(MUTATING_CALLS);
  if (mutating) {
    reasons.push(`selector 里调用了 .${mutating[1]}()，会就地修改 store 里的数组（selector 必须只读）`);
  }

  const aggregating = body.match(AGGREGATING_CALLS);
  if (aggregating) {
    reasons.push(`selector 里用 .${aggregating[1]}() 聚合，每次渲染都重算（建议挪到 useMemo）`);
  }

  for (const { re, why } of ALLOCATING_FORMS) {
    if (re.test(body)) reasons.push(why);
  }

  return reasons;
}

/**
 * 扫描一份源码里所有 useStore(...) 调用。
 * @returns {{ line: number, text: string, reasons: string[] }[]}
 */
export function lintSelectorSource(src, { onlyArrow = true } = {}) {
  const findings = [];
  const needle = 'useStore(';
  let from = 0;

  for (;;) {
    const at = src.indexOf(needle, from);
    if (at === -1) break;
    from = at + needle.length;

    // 排除 useStoreWithEqualityFn 之类的前缀误命中：前一个字符必须是分隔符
    const prev = src[at - 1];
    if (prev && /[\w$.]/.test(prev)) continue;

    const call = extractParens(src, at + needle.length - 1);
    if (!call) continue;

    const argList = splitTopLevel(call.args);
    if (argList.length === 0) continue;

    // 显式传了比较函数（useShallow / shallow）：按 zustand 的设计是安全的
    if (argList.length > 1 && argList[1] !== 'undefined') continue;

    const selector = argList[0];
    if (onlyArrow && !selector.includes('=>')) continue; // 传的是外部函数引用，本文件分析不了

    const reasons = inspectSelector(selector);
    if (reasons.length === 0) continue;

    findings.push({
      line: src.slice(0, at).split('\n').length,
      text: selector.replace(/\s+/g, ' ').slice(0, 120),
      reasons,
    });
  }

  return findings;
}
