/**
 * v0.2.1 两个修复的验证（纯界面路径，不依赖开发钩子）
 * ==================================================================
 * v0.2.1 的 main.tsx 还没挂 window.__wf，所以全部走界面。
 *
 * **必须把范围限定在时间轴画布里**：左边栏也有一个时间轴的迷你预览
 * （同样是 svg/polyline 和条目按钮），用全局 querySelector 会量到那一份，
 * 得到"6 个顶点 0 段线"这种假结论、以及点不中的 16px 宽按钮。
 *
 * 用法：node scripts/ui-v021-probe.mjs   （需要 dev server + 9222 的 Chrome）
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { openPage, sleep, waitForCdp } from './cdp.mjs';

const BASE = process.env.WF_URL ?? 'http://localhost:5174/';
const OUT = '.probe';

/** v0.2.1 的 cdp.mjs 只有 openPage，pointer 交互在这里自己发 */
async function clickPointer(page, at) {
  const base = { button: 'left', buttons: 1, pointerType: 'mouse' };
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y, ...base, buttons: 0 });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, ...base, clickCount: 1 });
  await sleep(20);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, ...base, buttons: 0, clickCount: 1 });
}

const READY = `
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    const labels = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
    if (labels.includes('时间轴') && labels.includes('设置')) return 'ready';
    const t = Date.now(); while (Date.now() - t < 50);
  }
  return 'timeout';
`;

const OPEN_TIMELINE = `
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '时间轴');
  if (!btn) return 'no-button';
  btn.click();
  return 'ok';
`;

/**
 * 时间轴画布 = 页面上最大的那个横向滚动容器。
 * 注意：**不能把 DOM 元素 evaluate 出来**（"Object reference chain is too long"），
 * 所以这里只返回一个"找它"的函数文本，在每个 evaluate 里就地用。
 */
const CANVAS_FN = `
  const findCanvas = () => [...document.querySelectorAll('div')]
    .filter((d) => /overflow-auto/.test(String(d.className)))
    .sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    })[0] || null;
`;

/** 量画布里的折线：顶点两两关系 + 圆点个数 */
const MEASURE_LINE = `
  ${CANVAS_FN}
  const canvas = findCanvas();
  if (!canvas) return { error: '找不到时间轴画布' };
  const pls = [...canvas.querySelectorAll('svg polyline')];
  if (!pls.length) return { error: '画布里没有折线（这个世界观可能没有数值型泳道）' };
  return pls.map((pl) => {
    const raw = (pl.getAttribute('points') || '').trim();
    const pts = raw ? raw.split(/\\s+/).map((p) => p.split(',').map(Number)) : [];
    const dots = pl.closest('svg').querySelectorAll('circle').length;
    let flat = 0, vert = 0, diag = 0, bad = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = Math.abs(pts[i][0] - pts[i - 1][0]);
      const dy = Math.abs(pts[i][1] - pts[i - 1][1]);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) { bad++; continue; }
      if (dy < 0.01 && dx >= 0.01) flat++;
      else if (dx < 0.01 && dy >= 0.01) vert++;
      else if (dx >= 0.01 && dy >= 0.01) diag++;
    }
    return { n: pts.length, flat, vert, diag, bad, dots, pts: pts.slice(0, 8) };
  });
`;

/** 检查器是哪个面板：取最后一个 aside 的标题行 */
const INSPECTOR = `
  const asides = [...document.querySelectorAll('aside')];
  const last = asides[asides.length - 1];
  if (!last) return null;
  const head = last.querySelector('header');
  return head ? head.textContent.trim().slice(0, 12) : last.textContent.trim().slice(0, 12);
`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  await waitForCdp();
  const page = await openPage(BASE);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 640, deviceScaleFactor: 1, mobile: false });
  await sleep(3500);
  console.log('app:', await page.evaluate(READY));
  console.log('打开时间轴：', await page.evaluate(OPEN_TIMELINE));
  await sleep(1200);

  const lines = await page.evaluate(MEASURE_LINE);
  if (lines.error) {
    console.log('折线：', lines.error);
  } else {
    lines.forEach((l, i) => {
      console.log(`折线 #${i + 1}：${l.n} 个顶点 → 水平 ${l.flat}、竖直 ${l.vert}、斜线 ${l.diag}、无效 ${l.bad}；圆点 ${l.dots}`);
      console.log(`          前几个顶点：${JSON.stringify(l.pts)}`);
      console.log(`          判定：${l.diag === 0 && l.bad === 0 && l.n > 1 ? '✓ 全是直角阶梯' : '✗ 有斜线或坏点'}`);
    });
  }

  const shot0 = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/v021-lines.png`, Buffer.from(shot0.data, 'base64'));

  console.log(`检查器（初始）：${await page.evaluate(INSPECTOR)}`);
  const target = await page.evaluate(`
    ${CANVAS_FN}
    const canvas = findCanvas();
    if (!canvas) return { error: '找不到时间轴画布' };
    const b = [...canvas.querySelectorAll('button[title*="拖动平移"]')]
      .find((x) => x.getBoundingClientRect().width > 30);
    if (!b) return { error: '画布里没有可点的条目按钮' };
    const r = b.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(x, y);
    return { x, y, w: Math.round(r.width), title: b.title.split('\\n')[0],
             hit: hit ? hit.tagName + '.' + String(hit.className).split(' ')[0] : null,
             hitIsButton: !!(hit && (hit === b || b.contains(hit))) };
  `);
  if (target.error || !target.hitIsButton) {
    console.log('条目按钮点不到：', JSON.stringify(target));
  } else {
    console.log(`条目按钮：${target.title}（${target.w}px 宽，命中 ${target.hit}）`);
    await clickPointer(page, { x: target.x, y: target.y });
    await sleep(500);
    const afterClick = await page.evaluate(INSPECTOR);
    const blank = await page.evaluate(`
      ${CANVAS_FN}
      const canvas = findCanvas();
      const b = [...canvas.querySelectorAll('button[title*="拖动平移"]')]
        .find((x) => x.getBoundingClientRect().width > 30);
      const host = b.closest('div[style*="width"]');
      const r = host.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      // 找一条**左端附近真的没有条目按钮**的泳道（第一条泳道的条目最多，
      // 往往从最左边就开始，点到它就等于又选中了一次）
      const hosts = [...canvas.querySelectorAll('div[style*="width"]')]
        .filter((d) => d.getBoundingClientRect().height > 30 && d.getBoundingClientRect().width > 100);
      for (const host of hosts) {
        const r = host.getBoundingClientRect();
        const startX = Math.max(r.left, cr.left);
        for (const dy of [r.height - 6, r.height / 2, 6]) {
          // 从泳道左端往右逐步试：可滚区域的左端被 sticky 名称列盖着，
          // 必须落到名称列**右边**才是真正的泳道空白
          for (let step = 8; step <= 200; step += 24) {
            const x = Math.round(startX + step);
            const y = Math.round(r.top + dy);
            const hit = document.elementFromPoint(x, y);
            if (hit && host.contains(hit) && !hit.closest('button[title*="拖动平移"]') && !hit.closest('[class*="sticky"]')) {
              return { x, y, laneLeft: Math.round(r.left), canvasLeft: Math.round(cr.left),
                       hit: hit.tagName + '.' + String(hit.className).split(' ')[0],
                       inLane: true, onEntry: false };
            }
          }
        }
      }
      return { error: '这条时间轴上找不到空白处（条目铺满了）' };
    `);
    if (blank.error) {
      console.log('找不到空白落点：', blank.error);
    } else {
      await clickPointer(page, blank);
      await sleep(500);
      const afterBlank = await page.evaluate(INSPECTOR);
      console.log(`点条目「${target.title}」→ 检查器：${afterClick}`);
      console.log(`点泳道空白 → 检查器：${afterBlank}`);
      console.log(`     落点 (${blank.x},${blank.y})：泳道左端 ${blank.laneLeft}、画布左端 ${blank.canvasLeft}，命中 ${blank.hit}`
        + `（在泳道里 ${blank.inLane ? '✓' : '✗'}，落在条目上 ${blank.onEntry ? '✗ 是' : '✓ 否'}）`);
      console.log(`判定：${String(afterClick).includes('时间轴条目') && String(afterBlank).includes('时刻快照') ? '✓ 选中与取消都正常' : '✗ 有一处不对'}`);
    }
    const shot1 = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/v021-after.png`, Buffer.from(shot1.data, 'base64'));
  }

  page.close();
  process.exit(0);
}

main().catch((e) => { console.error('验证失败：', e.message); process.exit(1); });
