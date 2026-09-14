/**
 * 校验 Markdown 文档里的内部锚点（`](#xxx)` 能不能对上某个标题）
 * ==================================================================
 * GitHub 的锚点规则：标题转小写 → 去掉标点 → 空格换成连字符。
 * 中文标题同样适用（汉字保留）。
 *
 * 用法：node scripts/md-anchor-check.mjs <文件…>   不给参数就查全部 docs/*.md 与 README.md
 */
import { readFileSync, readdirSync } from 'node:fs';

const slug = (h) => h.trim().toLowerCase()
  .replace(/[^\p{L}\p{N}\s-]/gu, '')
  .replace(/\s+/g, '-');

const files = process.argv.slice(2);
const targets = files.length
  ? files
  : ['README.md', ...readdirSync('docs').filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)];

let bad = 0;
for (const file of targets) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    console.log(`跳过（读不到）：${file}`);
    continue;
  }
  const heads = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1]));
  const links = [...text.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
  const missing = [...new Set(links)].filter((a) => !heads.includes(a));
  if (missing.length) {
    bad += missing.length;
    console.log(`✗ ${file}：${missing.length} 个锚点对不上`);
    missing.forEach((m) => console.log(`    #${m}`));
  } else {
    console.log(`✓ ${file}：${links.length} 个内部链接全部有效`);
  }
}
process.exit(bad ? 1 : 0);
