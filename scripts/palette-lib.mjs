/**
 * 配色表读取 + WCAG 数学（共用小库）
 * ------------------------------------------------------------------
 * 被 scripts/theme-selftest.mjs（语法着色）与 scripts/theme-cases.mjs
 * （深海配色补全）共用。拆出来的原因只有一个：两个使用方都各自顶到
 * 200 行红线（源码规范），把这段共用管道独立出来才装得下。
 */
import { readFileSync } from 'node:fs';
import { assert } from './test-runner.mjs';

/** 读仓库里的源文件（相对仓库根目录） */
export const read = (p) => readFileSync(p, 'utf8');

export const layerSrc = read('src/components/common/MarkdownHighlightLayer.tsx');

/** 从渲染层源码里抠出 TONE / LINE_TONE 这类配色表 */
export const table = (name) => {
  const hit = new RegExp(`const\\s+${name}\\s*:[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(layerSrc);
  assert.ok(hit, `渲染层里没找到 ${name}`);
  return Object.fromEntries([...hit[1].matchAll(/(\w+):\s*'([^']*)'/g)].map((m) => [m[1], m[2]]));
};

/** 'text-[#437396] dark:text-[#7DA8D0]' → ['#437396', '#7DA8D0'] */
export const pair = (cls) => (/^text-\[(#[0-9A-F]{6})\] dark:text-\[(#[0-9A-F]{6})\]$/.exec(cls) ?? []).slice(1);

export const TONE = table('TONE');
export const LINE_TONE = table('LINE_TONE');
export const TONE_ALL = { ...TONE, lineUl: LINE_TONE.ul, lineOl: LINE_TONE.ol };

/** 语法着色定稿值：['亮', '暗']；以后改色必须同步改这里（这一组就是 golden） */
export const WANT = {
  heading: ['#437396', '#7DA8D0'], marker: ['#5C6C99', '#98A8C8'],
  bold: ['#B25555', '#E09696'], italic: ['#8E5C7B', '#C89CB8'],
  lineUl: ['#5C6C99', '#98A8C8'], lineOl: ['#5C6C99', '#98A8C8'],
};

const chan = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** HSL('205 45% 7%') → [h, s, l] 三个数字 */
export const hslParts = (v) => v.split(/\s+/).map((x) => parseFloat(x));

/** HSL 分量 → 0~1 的 sRGB 三分量 */
function hslRgb(value) {
  const [h, s0, l0] = hslParts(value);
  const s = s0 / 100;
  const l = l0 / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** 相对亮度：既认 '#RRGGBB'（语法着色），也认 '205 45% 7%'（主题变量） */
const lum = (value) => {
  const rgb = value.startsWith('#')
    ? [0, 2, 4].map((i) => parseInt(value.slice(i + 1, i + 3), 16) / 255)
    : hslRgb(value);
  return rgb.reduce((sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i] * chan(c), 0);
};

/** WCAG 对比度（谁亮谁暗都行，内部先排序） */
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
