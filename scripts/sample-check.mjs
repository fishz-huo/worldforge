/**
 * 测试世界观数据自测
 * ------------------------------------------------------------------
 * 四件事，全部用真实代码而不是"照着文档猜"：
 *   1. 结构校验：字段名 / 下拉取值 / id 引用 / 数值约束（见 sample-lint.mjs，
 *      它直接读 src/types/card-types.ts 的 FieldDef）；
 *   2. 手册与备份一致性：手册里声明的每一种数量都必须等于备份里的实际数量；
 *   3. 真实导入：把备份喂给 lib/backup.ts 的 importBackup()，
 *      走一遍真实的事务写库，再读回内存态核对数量；
 *   4. 过期检查：手册改过但没重新生成备份时直接报错。
 *
 * 用法：node scripts/make-sample.mjs && node scripts/sample-check.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { splitTopSections } from './sample-text.mjs';
import { parseCards, parseTags, parseRelations } from './sample-cards.mjs';
import { parseTimeline } from './sample-scene.mjs';
import { createReporter, lintCards, lintSnapshot } from './sample-lint.mjs';
import { db, state } from './db-harness.mjs';

const ROOT = process.cwd();
const TXT = join(ROOT, 'docs', '猫猫的冒险·世界观设定.txt');
const JSON_FILE = join(ROOT, 'samples', '猫猫的冒险.worldforge.json');
const TEXT = readFileSync(TXT, 'utf8');
const texts = splitTopSections(TEXT);
const { state: report, check, warn } = createReporter();

const { BUILTIN_CARD_TYPE_MAP } = await import('@/types/card-types.ts');
const { parseBackup, importBackup } = await import('@/lib/backup.ts');

/* --------------------------- 1. 结构校验 --------------------------- */
const cards = parseCards(texts['三、卡片']);
lintCards(cards, BUILTIN_CARD_TYPE_MAP, { check, warn });

const backup = parseBackup(readFileSync(JSON_FILE, 'utf8'));
check('备份能被 parseBackup 解析', backup !== null);
const snap = backup.snapshot;
const { titles } = lintSnapshot(snap, { check, warn });
void titles;

/* ---------------------- 2. 手册与备份一致性 ---------------------- */
/** 读【标题】之后几行里的「名称 数量」清单（例如【快速核对清单】） */
function countsIn(label) {
  const lines = TEXT.split('\n');
  const at = lines.findIndex((l) => l.startsWith(label));
  const out = {};
  if (at < 0) return out;
  lines.slice(at, at + 5).join('  ').split(/\s{2,}/).forEach((pair) => {
    const m = /^(\S+)\s+(\d+)$/.exec(pair.trim());
    if (m) out[m[1]] = Number(m[2]);
  });
  return out;
}
/** 行内「名称 数字」取数；只在该小节里找，避免命中别处的同名文字 */
function numberAfter(sectionName, label) {
  const hit = new RegExp(`${label}\\s+(\\d+)`).exec(texts[sectionName] ?? '');
  return hit ? Number(hit[1]) : null;
}
/** 手册开头声明的总量（那段说明横跨三行，拼起来解析） */
function headCounts() {
  const lines = TEXT.split('\n');
  const at = lines.findIndex((l) => l.includes('拆成了'));
  const line = at >= 0 ? lines.slice(at + 1, at + 4).join(' ') : '';
  const out = {};
  [...line.matchAll(/(\d+)\s*([\u4e00-\u9fa5]+)/g)].forEach((m) => {
    const key = m[2].replace(/^(张|个|条|篇|片)+/, '');
    if (!(key in out)) out[key] = Number(m[1]);
  });
  return out;
}
const head = headCounts();
/** 手册里 [三·N 类型（type）· N 张] 声明的张数（它在卡片分组标题里，不在顶层小节内） */
function cardSectionCount(label) {
  const hit = new RegExp(`\\[三·\\d+\\s*${label}[^\\]]*?·\\s*(\\d+)\\s*张\\]`).exec(TEXT);
  return hit ? Number(hit[1]) : null;
}

const actualByType = snap.cards.reduce((acc, c) => {
  const label = BUILTIN_CARD_TYPE_MAP[c.type].label;
  acc[label] = (acc[label] ?? 0) + 1;
  return acc;
}, {});
Object.entries(actualByType).forEach(([label, n]) => {
  check(`手册声明的小节数量正确（${label}）`, cardSectionCount(label) === n,
    `手册写 ${cardSectionCount(label)}，实际 ${n}`);
});

const { tags: tagDefs, map: tagMapFromText } = parseTags(texts['四、标签']);
check('手册声明的卡片总数正确', head['卡片'] === snap.cards.length, `手册 ${head['卡片']}，实际 ${snap.cards.length}`);
check('手册声明的标签数正确', head['标签'] === snap.tags.length);
check('手册声明的关联数正确', head['关联'] === snap.relations.length);
check('手册声明的地图/标记点/区域数正确',
  head['地图'] === snap.maps.length && head['标记点'] === snap.pins.length && head['多边形区域'] === snap.regions.length,
  `手册 ${head['地图']}/${head['标记点']}/${head['多边形区域']}，实际 ${snap.maps.length}/${snap.pins.length}/${snap.regions.length}`);
check('手册声明的泳道/条目/纪元数正确',
  head['时间轴泳道'] === snap.tracks.length
  && head['时间轴条目'] === snap.entries.length
  && head['纪元'] === snap.eras.length,
  `手册 ${head['时间轴泳道']}/${head['时间轴条目']}/${head['纪元']}，实际 ${snap.tracks.length}/${snap.entries.length}/${snap.eras.length}`);
check('手册声明的文稿/大纲节点数正确',
  head['文稿'] === snap.docs.length && head['大纲节点'] === snap.outlineNodes.length,
  `手册 ${head['文稿']}/${head['大纲节点']}，实际 ${snap.docs.length}/${snap.outlineNodes.length}`);
check('手册声明的分支数正确', head['平行世界分支'] === snap.branches.length,
  `手册 ${head['平行世界分支']}，实际 ${snap.branches.length}`);
check('手册快速核对清单与备份一致',
  countsIn('【快速核对清单】')['卡片'] === snap.cards.length
  && countsIn('【快速核对清单】')['标记'] === snap.pins.length
  && countsIn('【快速核对清单】')['大纲节点'] === snap.outlineNodes.length,
  JSON.stringify(countsIn('【快速核对清单】')));
check('手册的标签定义与备份一致', tagDefs.length === snap.tags.length
  && tagDefs.every((t, i) => t.name === snap.tags[i].name && t.color === snap.tags[i].color));
check('手册的挂标签清单与备份一致',
  tagMapFromText.reduce((n, row) => n + row.tags.length, 0) === snap.cardTags.length,
  `手册 ${tagMapFromText.reduce((n, row) => n + row.tags.length, 0)} 条，备份 ${snap.cardTags.length} 条`);
check('手册的关联表与备份一致',
  parseRelations(texts['五、关联']).length === snap.relations.length);
check('手册的泳道/纪元/条目表与备份一致',
  parseTimeline(texts['七、时间轴']).tracks.length === snap.tracks.length
  && parseTimeline(texts['七、时间轴']).eras.length === snap.eras.length
  && parseTimeline(texts['七、时间轴']).entries.length === snap.entries.length);
check('手册声明的大纲节点总数正确', numberAfter('九、大纲树', '合计') === snap.outlineNodes.length,
  `手册 ${numberAfter('九、大纲树', '合计')}，实际 ${snap.outlineNodes.length}`);

/* --------------------------- 3. 真实导入 --------------------------- */
await state().bootstrap();
const worldId = state().createWorld('猫猫的冒险（自测导入）');
const result = await importBackup(worldId, backup);
await state().reload();
const s = state();
check('导入没有把资产算错（本数据不含图片）', result.assets === 0, `返回 ${result.assets}`);
check('导入后卡片数一致', s.cards.length === snap.cards.length,
  `库里 ${s.cards.length}，备份 ${snap.cards.length}`);
check('导入后标签/关联数一致',
  s.tags.length === snap.tags.length && s.relations.length === snap.relations.length);
check('导入后地图/标记/区域数一致',
  s.maps.length === snap.maps.length && s.pins.length === snap.pins.length && s.regions.length === snap.regions.length);
check('导入后时间轴数一致',
  s.tracks.length === snap.tracks.length && s.entries.length === snap.entries.length && s.eras.length === snap.eras.length);
check('导入后文稿/大纲数一致',
  s.docs.length === snap.docs.length && s.outlineNodes.length === snap.outlineNodes.length);
check('导入后卡片字段还能读出来（抽样核对「小五」）', (() => {
  const card = s.cards.find((c) => c.title === '小五');
  return !!card && card.fields.birth_t === 9 && card.fields.affiliation === '新营地（水坝猫群）'
    && card.body.includes('[[灰尾]]');
})());
check('导入后正文里的双链能解析出目标', (() => {
  const doc = s.docs.find((d) => d.title === '第一章 · 十四天');
  return !!doc && doc.content.includes('[[蓟丛营地本部]]');
})());
check('导入后世界观的时间轴口径被写入', (() => {
  const world = s.worlds.find((w) => w.id === worldId);
  return world?.meta?.time?.zeroLabel === '立族之年' && world.meta.time.defaultEnd === 22;
})());

/* --------------------------- 4. 过期检查 --------------------------- */
const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);
const stamped = /sample-source-sha256:\s*([0-9a-f]+)/.exec(readFileSync(join(ROOT, 'samples', 'README.md'), 'utf8'))?.[1];
check('备份与手册同步（samples 未过期）', stamped === sha(TEXT),
  `README 记录 ${stamped ?? '无'}，手册实际 ${sha(TEXT)} —— 请先跑 node scripts/make-sample.mjs`);

/* ------------------------------ 汇总 ------------------------------ */
console.log(`[sample-check] 通过 ${report.pass} 项，失败 ${report.fails.length} 项`);
if (report.warnings.length) {
  console.log(`\n[提示 ${report.warnings.length} 条]`);
  report.warnings.forEach((w) => console.log(`  · ${w}`));
}
if (report.fails.length) {
  console.log('\n[失败]');
  report.fails.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
