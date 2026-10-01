/**
 * Markdown 语法着色：把正文切成「着色区间」
 * ------------------------------------------------------------------
 * 这是与 renderMarkdown 完全不同的另一条路：不产出 HTML、不解析双链，
 * 只输出 `{ start, end, kind }` 区间，供编辑器上层那块只读渲染层包 <span>。
 *
 * 铁律：**区间只切分，绝不增删字符**。
 * 字符数一变，折行点就变，叠加层立刻与底下的 textarea 错位 ——
 * 这是本功能唯一会翻车的地方（详见 docs 里的对齐说明与 scripts/md-highlight-selftest.mjs）。
 *
 * 只认四类：标题（整行）、列表符号、加粗 `**…**`、斜体 `*…*`。
 * 其余（双链、图片、表格、引用、分隔线、行内代码、围栏代码块）一律不着色，
 * 按原字符、原颜色输出。
 */

/** 区间类型：heading / marker 用柔蓝，bold 亮红，italic 暗红 */
export type MdTokenKind = 'heading' | 'marker' | 'bold' | 'italic';

/** 行类型：ul / ol 的正文要整体压成深紫蓝 */
export type MdLineKind = 'plain' | 'heading' | 'ul' | 'ol';

export interface MdToken {
  start: number;
  end: number;
  kind: MdTokenKind;
}

export interface MdLine {
  /** 原样保留的行文本（渲染层直接用，避免再 split 一次） */
  text: string;
  kind: MdLineKind;
  /** 按 start 升序、互不重叠；未覆盖的部分用默认前景色 */
  tokens: MdToken[];
}

/** 与 block.ts 的解析口径保持一致：`#` 后必须有空格；列表符号后必须有空格 */
const HEADING = /^(#{1,6})(\s+)(.*)$/;
const LIST = /^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/;

/**
 * 行内扫描：`**加粗**` 与 `*斜体*`。
 * - 行内代码 `` `…` `` 整段跳过（代码里不认语法）；
 * - `*` 后紧跟空格、或闭合标记前是空格，都不算强调（避免吃掉列表符号与分隔线）；
 * - 不处理 `***加粗斜体***` 这类组合，按 `**…**` 优先切一刀（已知简化）。
 */
function scanInline(line: string, from: number, tokens: MdToken[]): void {
  let i = from;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '`') {
      const close = line.indexOf('`', i + 1);
      i = close > i ? close + 1 : i + 1;
      continue;
    }
    if (ch === '*') {
      const marker = line.startsWith('**', i) ? '**' : '*';
      const close = line.indexOf(marker, i + marker.length);
      const inner = close - (i + marker.length);
      if (inner > 0 && line[i + marker.length] !== ' ' && line[close - 1] !== ' ') {
        tokens.push({
          start: i,
          end: close + marker.length,
          kind: marker === '**' ? 'bold' : 'italic',
        });
        i = close + marker.length;
        continue;
      }
    }
    i += 1;
  }
}

/**
 * 解析整篇文本。返回值与 `text.split('\n')` 一一对应 ——
 * **包括结尾换行产生的那一行空串**：textarea 会给它留一行高度，
 * 渲染层少这一行就会在滚到底时错位。
 */
export function parseHighlight(text: string): MdLine[] {
  const lines = text.split('\n');
  const out: MdLine[] = new Array(lines.length);
  /** 围栏代码块的开关：进来之后连围栏行本身也不着色 */
  let fence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      fence = !fence;
      out[i] = { text: line, kind: 'plain', tokens: [] };
      continue;
    }
    if (fence) {
      out[i] = { text: line, kind: 'plain', tokens: [] };
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out[i] = { text: line, kind: 'heading', tokens: [{ start: 0, end: line.length, kind: 'heading' }] };
      continue;
    }
    const list = LIST.exec(line);
    if (list) {
      const start = list[1].length;
      const afterMarker = start + list[2].length;
      const tokens: MdToken[] = [{ start, end: afterMarker, kind: 'marker' }];
      scanInline(line, afterMarker, tokens);
      out[i] = { text: line, kind: /\d/.test(list[2]) ? 'ol' : 'ul', tokens };
      continue;
    }
    const tokens: MdToken[] = [];
    scanInline(line, 0, tokens);
    out[i] = { text: line, kind: 'plain', tokens };
  }
  return out;
}
