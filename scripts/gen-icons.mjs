/**
 * 图标生成脚本（零依赖）
 * ------------------------------------------------------------------
 * 用 Node 内置 zlib 手写 PNG 编码，生成：
 *   - public/icons/*.png         PWA 图标（192 / 512 / maskable）
 *   - public/apple-touch-icon.png
 *   - src-tauri/icons/*.png      Tauri 打包图标
 *   - src-tauri/icons/icon.ico   Windows 图标（内嵌 PNG，Vista+ 支持）
 * 这样仓库里不需要提交二进制素材，`npm run icons` 一条命令就能全部重建。
 *
 * 图形：深色圆角底 + 三层「世界环」+ 中心星点，呼应「世界观」主题。
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------ PNG 编码 ------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 组装一个 PNG 数据块 */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** RGBA 像素数组 → PNG Buffer */
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------ 绘制 ------------------------------ */

/** 画一个图标并返回 RGBA Buffer */
function drawIcon(size, { padding = 0.12, background = true } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - size * padding;
  const put = (x, y, [rr, gg, bb], alpha = 1) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const a = alpha;
    buf[i] = Math.round(buf[i] * (1 - a) + rr * a);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + gg * a);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + bb * a);
    buf[i + 3] = Math.max(buf[i + 3], Math.round(255 * a));
  };

  const BG = [17, 24, 39];
  const RING1 = [139, 92, 246];
  const RING2 = [14, 165, 233];
  const STAR = [250, 204, 21];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 圆角方形底
      const corner = Math.max(Math.abs(dx), Math.abs(dy));
      const edge = size / 2 - size * 0.02;
      if (background && corner <= edge) {
        const soft = Math.min(1, Math.max(0, (edge - corner) / 1.5));
        put(x, y, BG, soft);
      }
      // 外环
      if (Math.abs(dist - r * 0.92) < size * 0.035) put(x, y, RING1, 0.95);
      // 中环（椭圆，表现「轨道」）
      const ox = dx / (r * 0.72);
      const oy = dy / (r * 0.36);
      const od = Math.sqrt(ox * ox + oy * oy);
      if (Math.abs(od - 1) < 0.09) put(x, y, RING2, 0.9);
      // 中心恒星
      if (dist < r * 0.22) put(x, y, STAR, 0.95);
      if (dist < r * 0.12) put(x, y, [255, 255, 255], 0.9);
    }
  }
  return buf;
}

/* ------------------------------ ICO 封装 ------------------------------ */

/** 把若干 PNG 打包成 ICO（Vista 以后支持 PNG 载荷） */
function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach((entry, i) => {
    const base = i * 16;
    dir[base] = entry.size >= 256 ? 0 : entry.size;
    dir[base + 1] = entry.size >= 256 ? 0 : entry.size;
    dir[base + 2] = 0;
    dir[base + 3] = 0;
    dir.writeUInt16LE(1, base + 4);
    dir.writeUInt16LE(32, base + 6);
    dir.writeUInt32LE(entry.png.length, base + 8);
    dir.writeUInt32LE(offset, base + 12);
    offset += entry.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

/* ------------------------------ 输出 ------------------------------ */

const targets = [
  { path: 'public/icons/icon-192.png', size: 192 },
  { path: 'public/icons/icon-512.png', size: 512 },
  { path: 'public/icons/maskable-512.png', size: 512, padding: 0.22 },
  { path: 'public/apple-touch-icon.png', size: 180 },
  { path: 'src-tauri/icons/32x32.png', size: 32 },
  { path: 'src-tauri/icons/128x128.png', size: 128 },
  { path: 'src-tauri/icons/128x128@2x.png', size: 256 },
  { path: 'src-tauri/icons/icon.png', size: 512 },
];

targets.forEach(({ path, size, padding }) => {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(size, size, drawIcon(size, { padding })));
  console.log('生成', path, `${size}×${size}`);
});

// Windows ICO：多尺寸内嵌
const icoEntries = [16, 32, 48, 64, 128, 256].map((size) => ({
  size,
  png: encodePng(size, size, drawIcon(size)),
}));
const icoPath = join(root, 'src-tauri/icons/icon.ico');
mkdirSync(dirname(icoPath), { recursive: true });
writeFileSync(icoPath, encodeIco(icoEntries));
console.log('生成 src-tauri/icons/icon.ico（多尺寸）');
