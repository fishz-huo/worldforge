/**
 * 最小 ZIP 写入器（零第三方依赖）
 * ------------------------------------------------------------------
 * 用途：「导出为 Word」的 .docx 本质就是一个 ZIP 包（若干 XML 部件），
 * 而本仓库不允许引入 jszip / archiver 之类的依赖，浏览器端也没有现成的
 * 「写 ZIP」API，所以这里手写最小实现，只覆盖「写」这一半：
 * 本地文件头（0x04034b50）+ 中央目录（0x02014b50）+ EOCD（0x06054b50）。
 *
 * 为什么这样设计：
 *   1. 压缩优先走 Web 标准的 CompressionStream('deflate-raw')：ZIP 的 method 8
 *      要的正是「裸 deflate」流（不带 zlib 头），所以不能用 'deflate'。
 *      环境不支持、压缩抛错、或压完反而更大（很小的 XML 很常见）时退化成
 *      「存储」（method 0），文件变大但同样合法，Word / 资源管理器都能解开。
 *   2. CRC32 永远对**未压缩**的原始字节计算：解压方要用它校验还原后的数据。
 *   3. 分块拼接：每段头部与正文各自是独立的小 Uint8Array，最后一次性拷进结果
 *      缓冲区；避免「先拼成巨大字符串再转字节」那种既慢又可能截断中文的写法。
 *   4. 文件名按 UTF-8 编码，含非 ASCII（中文条目名）时置通用位标志 bit 11，
 *      否则 Windows 会按本地代码页解码成乱码。
 */

/** 版本号 20 = 2.0，表示「支持 deflate」的最低版本，写 Word 文档足够 */
const VERSION = 20;
/** 通用位标志 bit 11：置 1 表示文件名是 UTF-8 编码 */
const FLAG_UTF8 = 0x0800;
/** 压缩方法：0 = 存储（不压缩）、8 = deflate 裸流 */
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

/** CRC32 查表：第一次用到时才构建，避免模块加载时白算 256 项 */
let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  crcTable = table;
  return table;
}

/** CRC32（ZIP / PNG / gzip 通用的那个多项式），入参必须是未压缩的原始字节 */
export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 当前时间 → DOS 日期 / 时间两个 16 位字段。
 * 日期：年 - 1980（7 位）| 月（4 位，存 1-12）| 日（5 位）；
 * 时间：时（5 位）| 分（6 位）| 秒 / 2（5 位，DOS 精度只到 2 秒）。
 * 时间戳不影响文件能不能打开，但绝不能写出「月份 0」这类非法值，
 * 因此系统时间早于 1980 年时钳到 1980-01-01。
 */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getFullYear(), 1980);
  const month = Math.min(Math.max(date.getMonth() + 1, 1), 12);
  const day = Math.min(Math.max(date.getDate(), 1), 31);
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  return { time, date: (((year - 1980) & 0x7f) << 9) | (month << 5) | day };
}

/** 小端 16 位 */
function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

/** 小端 32 位 */
function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

/** 顺序拼接字节片段（分块 → 一次性拷贝，不产生中间字符串） */
function join(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * 尝试 deflate-raw 压缩。返回 null 表示「改用存储」：
 * 没有 CompressionStream、压缩过程抛错、或压完反而更大（小文件常见）。
 */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream !== 'function') return null;
  try {
    // TS 5.7 的 lib.dom 收紧了 BlobPart（Uint8Array<ArrayBufferLike> 不再直接兼容），
    // 与 src/lib/save-batch.ts 保持同一种写法。
    const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const packed = new Uint8Array(await new Response(stream).arrayBuffer());
    return packed.length < data.length ? packed : null;
  } catch {
    return null;
  }
}

/**
 * 打包成 ZIP。entries 的顺序即文件在包里的顺序
 * （调用方约定 [Content_Types].xml 放第一位，方便解析器先读到部件类型表）。
 */
export async function buildZip(entries: { name: string; data: Uint8Array }[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const raw = entry.data;
    const crc = crc32(raw);
    const packed = await deflateRaw(raw);
    const method = packed ? METHOD_DEFLATE : METHOD_STORE;
    const body = packed ?? raw;
    const flags = /[^\x00-\x7f]/.test(entry.name) ? FLAG_UTF8 : 0;

    // 本地文件头：30 字节定长 + 文件名（无 extra、无注释、不需要数据描述符）
    chunks.push(join([
      u32(0x04034b50), u16(VERSION), u16(flags), u16(method), u16(time), u16(date),
      u32(crc), u32(body.length), u32(raw.length), u16(nameBytes.length), u16(0), nameBytes,
    ]));
    chunks.push(body);
    // 中央目录项：46 字节定长 + 文件名，字段与本地头一致，另存本地头相对偏移
    central.push(join([
      u32(0x02014b50), u16(VERSION), u16(VERSION), u16(flags), u16(method), u16(time), u16(date),
      u32(crc), u32(body.length), u32(raw.length), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]));
    offset += 30 + nameBytes.length + body.length;
  }

  // EOCD：单磁盘、无注释；两个条目数相同（不分卷）
  const centralBytes = join(central);
  chunks.push(centralBytes, join([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBytes.length), u32(offset), u16(0),
  ]));
  return join(chunks);
}
