/**
 * Word（.docx）导出：文档块 → OOXML 部件 → ZIP 字节
 * ------------------------------------------------------------------
 * .docx 就是一个 ZIP 包，装着若干 XML 部件：[Content_Types].xml 声明各部件类型，
 * 各级 .rels 声明部件之间的关系，word/document.xml 才是正文。
 *
 * 为什么这样设计：
 *   1. 不引入任何第三方库，只手写 OOXML 的最小可行子集：目标只有一个 ——
 *      Microsoft Word / WPS 双击能正常打开，而不是还原 Word 的全部能力。
 *   2. 不生成 numbering.xml：列表用「• 」/「N. 」前缀 + 420 左缩进，视觉一致却少一个部件。
 *   3. 样式集中在 styles.xml，正文段落只引用 pStyle，不逐段堆格式，改样式只改一处。
 *   4. 文本一律过 esc()，run 带 xml:space="preserve"，否则中文前后的空格、代码缩进会被吃掉。
 *   5. 段落里的 \n（Markdown 硬折行）渲染成 <w:br/>，与软件预览里的 <br /> 对齐。
 */
import type { DocBlock, DocSpan, DocTableBlock, DocxInput } from '@/types';
import { buildZip } from './zip';

/* A4 纵向纸张（twips：11906 × 16838）、上下页边距 1440、左右 1701；CONTENT_W 是正文可用宽度 */
const PAGE_W = 11906, PAGE_H = 16838, MARGIN_X = 1701, MARGIN_Y = 1440;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

/** XML 转义：正文与属性值都走这里，& < > " ' 一个都不能漏 */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
/** 一个 run 的 rPr：粗体 / 斜体 / 代码（Consolas + 灰底 F2F2F2） */
function runProps(span: DocSpan, forceBold: boolean): string {
  const props: string[] = [];
  if (span.bold || forceBold) props.push('<w:b/>');
  if (span.italic) props.push('<w:i/>');
  if (span.code) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>', '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>');
  return props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : '';
}
/** 片段数组 → run 序列（forceBold 供表头复用）；run 里不能直接放 \n，拆成 <w:br/> */
function runsXml(spans: DocSpan[], forceBold = false): string {
  return spans.map((span: DocSpan) => {
    const text = span.text.split('\n').map((line: string) => `<w:t xml:space="preserve">${esc(line)}</w:t>`).join('<w:br/>');
    return `<w:r>${runProps(span, forceBold)}${text}</w:r>`;
  }).join('');
}
/** 段落：pPr（pStyle + 附加属性）+ runs，元素次序遵循 OOXML 的 sequence */
function paraXml(spans: DocSpan[], style = '', extraPr = ''): string {
  const pPr = style || extraPr ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extraPr}</w:pPr>` : '';
  return `<w:p>${pPr}${runsXml(spans)}</w:p>`;
}
/** 代码块：每行一个 Code 段落（保留缩进与空行），首尾段加 keepLines 防止被拆页 */
function codeXml(text: string): string {
  const lines = text.replace(/\n$/, '').split('\n');
  const keep = (i: number) => (i === 0 || i === lines.length - 1 ? '<w:keepLines/>' : '');
  return lines.map((line, i) =>
    `<w:p><w:pPr><w:pStyle w:val="Code"/>${keep(i)}</w:pPr>${line ? runsXml([{ text: line, code: true }]) : ''}</w:p>`,
  ).join('');
}
/** 列表：无序「• 」、有序「N. 」文本前缀 + 420 左缩进（不引入 numbering.xml） */
function listXml(ordered: boolean, items: DocSpan[][]): string {
  return items.map((spans, i) => paraXml([{ text: ordered ? `${i + 1}. ` : '• ' }, ...spans], '', '<w:ind w:left="420"/>')).join('');
}
/** 表格：等宽列 + 细边框（single sz=4 BFBFBF），表头行加粗 */
function tableXml(block: DocTableBlock): string {
  const cols = Math.max(block.header.length, 1);
  const width = Math.floor(CONTENT_W / cols);
  const cell = (spans: DocSpan[], bold: boolean) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p>${runsXml(spans, bold)}</w:p></w:tc>`;
  // 单元格数量与列数对齐：多出来的列丢弃、缺的补空单元格，避免表格塌掉
  const row = (cells: DocSpan[][], bold: boolean) => `<w:tr>${Array.from({ length: cols }, (_v, c) => cell(cells[c] ?? [], bold)).join('')}</w:tr>`;
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>` +
    `<w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>` +
    `${row(block.header, true)}${block.rows.map((cells: DocSpan[][]) => row(cells, false)).join('')}</w:tbl>`;
}
/** 单个块 → OOXML 片段（pageBreak 为真时该标题另起一页） */
function blockXml(block: DocBlock, pageBreak: boolean): string {
  switch (block.kind) {
    // Word 只到 Heading4 有对应样式，5 / 6 级标题并到 Heading4
    case 'heading': return paraXml(block.spans, `Heading${Math.min(Math.max(block.level, 1), 4)}`, pageBreak ? '<w:pageBreakBefore/>' : '');
    case 'para': return paraXml(block.spans);
    case 'quote': return paraXml(block.spans, 'Quote');
    case 'divider': return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"/></w:pBdr></w:pPr></w:p>'; // 分隔线 = 只带下边框的空段落
    case 'code': return codeXml(block.text);
    case 'list': return listXml(block.ordered, block.items);
    case 'table': return tableXml(block);
    default: return '';
  }
}
/** 正文：封面信息（标题 / 副标题 / 元信息）→ 各块 → 节属性（A4 与页边距） */
function bodyXml(input: DocxInput): string {
  const parts: string[] = [];
  if (input.title) parts.push(paraXml([{ text: input.title }], 'Title'));
  if (input.subtitle) parts.push(paraXml([{ text: input.subtitle }], 'Subtitle'));
  for (const line of input.meta) parts.push(paraXml([{ text: line }], 'Meta'));
  for (const block of input.blocks) {
    // 一级标题分页：第一个也算（它是新章节的开头，本就该从新页开始）
    parts.push(blockXml(block, input.pageBreakBeforeHeadings && block.kind === 'heading' && block.level === 1));
  }
  const sectPr = `<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/><w:pgMar w:top="${MARGIN_Y}" w:right="${MARGIN_X}" ` +
    `w:bottom="${MARGIN_Y}" w:left="${MARGIN_X}" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr>`;
  return parts.join('') + sectPr;
}
/** 正文部件的头尾：只声明用到的主命名空间（没有超链接 / 编号，用不上 r 命名空间） */
const DOC_OPEN = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>';
const DOC_CLOSE = '</w:body></w:document>';

/** 部件类型表：docx 主部件与 styles 的 content type 必须写对，否则 Word 认不出这个包 */
const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
  '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
  '</Types>';

/** 包级关系：officeDocument 指向正文，另两条把 core / app 属性挂上去 */
const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
  '</Relationships>';

/** 正文部件自己的关系：只用到 styles（没做编号、超链接、页眉页脚） */
const DOC_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

/** 扩展属性：元素次序按 OOXML 的 sequence（Application 在 AppVersion 之前） */
const APP_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
  '<Application>WorldForge</Application><AppVersion>0.1</AppVersion></Properties>';

/* 样式表：w:sz 的单位是半磅（10.5pt → 21）。Normal 宋体 + Calibri、10.5pt、1.5 倍行距；
   Heading1 带下边框，呼应预览里 h1 的下划线；各级标题设 outlineLvl，方便 Word 生成导航目录。 */
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="595959"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="595959"/></w:pBdr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="120"/><w:ind w:left="420"/></w:pPr><w:rPr><w:i/><w:color w:val="595959"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:spacing w:line="240" w:lineRule="auto" w:before="0" w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="宋体" w:cs="Consolas"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:line="240" w:lineRule="auto" w:after="0"/></w:pPr><w:rPr><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>' +
  '</w:styles>';

/** 核心属性：dc:title 与 dcterms:created 是 Word「文件信息」里会显示的两项 */
function coreXml(input: DocxInput, stamp: string): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${esc(input.title)}</dc:title><dc:creator>WorldForge</dc:creator>` +
    '<cp:lastModifiedBy>WorldForge</cp:lastModifiedBy>' +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified></cp:coreProperties>`;
}

/** 组装 .docx 字节。[Content_Types].xml 必须在第一位：解析器先读它才知道各部件的类型 */
export async function buildDocx(input: DocxInput): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const xml = (text: string) => encoder.encode(text);
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z'); // 去掉毫秒，兼容更老的解析器
  return buildZip([
    { name: '[Content_Types].xml', data: xml(CONTENT_TYPES) },
    { name: '_rels/.rels', data: xml(ROOT_RELS) },
    { name: 'word/document.xml', data: xml(DOC_OPEN + bodyXml(input) + DOC_CLOSE) },
    { name: 'word/_rels/document.xml.rels', data: xml(DOC_RELS) },
    { name: 'word/styles.xml', data: xml(STYLES) },
    { name: 'docProps/core.xml', data: xml(coreXml(input, stamp)) },
    { name: 'docProps/app.xml', data: xml(APP_XML) },
  ]);
}
