/**
 * 自测（九）：ZIP 写入器
 * ------------------------------------------------------------------
 * 用法：node scripts/export-zip-test.mjs
 *
 * 校验 src/lib/export/zip.ts：CRC32 的已知向量，以及手写 ZIP 写入器的产物结构。
 * 没有第三方库可以拿来做参照，所以用 scripts/zip-read.mjs 里的最小解析器把产物
 * 反向读一遍：EOCD 定位、条目数量与名字、每个条目的 CRC、压缩/未压缩大小、
 * 解压后的字节必须与原文完全一致（压缩分支额外走一次 DecompressionStream 往返）。
 *
 * 配套的 Word 侧自测见 scripts/export-docx-test.mjs。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';
import { enc, inflate, readZip } from './zip-read.mjs';

register('./alias-hook.mjs', import.meta.url);
const { crc32, buildZip } = await import('@/lib/export/zip.ts');

group('CRC32');
await test('已知向量：123456789 → 0xCBF43926，a → 0xE8B7BE43，空串 → 0', () => {
  assert.equal(crc32(enc('123456789')), 0xcbf43926);
  assert.equal(crc32(enc('a')), 0xe8b7be43);
  assert.equal(crc32(enc('')), 0);
});

group('ZIP 写入器');
await test('产物能被自带解析器读出：条目顺序 / 名字 / 长度 / CRC / 解压字节全部一致', async () => {
  const files = [
    { name: 'word/document.xml', data: enc('<w:p>重复内容重复内容重复内容</w:p>'.repeat(20)) },
    { name: 'docProps/中文部件.xml', data: enc('<x>中文名称</x>') },
  ];
  const entries = await readZip(await buildZip(files));
  assert.deepEqual(entries.map((entry) => entry.name), files.map((file) => file.name));
  for (let i = 0; i < files.length; i += 1) {
    const raw = await inflate(entries[i]);
    assert.equal(entries[i].usize, files[i].data.length, '原始大小字段不对');
    assert.equal(entries[i].csize, entries[i].data.length, '压缩后大小字段不对');
    assert.equal(entries[i].crc, crc32(files[i].data), 'CRC 必须对未压缩数据计算');
    assert.equal(crc32(raw), entries[i].crc, '解压后 CRC 对不上');
    assert.equal(Buffer.compare(Buffer.from(raw), Buffer.from(files[i].data)), 0, `${entries[i].name} 内容不一致`);
  }
  // 非 ASCII 文件名必须置 UTF-8 标志位（bit 11），否则 Windows 会按本地代码页解成乱码
  assert.equal(entries[1].flags & 0x0800, 0x0800, '中文条目名没有置 bit 11');
  assert.equal(entries[0].flags & 0x0800, 0, '纯 ASCII 名字不该置 UTF-8 标志位');
});

await test('压缩分支：支持 CompressionStream 用 method 8，否则退化存储 method 0', async () => {
  const big = enc('云中界'.repeat(200));
  const [entry] = await readZip(await buildZip([{ name: 'a.txt', data: big }]));
  if (typeof CompressionStream === 'function') {
    assert.equal(entry.method, 8, '有 CompressionStream 却没走压缩分支');
    assert.ok(entry.csize < big.length, '压缩后反而没有变小');
  } else {
    assert.equal(entry.method, 0, '没有 CompressionStream 时必须走存储分支');
    assert.equal(entry.csize, big.length);
  }
  assert.equal(Buffer.compare(Buffer.from(await inflate(entry)), Buffer.from(big)), 0);
});

await test('压缩没有收益的小条目退回存储（method 0 同样是合法 ZIP）', async () => {
  const tiny = enc('<x/>');
  const [entry] = await readZip(await buildZip([{ name: 'tiny.xml', data: tiny }]));
  assert.equal(entry.method, 0);
  assert.equal(Buffer.compare(Buffer.from(await inflate(entry)), Buffer.from(tiny)), 0);
});

await test('头部字段合法：版本 20 / 无 extra 无注释 / DOS 时间月份 1-12、年份 ≥ 1980', async () => {
  const [entry] = await readZip(await buildZip([{ name: 'a.txt', data: enc('a') }]));
  const month = (entry.date >> 5) & 0xf;
  assert.ok(month >= 1 && month <= 12, `月份非法：${month}`);
  assert.ok((entry.date & 0x1f) >= 1, '日期非法');
  assert.ok((entry.date >> 9) + 1980 >= 1980, '年份非法');
  assert.ok((entry.time & 0x1f) * 2 <= 59, '秒非法');
  // 本地头与中央目录项之间不留 extra，长度正好是 30 + 名字
  assert.equal(entry.start, entry.localAt + 30 + Buffer.byteLength(entry.name, 'utf8'));
});

finish('ZIP 写入器');
