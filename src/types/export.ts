/**
 * 文档导出契约（导出插件与宿主之间的约定）
 * ==================================================================
 * 需求：把软件里编辑的文字内容导出成通用格式（Markdown / 纯文本 / Word / PDF），
 * 一区一文件，既能用别的软件打开查看，也算另一种形式的数据备份。
 *
 * 实现分层（每一层都能单独自测，见 scripts/export-selftest.mjs）：
 *   1. lib/export/collect.ts   宿主数据（卡片 / 文稿 / 大纲节点）→ ExportArea（纯数据）
 *   2. lib/export/render*.ts   ExportArea → Markdown / 纯文本 / 打印用 HTML
 *   3. lib/export/md-blocks.ts Markdown → DocBlock（Word 用的结构化块）
 *   4. lib/export/docx.ts      DocBlock → .docx 字节（OOXML + ZIP，无第三方依赖）
 *   5. lib/export/build.ts     串起来，决定文件怎么切、叫什么名字
 *
 * 本文件只有类型与常量，没有任何逻辑，因此可以被上面任何一层自由引用。
 */
import type { Card } from './card';
import type { Doc, OutlineNode } from './doc';
import type { CardTag, Relation, Tag } from './tag';

/** 可导出的区域：与软件里的模块一一对应，用户按区域勾选 */
export type ExportAreaId = 'cards' | 'manuscript' | 'notes' | 'outline';

/** 目标格式 */
export type ExportFormat = 'md' | 'txt' | 'docx' | 'pdf';

/** 区域显示名 */
export const AREA_LABELS: Record<ExportAreaId, string> = {
  cards: '卡片 Wiki',
  manuscript: '写作正文',
  notes: '写作笔记',
  outline: '大纲',
};

/** 区域来源说明：告诉用户这份文件里的内容是从哪儿来的 */
export const AREA_HINTS: Record<ExportAreaId, string> = {
  cards: '卡片库里的全部设定卡片（含字段、标签与关联）',
  manuscript: '写作模块的正文文稿',
  notes: '写作模块里的笔记',
  outline: '大纲模块的大纲文稿与节点树',
};

/** 格式显示名 */
export const FORMAT_LABELS: Record<ExportFormat, string> = {
  md: 'Markdown',
  txt: '纯文本',
  docx: 'Word 文档',
  pdf: 'PDF',
};

/** 文件扩展名 */
export const FORMAT_EXT: Record<ExportFormat, string> = { md: 'md', txt: 'txt', docx: 'docx', pdf: 'pdf' };

/** MIME 类型（网页版下载时用） */
export const FORMAT_MIME: Record<ExportFormat, string> = {
  md: 'text/markdown',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};

/** 全部区域 / 全部格式的稳定顺序（界面上按这个顺序排） */
export const ALL_AREAS: ExportAreaId[] = ['cards', 'manuscript', 'notes', 'outline'];
export const ALL_FORMATS: ExportFormat[] = ['md', 'txt', 'docx', 'pdf'];

/** 条目上的一条「属性：值」（卡片字段、文稿摘要等） */
export interface ExportMeta {
  label: string;
  value: string;
}

/** 一个条目 = 一张卡片 / 一篇文稿，是导出文件里的一节 */
export interface ExportItem {
  id: string;
  title: string;
  /** 副标题，没有则为空串 */
  subtitle: string;
  meta: ExportMeta[];
  /** 正文（Markdown 原文，原样保留） */
  markdown: string;
  /** 标签名 */
  tags: string[];
  /** 「关系名 → 目标卡片标题」，例如「→ 师父：云中君」 */
  relations: string[];
}

/** 一个区域 = 一份导出文件的内容 */
export interface ExportArea {
  id: ExportAreaId;
  title: string;
  items: ExportItem[];
  /** 每个条目是否另起一页（正文/大纲按章节另起一页更像书） */
  pageBreakPerItem: boolean;
}

/** 给界面看的区域摘要（不携带正文，避免把整库文本灌给插件） */
export interface ExportAreaSummary {
  id: ExportAreaId;
  title: string;
  hint: string;
  /** 条目数 */
  count: number;
  /** 字数（中日韩按字、西文按词） */
  words: number;
}

/** 导出请求 */
export interface ExportRequest {
  areaIds: ExportAreaId[];
  formats: ExportFormat[];
  /** 每个条目单独成文件（默认 false：一个区域一个文件） */
  split?: boolean;
  /** 卡片条目里带上标签与关联（默认 true） */
  includeRelations?: boolean;
  /** 只导出当前平行世界分支可见的条目（默认 false：导出全部） */
  branchOnly?: boolean;
}

/**
 * 一份待写盘的文件。
 *  - text / bytes：直接写盘的内容（md / txt / docx）
 *  - html：PDF 走「打印成 PDF」，这里放打印用的完整 HTML
 */
export interface ExportFile {
  format: ExportFormat;
  name: string;
  mime: string;
  text?: string;
  bytes?: Uint8Array;
  html?: string;
  /** 目录内相对路径（拆分成多文件时带上分区子目录） */
  subDir?: string;
}

/** 采集区域内容所需的宿主数据（一次性传入，collect 不碰 store，便于自测） */
export interface ExportSource {
  worldName: string;
  branchName: string;
  branchId: string | null;
  /** 导出时间（毫秒），用于页眉与文件名 */
  exportedAt: number;
  cards: Card[];
  docs: Doc[];
  outlineNodes: OutlineNode[];
  tags: Tag[];
  cardTags: CardTag[];
  relations: Relation[];
}

/* --------------------------- Word 用的文档块模型 --------------------------- */

/**
 * 行内片段：Word 不像 HTML 那样能直接吃 Markdown，
 * 需要先把 `**粗体**`、`*斜体*`、`` `代码` `` 拆成带格式的片段。
 */
export interface DocSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/** 表格块：表头 + 数据行，单元格里是行内片段 */
export interface DocTableBlock {
  kind: 'table';
  header: DocSpan[][];
  rows: DocSpan[][][];
}

/** 块级元素：Markdown 的段落级结构 */
export type DocBlock =
  | { kind: 'heading'; level: number; spans: DocSpan[] }
  | { kind: 'para'; spans: DocSpan[] }
  | { kind: 'list'; ordered: boolean; items: DocSpan[][] }
  | { kind: 'quote'; spans: DocSpan[] }
  | { kind: 'code'; text: string }
  | { kind: 'divider' }
  | DocTableBlock;

/** 交给 docx.ts 的完整文档（抬头信息 + 正文块） */
export interface DocxInput {
  title: string;
  subtitle: string;
  /** 抬头下的元信息行，如「导出于 2025-01-01 · 48 张卡片」 */
  meta: string[];
  blocks: DocBlock[];
  /** 一级标题之前是否分页（按章节导出时，每章另起一页） */
  pageBreakBeforeHeadings: boolean;
}
