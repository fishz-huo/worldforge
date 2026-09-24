/**
 * 自测（二十九）：地图导出的范围数学与 SVG 拼装
 * ------------------------------------------------------------------
 * 用法：node scripts/map-export-selftest.mjs
 *
 * 为什么这一层必须有自测：导出的坐标与倍数算错了**不会报错**，只会得到一张
 * 「看着差不多、但尺寸不对/元素偏了/文字变乱码」的图 —— 而且这类错只有把图存下来
 * 逐像素比对才看得出来（浏览器实测做一遍成本很高）。所以把纯函数抽出来逐条验：
 *   1 范围与折算（可见区在世界坐标里的矩形、屏幕↔世界的折算比 s）；
 *   2 倍数夹取（canvas 上限、降级后实际用几倍）；
 *   3 SVG 拼装（输出像素尺寸、世界像素坐标、屏幕空间尺寸 ÷s、转义、缺底图/缺图标）。
 * 图片能不能真的画出来、toBlob 会不会返回 null，属于浏览器那一半，由实测覆盖。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const R = await import('@/features/map/mapExportRect.ts');
const S = await import('@/features/map/mapExportSvg.ts');

/** 世界 1600×1200、屏幕上每世界像素 0.5 CSS 像素、原点在屏幕 (100,50) 的一台"相机" */
const WORLD = { w: 1600, h: 1200 };
const cam = (s, ox, oy) => (nx, ny) => [ox + nx * WORLD.w * s, oy + ny * WORLD.h * s];
const GLYPH = { viewBox: '0 0 24 24', attrs: ' fill="none" stroke="currentColor"', inner: '<path d="M1 1" />' };

group('范围与折算');

await test('折算比 s：由 toScreenPixel 反推（1 世界像素 = 几个 CSS 像素）', () => {
  assert.equal(R.screenScale(WORLD, cam(0.5, 0, 0)), 0.5);
  assert.equal(R.screenScale(WORLD, cam(2, -30, -40)), 2);
});

await test('折算比异常时兜底成 1（视口还没量到尺寸，s 会是 0）', () => {
  assert.equal(R.screenScale(WORLD, () => [0, 0]), 1);
  assert.equal(R.screenScale(WORLD, () => [Number.NaN, 0]), 1);
});

await test('当前视口：导出矩形 = 可见区在世界坐标里的范围（允许为负、允许超出底图）', () => {
  // 原点在屏幕 (100,50)、s=0.5 → 世界坐标 (0,0) 落在屏幕 (100,50)，
  // 于是可见区的左上角在世界坐标 (-200,-100)
  const rect = R.exportRect('viewport', WORLD, { w: 800, h: 600 }, cam(0.5, 100, 50));
  assert.deepEqual(rect, { x: -200, y: -100, w: 1600, h: 1200 });
});

await test('整张底图：忽略画布尺寸与相机，就是 (0,0,world)', () => {
  assert.deepEqual(R.exportRect('full', WORLD, { w: 800, h: 600 }, cam(3, 999, -999)), { x: 0, y: 0, w: 1600, h: 1200 });
});

await test('输出像素尺寸 = 矩形 × 倍数（四舍五入，最小 1 像素）', () => {
  assert.deepEqual(R.outputSize({ x: 0, y: 0, w: 801.5, h: 600.4 }, 2), { w: 1603, h: 1201 });
  assert.deepEqual(R.outputSize({ x: 0, y: 0, w: 0.2, h: 0.2 }, 1), { w: 1, h: 1 });
});

group('倍数夹取');

await test('小图不降级：2000×1500 图 3× = 6000×4500，桌面放得下', () => {
  const fit = R.fitScale({ x: 0, y: 0, w: 2000, h: 1500 }, 3, 'png', false);
  assert.equal(fit.scale, 3);
  assert.equal(fit.downgraded, false);
});

await test('单边超上限就降一档：3000×2000 的 3× = 9000 超过 8192 → 2×', () => {
  const fit = R.fitScale({ x: 0, y: 0, w: 3000, h: 2000 }, 3, 'png', false);
  assert.equal(fit.scale, 2);
  assert.equal(fit.downgraded, true);
});

await test('总面积超上限继续降：4096×4096 的 2× = 6700 万像素 → 降到 1×', () => {
  const fit = R.fitScale({ x: 0, y: 0, w: 4096, h: 4096 }, 3, 'png', false);
  assert.equal(fit.scale, 1);
  assert.equal(fit.downgraded, true);
});

await test('移动端壳上限更低：2000×1500 图 3× 被降到 2×（单边 4096）', () => {
  assert.equal(R.fitScale({ x: 0, y: 0, w: 2000, h: 1500 }, 3, 'png', true).scale, 2);
  assert.equal(R.fitScale({ x: 0, y: 0, w: 2000, h: 1500 }, 2, 'png', true).downgraded, false);
});

await test('SVG 不夹：矢量、名义尺寸不进内存，用户选 3× 就是 3×', () => {
  const fit = R.fitScale({ x: 0, y: 0, w: 20000, h: 20000 }, 3, 'svg', true);
  assert.equal(fit.scale, 3);
  assert.equal(fit.downgraded, false);
});

group('扩展名、MIME 与文件名');

await test('jpeg 的扩展名是 jpg；MIME 三个各自正确', () => {
  assert.equal(R.formatExt('jpeg'), 'jpg');
  assert.equal(R.formatExt('png'), 'png');
  assert.equal(R.formatMime('svg'), 'image/svg+xml');
  assert.equal(R.formatMime('jpeg'), 'image/jpeg');
  assert.equal(R.formatMime('png'), 'image/png');
});

await test('文件名：地图名 + 范围 + 倍数；非法字符换掉；空名回落 worldforge', () => {
  assert.equal(R.exportFileName('潮线之外', 'viewport', 2, 'png'), '潮线之外-视口-2x.png');
  assert.equal(R.exportFileName('a/b:c*', 'full', 1, 'svg'), 'a_b_c_-全图-1x.svg');
  assert.equal(R.exportFileName('   ', 'full', 3, 'jpeg'), 'worldforge-全图-3x.jpg');
});

group('SVG 拼装');

/** 一份最小的导出场景：800×600 世界、s=1、2× */
const scene = (over = {}) => ({
  rect: { x: 0, y: 0, w: 800, h: 600 },
  world: { w: 800, h: 600 },
  s: 1,
  k: 2,
  backdrop: null,
  regions: [],
  regionMode: 'fill',
  metric: 'population',
  maxValue: 100,
  showLabels: true,
  terrain: [],
  pins: [],
  pinGlyphs: {},
  terrainGlyphs: {},
  ...over,
});

const REGION = { id: 'r1', map_id: 'm1', layer_id: null, name: '盐仓', color: '#ef4444', points: [[0, 0], [1, 0], [1, 1], [0, 1]], resources: {}, period: '', note: '' };

await test('根元素：width/height = 矩形 × 倍数，viewBox = 世界像素矩形', () => {
  const svg = S.buildExportSvg(scene());
  assert.match(svg, /<svg [^>]*width="1600" height="1200" viewBox="0 0 800 600">/);
  assert.match(svg, /fill="#f5f4f0"/, '先铺画布底色');
});

await test('底图：内联 data: URL + preserveAspectRatio=none + 不透明度；没底图就不出 <image>', () => {
  const withBg = S.buildExportSvg(scene({ backdrop: { href: 'data:image/png;base64,AAA', opacity: 0.9 } }));
  assert.match(withBg, /<image [^>]*preserveAspectRatio="none" opacity="0.9"/);
  assert.match(withBg, /href="data:image\/png;base64,AAA"/);
  assert.ok(!S.buildExportSvg(scene()).includes('<image'), '没有底图时不应出现 <image>');
});

await test('区域：顶点换成世界像素坐标，填充/描边复用渲染层的口径', () => {
  const svg = S.buildExportSvg(scene({ regions: [REGION] }));
  assert.match(svg, /d="M 0 0 L 800 0 L 800 600 L 0 600 Z"/);
  assert.match(svg, /fill="#ef444459"/, '填充色 = 区域色 + 35% 透明度');
  assert.match(svg, /stroke-width="1"/, 's=1 时 1px 描边 = 1 世界像素');
});

await test('屏幕空间尺寸 ÷s：s=2 时图钉半径 6、图标 7、描边 0.75 世界像素', () => {
  const pin = { id: 'p1', map_id: 'm1', card_id: null, layer_id: null, x: 0.5, y: 0.5, label: '', icon: 'city', color: '#334155', note: '' };
  const svg = S.buildExportSvg(scene({ s: 2, pins: [pin], pinGlyphs: { p1: GLYPH } }));
  assert.match(svg, /<circle cx="400" cy="300" r="6" fill="#ffffff" stroke="#334155" stroke-width="0.75"/);
  assert.match(svg, /<svg x="396.5" y="296.5" width="7" height="7" viewBox="0 0 24 24"/, '图标 14 ÷ 2 = 7，居中');
});

await test('地形：世界宽的 6% × size、绕中心旋转（与屏幕上同一套 transform）', () => {
  const pin = {
    id: 't1', map_id: 'm1', card_id: null, layer_id: null, x: 0.5, y: 0.5,
    label: '山脉', icon: 'mountain', color: '#334155', note: '',
    meta: { kind: 'terrain', symbol: 'mountain', size: 1.5, rotation: 90 },
  };
  const svg = S.buildExportSvg(scene({ terrain: [pin], terrainGlyphs: { t1: GLYPH } }));
  assert.match(svg, /transform="translate\(400 300\) rotate\(90\) translate\(-36 -36\)"/, '6% × 800 × 1.5 = 72，居中偏移 36');
  assert.match(svg, /width="72" height="72"/);
});

await test('不是地形的行混进地形数组时跳过（手改过的 JSON 不该画出怪物）', () => {
  const stray = { id: 'p9', map_id: 'm1', card_id: null, layer_id: null, x: 0.5, y: 0.5, label: '', icon: '', color: '#000', note: '' };
  const svg = S.buildExportSvg(scene({ terrain: [stray], terrainGlyphs: { p9: GLYPH } }));
  assert.ok(!svg.includes('<g transform='), '没有 meta 的行不画');
});

await test('标签：图钉名与区域名都画，且 XML 转义（否则整份 SVG 非法、整张图导不出来）', () => {
  const pin = { id: 'p1', map_id: 'm1', card_id: null, layer_id: null, x: 0.25, y: 0.5, label: 'A & B <x>', icon: 'city', color: '#334155', note: '' };
  const svg = S.buildExportSvg(scene({ pins: [pin], regions: [REGION] }));
  assert.match(svg, /A &amp; B &lt;x&gt;/);
  assert.match(svg, />盐仓</, '区域名用重心位置');
  assert.ok(!S.buildExportSvg(scene({ pins: [pin], showLabels: false })).includes('A &amp;'), '关掉标签就不画');
});

await test('区域没有名字就不画它的标签', () => {
  const svg = S.buildExportSvg(scene({ regions: [{ ...REGION, name: '' }] }));
  assert.ok(!svg.includes('<text'), '空名字不该出现空标签');
});

await test('缺图标时只是少画那个图标，其余照旧（缺了几个由调用方在状态行里说）', () => {
  const pin = { id: 'p1', map_id: 'm1', card_id: null, layer_id: null, x: 0.5, y: 0.5, label: '', icon: 'city', color: '#334155', note: '' };
  const svg = S.buildExportSvg(scene({ pins: [pin] }));
  assert.match(svg, /<circle /, '圆底照画');
  assert.ok(!svg.includes('viewBox="0 0 24 24"'), '没取到图标就不嵌 svg');
});

await test('区域名标签用屏幕像素 ÷s 的字号，且带描边光晕（没有 text-shadow 可用）', () => {
  const svg = S.buildExportSvg(scene({ s: 2, regions: [REGION] }));
  assert.match(svg, /font-size="5.5"/, '11 ÷ 2');
  assert.match(svg, /paint-order="stroke"/);
});

finish('地图导出');
