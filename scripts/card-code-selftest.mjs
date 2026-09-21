/**
 * 卡片永久编号自测
 * ------------------------------------------------------------------
 * 需求：每张卡片一个永久编号（CHR-001），标题随便改，[[编号]] 永远跳得对。
 * 用真实数据层（真实 sql.js + 假 IndexedDB）验证：
 * 自动发号、编号不复用、改号查重、替换 / 保留别名两条路、分支副本重新发号，
 * 以及老库补列不丢数据、老备份导入显示未编号并能一键补齐。
 *
 * 用法：node scripts/card-code-selftest.mjs
 */
import { assert, finish, group, test } from './test-runner.mjs';
import { boot, db, state } from './db-harness.mjs';

const { registerConfirmHost } = await import('@/lib/confirm.ts');
const { buildTitleIndex } = await import('@/lib/query.ts');
const { buildBackup, importBackup } = await import('@/lib/backup.ts');
const { codeOf, codeNumber, formatCode, replaceCodeRefs, validateCode } = await import('@/lib/card-code.ts');

await boot();

/** 确认框的答案由用例设定（测「替换」与「保留别名」两条路） */
let answer = true;
let asked = null;
registerConfirmHost(async (request) => {
  asked = request;
  return answer;
});

/** 当前库里某个前缀发到几号（期望值由它推导，不写死数字） */
const maxOf = (prefix) => state().cards
  .reduce((max, card) => Math.max(max, codeNumber(codeOf(card), prefix) ?? 0), 0);

group('发号规则');

await test('示例世界观的卡片自带编号（角色 CHR-001、地点 LOC-001）', () => {
  const cards = state().cards;
  assert.equal(codeOf(cards.find((c) => c.title === '烬·阿舒尔')), 'CHR-001');
  assert.equal(codeOf(cards.find((c) => c.title === '焚天城')), 'LOC-001');
  assert.ok(cards.every((c) => codeOf(c)), '示例卡片应全部已编号');
});

await test('新建卡片按类型递增，两类互不干扰', () => {
  const chr = maxOf('CHR');
  const loc = maxOf('LOC');
  const a = state().createCard('character', { title: '编号测试甲' });
  const b = state().createCard('character', { title: '编号测试乙' });
  const c = state().createCard('location', { title: '编号测试丙' });
  assert.equal(codeOf(a), formatCode('CHR', chr + 1), `实际 ${codeOf(a)}`);
  assert.equal(codeOf(b), formatCode('CHR', chr + 2));
  assert.equal(codeOf(c), formatCode('LOC', loc + 1), `地点各发各的号，实际 ${codeOf(c)}`);
  assert.deepEqual(a.code_aliases, [], '新卡不应有别名');
});

await test('编号不复用：删掉最大号后新卡拿更大的号', () => {
  const victim = state().cards.find((c) => c.title === '编号测试乙');
  const victimNo = codeNumber(codeOf(victim), 'CHR');
  assert.equal(victimNo, maxOf('CHR'), '前置条件：待删卡片是当前最大号');
  state().deleteCard(victim.id);
  const fresh = state().createCard('character', { title: '编号测试丁' });
  assert.equal(codeOf(fresh), formatCode('CHR', victimNo + 1),
    `不能让已删掉的 ${codeOf(victim)} 复用给新卡，实际 ${codeOf(fresh)}`);
});

group('改编号：查重与替换引用');

await test('格式不合法的编号被拒绝（不能含空格与 [ ] |）', () => {
  assert.ok(validateCode('CHR 001'), '含空格应报错');
  assert.ok(validateCode('CHR|001'), '含竖线应报错（[[双链]] 用它会解析不出来）');
  assert.equal(validateCode('ELARA-001'), null, '自定义格式应当允许');
});

await test('编号被占用时给出「已被谁使用」的提示，且不写库', async () => {
  const target = state().cards.find((c) => c.title === '编号测试甲');
  const before = codeOf(target);
  const result = await state().changeCardCode(target.id, 'LOC-001');
  assert.equal(result.ok, false, '重复编号必须被拒绝');
  assert.match(result.error, /焚天城/, `提示应带上占用者名字，实际：${result.error}`);
  assert.equal(codeOf(db.cardsRepo.get(target.id)), before, '被拒绝时库里不应改动');
});

await test('选「替换引用」：文稿与卡片正文里的引用一起改，显示名保留', async () => {
  const target = state().cards.find((c) => c.title === '编号测试甲');
  const old = codeOf(target);
  state().updateCard(target.id, { body: `写法一：[[${old}]]，写法二：[[${old}|阿甲]]` });
  const doc = state().docs[0];
  state().updateDoc(doc.id, { content: `${doc.content}\n[[${old}|阿甲]] 出场。` });

  answer = true;
  const result = await state().changeCardCode(target.id, 'HERO-007');
  assert.equal(result.ok, true, `改号应成功：${result.error}`);
  assert.ok(asked && asked.confirmText === '替换引用', '应先询问是否替换引用');
  assert.equal(result.replaced, 3, `应替换 3 处，实际 ${result.replaced}`);
  const body = state().cards.find((c) => c.id === target.id).body;
  assert.equal(body, '写法一：[[HERO-007]]，写法二：[[HERO-007|阿甲]]', `正文实际：${body}`);
  const content = state().docs.find((d) => d.id === doc.id).content;
  assert.ok(content.includes('[[HERO-007|阿甲]]'), '文稿里的引用也要一起换');
  assert.ok(!content.includes(old), '文稿里不应残留旧编号');
});

await test('选「不替换」：旧编号成为别名，旧引用仍解析到同一张卡', async () => {
  const target = state().cards.find((c) => c.title === '编号测试甲');
  answer = false;
  const result = await state().changeCardCode(target.id, 'HERO-009');
  assert.equal(result.ok, true, `改号应成功：${result.error}`);
  const after = state().cards.find((c) => c.id === target.id);
  assert.equal(codeOf(after), 'HERO-009');
  assert.deepEqual(after.code_aliases, ['HERO-007'], '旧编号应保留为别名');

  const index = buildTitleIndex(state().cards);
  assert.equal(index.get('HERO-009')?.id, target.id, '新编号要能解析');
  assert.equal(index.get('HERO-007')?.id, target.id, '旧编号（别名）也要能解析');
  assert.equal(index.get('hero-009')?.id, target.id, '编号大小写不敏感');
});

await test('替换函数只动双链写法，正文里裸写的编号不动', () => {
  const hit = replaceCodeRefs('见 [[CHR-001]] 与 CHR-001 两处，还有 [[CHR-001|他]]', 'CHR-001', 'CHR-050');
  assert.equal(hit.count, 2, `只应替换双链写法，实际 ${hit.count}`);
  assert.equal(hit.text, '见 [[CHR-050]] 与 CHR-001 两处，还有 [[CHR-050|他]]');
});

group('分支与老数据');

await test('派生分支：副本重新发号，世界观内不出现重复编号', () => {
  const branchId = state().forkBranch('编号测试分支', '第 1 年分歧');
  const clone = state().cards.find((c) => c.branch_id === branchId && c.title === '编号测试甲');
  assert.ok(clone, '派生分支应复制主世界的卡片');
  assert.notEqual(codeOf(clone), 'HERO-009', '副本不能沿用源卡片的编号');
  const codes = state().cards.map((c) => codeOf(c)).filter(Boolean);
  assert.equal(new Set(codes).size, codes.length, `编号必须唯一：${codes.join('、')}`);
  state().deleteBranch(branchId);
});

await test('旧备份（卡片没有编号字段）能导入，且显示为未编号', async () => {
  const backup = await buildBackup(state().currentWorldId, false);
  // 模拟 0.2.1 及更早导出的备份：卡片上没有 code / code_aliases 两个键
  backup.snapshot.cards = backup.snapshot.cards.map((card) => {
    const { code, code_aliases, ...rest } = card;
    void code;
    void code_aliases;
    return rest;
  });
  const worldId = state().createWorld('旧备份导入测试');
  await importBackup(worldId, backup);
  await state().reload();
  assert.equal(state().cards.length, backup.snapshot.cards.length, '卡片应全部导入');
  assert.ok(state().cards.every((c) => c.code === ''), '旧备份导入的卡片都应是未编号');
  assert.ok(state().cards.every((c) => Array.isArray(c.code_aliases)), '别名列应补成空数组');
});

await test('批量补全编号：一次给所有未编号的卡片发号', () => {
  const before = state().cards.filter((c) => !codeOf(c)).length;
  assert.ok(before > 0, '前置条件：应有未编号的卡片');
  assert.equal(state().fillMissingCodes(), before, `应补全 ${before} 张`);
  assert.ok(state().cards.every((c) => codeOf(c)), '补全后不应再有未编号的卡片');
  assert.equal(new Set(state().cards.map((c) => codeOf(c))).size, state().cards.length, '编号不能重复');
});

await test('旧数据库（cards 表没有编号列）加列后数据不丢', async () => {
  await db.flush();
  // 重建一张「0.2.1 时代」的 cards 表：结构与当时一致（只少编号两列），数据原样搬过去
  db.getDb().exec(`
    CREATE TABLE cards_old (
      id TEXT PRIMARY KEY, world_id TEXT NOT NULL, branch_id TEXT, type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '', subtitle TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '', fields TEXT NOT NULL DEFAULT '{}', cover_asset TEXT,
      pinned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO cards_old SELECT id, world_id, branch_id, type, title, subtitle, summary,
      body, fields, cover_asset, pinned, created_at, updated_at FROM cards;
    DROP TABLE cards;
    ALTER TABLE cards_old RENAME TO cards;
  `);
  await db.replaceWithBytes(db.getDb().export());
  const applied = db.runColumnMigrations();
  assert.ok(applied.includes('cards.code'), `应补上 cards.code，实际 ${applied.join('、')}`);
  assert.ok(applied.includes('cards.code_aliases'), '应补上 cards.code_aliases');
  assert.deepEqual(db.missingColumns(), [], '迁移跑完不应再缺列');

  await state().reload();
  assert.ok(state().cards.length > 0, '加列之后卡片不能丢');
  assert.ok(state().cards.every((c) => codeOf(c) === ''), '老库的卡片一律显示为未编号');
  assert.ok(state().cards.every((c) => typeof c.title === 'string' && c.title.length > 0), '其它列应完好');
  assert.deepEqual(db.runColumnMigrations(), [], '再跑一次迁移应当什么都不做（幂等）');
});

finish('卡片编号');
