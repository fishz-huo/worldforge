/**
 * 卡片属性区 · 解析（文本块 → 结构化字段）
 * ==================================================================
 * 与 props-render.ts 一一对应：渲染出去的每一行都要能被这里原样读回来。
 * 自测里有一组往返用例（卡片 → 文本 → 卡片，字段逐个相等），那是这套格式
 * 唯一的正确性保证 —— 格式一旦漂移，用户改一圈回来字段就悄悄丢了。
 *
 * 只认我们渲染出来的子集，不做通用 YAML：锚点、多行块、流式嵌套是几百行的事，
 * 这里需要的只是 `键: 值` 与缩进的 `键: 值`。
 */
import type { FieldValue } from '@/types';
import { VALID_KEY } from './props-format';

/** 解析结果 */
export interface CardProps {
  type: string | null;
  typeLabel: string | null;
  subtitle: string | null;
  summary: string | null;
  tags: string[] | null;
  /** 结构化字段（不含 typeLabel，调用方负责合并） */
  fields: Record<string, FieldValue>;
  relations: RelationRef[];
}

/** 一条关联引用 */
export interface RelationRef {
  /** → 出边；← 入边；↔ 无向 */
  arrow: '→' | '←' | '↔';
  label: string;
  /** 对端标题，用于按标题兜底匹配 */
  title: string;
  /** 对端卡片 id（渲染时会写出来；外部手写的文本可能没有） */
  id: string | null;
  note: string;
}

/** 去掉行尾注释与首尾空白（只在裸标量上做，带引号的值不碰） */
function stripInlineComment(text: string): string {
  if (text.startsWith('"') || text.startsWith("'")) return text.trim();
  const at = text.search(/\s#/);
  // 末尾必须 trim：切掉注释后往往还剩几个空格，
  // 不 trim 的话 `character   # 注释` 会解析出尾部带空格的 `character  `
  return (at < 0 ? text : text.slice(0, at)).trim();
}

/** 反转义双引号字符串 */
function unescapeQuoted(text: string): string {
  return text.replace(/\\(.)/g, (_m, ch: string) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : ch));
}

/** 拆数组元素（跳过引号内的逗号） */
function splitItems(inner: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (quote) {
      cur += ch;
      if (ch === '\\') {
        cur += inner[i + 1] ?? '';
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * 标量文本 → 值。带引号的一律当字符串（这样 `"7"` 与 `7` 能区分开）；
 * 裸标量按数字 / 布尔 / 空值依次尝试。
 */
export function parseScalar(raw: string): FieldValue {
  const text = stripInlineComment(raw.trim());
  if (text.length >= 2 && (text.startsWith('"') || text.startsWith("'"))) {
    const end = text.lastIndexOf(text[0]);
    if (end > 0) return unescapeQuoted(text.slice(1, end));
  }
  if (text.startsWith('[') && text.endsWith(']')) {
    return splitItems(text.slice(1, -1)).map((item) => String(parseScalar(item)));
  }
  if (text === '' || text === '""' || text === "''") return '';
  if (/^(true|yes)$/i.test(text)) return 1;
  if (/^(false|no)$/i.test(text)) return 0;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

/** 值 → 字符串数组（tags 用） */
function asList(value: FieldValue): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value === '' || value === null || value === undefined) return [];
  return String(value).split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 解析一行关联。关系名允许省略：手写时 `→ 小满` 也算一条关联，
 * 关系名回落到「关联」。
 */
function parseRelation(line: string): RelationRef | null {
  const head = /^(→|←|↔)\s*(?:([^：:]*)[：:]\s*)?(.*)$/.exec(line.replace(/^-\s*/, '').trim());
  if (!head) return null;
  const rest = head[3].trim();
  if (!rest) return null;
  const idHit = /\[\[([^\]]+)\]\]\s*$/.exec(rest);
  const withoutId = idHit ? rest.slice(0, idHit.index) : rest;
  const noteHit = /（([^）]*)）\s*$/.exec(withoutId);
  const title = (noteHit ? withoutId.slice(0, noteHit.index) : withoutId).trim();
  if (!title) return null;
  return {
    arrow: head[1] as RelationRef['arrow'],
    label: (head[2] ?? '').trim() || '关联',
    title,
    id: idHit ? idHit[1].trim() : null,
    note: noteHit ? noteHit[1].trim() : '',
  };
}

/** 解析属性区文本；输入可带 `---` 围栏，也可不带（用户可能只复制了中间那段） */
export function parseProps(text: string): CardProps {
  const out: CardProps = {
    type: null, typeLabel: null, subtitle: null, summary: null,
    tags: null, fields: {}, relations: [],
  };
  /** 当前所处的段：null = 顶层；'fields' / 'relations' = 缩进段 */
  let section: 'fields' | 'relations' | null = null;

  text.replace(/\r\n?/g, '\n').split('\n').forEach((rawLine) => {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim() || line.trim() === '---') return;
    // 缩进行：属于当前段
    if (/^\s+\S/.test(line)) {
      const body = line.trim();
      if (section === 'relations') {
        const rel = parseRelation(body);
        if (rel) out.relations.push(rel);
        return;
      }
      if (section !== 'fields') return;
      const at = body.indexOf(':');
      if (at <= 0) return;
      const key = body.slice(0, at).trim();
      if (VALID_KEY.test(key)) out.fields[key] = parseScalar(body.slice(at + 1));
      return;
    }
    // 顶格行：切换段落（认不出来的顶层键直接忽略，绝不塞进字段里）
    const at = line.indexOf(':');
    if (at <= 0) return;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key === 'fields' || key === 'relations') {
      section = key;
      return;
    }
    section = null;
    if (key === 'type') out.type = String(parseScalar(value)) || null;
    else if (key === 'typeLabel') out.typeLabel = String(parseScalar(value)) || null;
    else if (key === 'subtitle') out.subtitle = String(parseScalar(value));
    else if (key === 'summary') out.summary = String(parseScalar(value));
    else if (key === 'tags') out.tags = asList(parseScalar(value));
  });

  return out;
}

/** 属性区里声明了哪些键（给「应用到卡片」提示改了什么用） */
export function propsKeys(props: CardProps): string[] {
  const keys = Object.keys(props.fields);
  if (props.type) keys.unshift('type');
  if (props.subtitle !== null) keys.push('subtitle');
  if (props.summary !== null) keys.push('summary');
  if (props.tags) keys.push('tags');
  if (props.relations.length) keys.push('relations');
  return keys;
}
