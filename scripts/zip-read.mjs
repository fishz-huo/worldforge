/**
 * 自测辅助：最小 ZIP 解析器（只读）
 * ------------------------------------------------------------------
 * zip.ts 与 docx.ts 的自测都要「把自己的产物反向读出来」：没有第三方库可用，
 * 也不该为了自测去装依赖，所以手写这一份最小解析器 —— EOCD → 中央目录 →
 * 本地文件头 → 数据。写入器只要写错签名、偏移、长度或 CRC，这里就会读失败或对不上。
 *
 * 单独成文件是为了让两个自测脚本都能 import，而不会因为 import 另一个测试脚本
 * 把对方的用例重复跑一遍（finish() 会 process.exit）。
 */

/** 各签名（小端序读出来就是这个数） */
export const SIG = { local: 0x04034b50, central: 0x02014b50, eocd: 0x06054b50 };

/** 文本 → UTF-8 字节 / 字节 → 文本 / 深比较用（丢掉值为 undefined 的字段） */
export const enc = (text) => new TextEncoder().encode(text);
export const dec = (bytes) => new TextDecoder().decode(bytes);
export const json = (value) => JSON.parse(JSON.stringify(value));

/** 解析 ZIP：返回 { name, flags, method, time, date, crc, csize, usize, data }[] */
export async function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === SIG.eocd) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('找不到 EOCD：产物不是合法 ZIP');
  const total = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (cdOffset + cdSize !== eocd) throw new Error('中央目录没有紧贴 EOCD，偏移写错了');
  const entries = [];
  let at = cdOffset;
  for (let n = 0; n < total; n += 1) {
    if (view.getUint32(at, true) !== SIG.central) throw new Error(`第 ${n} 个中央目录项签名不对`);
    const nameLen = view.getUint16(at + 28, true);
    const csize = view.getUint32(at + 20, true);
    const localAt = view.getUint32(at + 42, true);
    const name = dec(bytes.subarray(at + 46, at + 46 + nameLen));
    if (view.getUint32(localAt, true) !== SIG.local) throw new Error(`${name}：本地文件头签名不对`);
    const start = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    entries.push({
      name, localAt, start,
      flags: view.getUint16(at + 8, true), method: view.getUint16(at + 10, true),
      time: view.getUint16(at + 12, true), date: view.getUint16(at + 14, true),
      crc: view.getUint32(at + 16, true), csize, usize: view.getUint32(at + 24, true),
      data: bytes.subarray(start, start + csize),
    });
    at += 46 + nameLen + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return entries;
}

/** 取出条目内容：method 0 直接就是原文，method 8 走 DecompressionStream('deflate-raw') 还原 */
export async function inflate(entry) {
  if (entry.method === 0) return entry.data;
  if (entry.method !== 8) throw new Error(`${entry.name}：不认识的压缩方法 ${entry.method}`);
  const stream = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 按名字取部件文本（docx 自测用） */
export async function partText(entries, name) {
  const entry = entries.find((item) => item.name === name);
  if (!entry) throw new Error(`产物里没有 ${name}`);
  return dec(await inflate(entry));
}
