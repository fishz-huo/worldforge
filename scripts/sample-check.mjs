/**
 * 测试世界观数据自测
 * ------------------------------------------------------------------
 * 四件事，全部用真实代码而不是"照着文档猜"：
 *   1. 结构校验：字段名 / 下拉取值 / id 引用 / 数值约束（见 sample-lint.mjs，
 *      它直接读 src/types/card-types.ts 的 FieldDef）；
 *   2. 手册与备份一致性：见 sample-manual.mjs（手册里声明的每一种数量
 *      都必须等于备份里的实际数量）；
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
import { checkManual, numberAfter } from './sample-manual.mjs';
import { state } from './db-harness.mjs';

const ROOT = process.cwd();
const TXT = join(ROOT, 'docs', '潮线之外·世界观设定.txt');
const JSON_FILE = join(ROOT, 'samples', '潮线之外.worldforge.json');
// 归一化换行：手册在 Windows 检出后会变成 CRLF，而分区正则是按 \n 写的
const TEXT = readFileSync(TXT, 'utf8').replace(/\r\n?/g, '\n');
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
const lint = lintSnapshot(snap, { check, warn });

/* ---------------------- 2. 手册与备份一致性 ---------------------- */
checkManual(TEXT, texts, snap, check, BUILTIN_CARD_TYPE_MAP, {
  parseTags, parseRelations, parseTimeline,
});

/* ------------------ 2.5 卡片编号（口径直接取自 card-code.ts） ------------------ */
const { codePrefix, codePrefixOf, findCodeConflict, linkKeysOf, validateCode } =
  await import('@/lib/card-code.ts');

const noCode = snap.cards.filter((c) => !String(c.code ?? '').trim());
check('每张卡片都有编号', noCode.length === 0, `没编号：${noCode.map((c) => c.title).join('、')}`);
const badCode = snap.cards.filter((c) => validateCode(c.code) !== null);
check('编号格式全部合法', badCode.length === 0,
  badCode.map((c) => `${c.title}「${c.code}」${validateCode(c.code)}`).join('；'));
const badPrefix = snap.cards.filter((c) => codePrefix(c.code) !== codePrefixOf(c.type));
check('编号前缀与卡片类型一致', badPrefix.length === 0,
  badPrefix.map((c) => `${c.title}（${c.type}）却是 ${c.code}`).join('；'));
const clash = snap.cards.filter((c) => findCodeConflict(snap.cards, c.code, c.id)
  || (c.code_aliases ?? []).some((alias) => findCodeConflict(snap.cards, alias, c.id)));
check('编号与旧编号全库不重复', clash.length === 0, clash.map((c) => c.title).join('、'));
check('手册里的编号与备份逐张一致',
  cards.length === snap.cards.length
  && cards.every((c, i) => c.code === snap.cards[i].code
    && JSON.stringify(c.code_aliases) === JSON.stringify(snap.cards[i].code_aliases)),
  `手册 ${cards.filter((c) => c.code).length} 个编号，备份 ${snap.cards.filter((c) => c.code).length} 个`);
check('改过编号的卡片保留旧编号（老哨 CHR-003 + 旧号 CHR-009）', (() => {
  const card = snap.cards.find((c) => c.title === '老哨');
  return !!card && card.code === 'CHR-003' && linkKeysOf(card).includes('CHR-009');
})());
const declaredGaps = numberAfter(texts['（开头）'], '正文里有');
check('落空的双链正好是手册声明的处数',
  lint.missing.length === declaredGaps,
  `手册写 ${declaredGaps} 处，实际 ${lint.missing.length} 处：${lint.missing.join('；')}`);

/* --------------------------- 3. 真实导入 --------------------------- */
await state().bootstrap();
const worldId = state().createWorld('潮线之外（自测导入）');
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
check('导入后卡片字段还能读出来（抽样核对「灰翼」）', (() => {
  const card = s.cards.find((c) => c.title === '灰翼');
  return !!card && card.fields.birth_t === -7 && card.fields.affiliation === '芦苇荡燕鸥群'
    && card.body.includes('[[小满]]');
})());
check('导入后正文里的双链能解析出目标', (() => {
  const doc = s.docs.find((d) => d.title === '第一章 · 潮线以上');
  return !!doc && doc.content.includes('[[死线]]');
})());
check('导入后世界观的时间轴口径被写入', (() => {
  const world = s.worlds.find((w) => w.id === worldId);
  return world?.meta?.time?.zeroLabel === '立巢之年' && world.meta.time.defaultEnd === 7;
})());
check('瞬时事件按「结束刻度为空」识别（抵达守望塔）', (() => {
  const entry = s.entries.find((e) => e.title === '抵达守望塔');
  return !!entry && entry.instant === 1 && entry.end_t === null && entry.start_t === 7;
})());
check('数值型泳道才有数值（定居水平）', (() => {
  const track = s.tracks.find((t) => t.name === '定居水平');
  const valued = s.entries.filter((e) => e.track_id === track?.id && e.value !== null);
  return track?.valued === 1 && valued.length === 3;
})());
check('导入后编号读得回来，发号记录也写进去了（灰翼 CHR-001 + CHR 发到 5）', (() => {
  const card = s.cards.find((c) => c.title === '灰翼');
  const world = s.worlds.find((w) => w.id === worldId);
  return card?.code === 'CHR-001' && world?.meta?.codeSeq?.CHR === 5;
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
