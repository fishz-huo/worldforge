/**
 * 生成测试世界观备份
 * ------------------------------------------------------------------
 * 输入：docs/猫猫的冒险·世界观设定.txt
 * 输出：samples/猫猫的冒险.worldforge.json（可用「设置 → 数据 → 导入设定」直接导入）
 *       samples/README.md（说明这份备份怎么来的，含手册指纹）
 *
 * 用法：node scripts/make-sample.mjs
 * 之所以用脚本生成而不是手写 JSON：文本手册是给人抄的，JSON 是给机器吃的，
 * 两者必须完全一致；一旦手册里的字段名写错，这里会立刻报错。
 * 解析在 sample-text / sample-cards / sample-scene，翻译在 sample-build。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { splitTopSections } from './sample-text.mjs';
import { parseWorld, parseCards, parseTags, parseRelations } from './sample-cards.mjs';
import { parseMaps, parseTimeline, parseDocs, parseOutline } from './sample-scene.mjs';
import { buildSnapshot, countBy, NOW } from './sample-build.mjs';
import { buildReadme } from './sample-readme.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TXT = join(ROOT, 'docs', '猫猫的冒险·世界观设定.txt');
const OUT_DIR = join(ROOT, 'samples');
const OUT_JSON = join(OUT_DIR, '猫猫的冒险.worldforge.json');
/** 必须存在的小节：少一个就说明手册被改坏了，早点报错比生成半成品好 */
const REQUIRED = ['一、顶层设定', '三、卡片', '四、标签', '五、关联', '六、地图', '七、时间轴', '八、文稿', '九、大纲树'];

/* ------------------------------ 解析 ------------------------------ */
const text = readFileSync(TXT, 'utf8');
const S = splitTopSections(text);
REQUIRED.forEach((key) => {
  if (!S[key]) throw new Error(`文本缺少小节：${key}`);
});

const worldInfo = parseWorld(S['一、顶层设定']);
const cards = parseCards(S['三、卡片']);
const { tags: tagDefs, map: tagMap } = parseTags(S['四、标签']);
const relationRows = parseRelations(S['五、关联']);
const maps = parseMaps(S['六、地图']);
const timeline = parseTimeline(S['七、时间轴']);
const docs = parseDocs(S['八、文稿']);
const outlineRows = parseOutline(S['九、大纲树']);

/* ------------------------------ 组装与落盘 ------------------------------ */
const snapshot = buildSnapshot({
  worldInfo, cards, tagDefs, tagMap, relationRows, maps, timeline, docs, outlineRows,
});
const backup = {
  app: 'worldforge',
  version: '0.1.0',
  schemaVersion: 1,
  exportedAt: NOW,
  snapshot,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');

const stats = {
  cards: snapshot.cards.length,
  byType: countBy(snapshot.cards, 'type'),
  tags: snapshot.tags.length,
  cardTags: snapshot.cardTags.length,
  relations: snapshot.relations.length,
  maps: snapshot.maps.length,
  pins: snapshot.pins.length,
  regions: snapshot.regions.length,
  tracks: snapshot.tracks.length,
  entries: snapshot.entries.length,
  eras: snapshot.eras.length,
  docs: snapshot.docs.length,
  outlineNodes: snapshot.outlineNodes.length,
  branches: snapshot.branches.length,
  outlineRoots: snapshot.outlineNodes.filter((n) => !n.parent_id).length,
};

/** 手册指纹：写进 samples/README.md，自测用它判断备份是不是已经过期 */
const sourceHash = createHash('sha256').update(text).digest('hex').slice(0, 16);
writeFileSync(join(OUT_DIR, 'README.md'), buildReadme(stats, sourceHash));

console.log('[make-sample] 生成完成');
console.log(JSON.stringify(stats, null, 2));
