/**
 * 自测（七）：表描述 ↔ 领域类型 一致性
 * ------------------------------------------------------------------
 * 用法：node scripts/selftest-specs.mjs
 *
 * 通用仓储用「列名」当对象属性名，所以领域类型的字段名必须与列名逐字一致。
 * 写错时完全没有编译期或运行期报错，只是那个字段永远读不到、也存不进去，
 * 直到某处 `Object.keys(undefined)` 在离现场很远的地方崩掉。
 * 这个套件先用真实 bug 样本验证检查器有效，再扫描全量源码要求零不一致。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, finish, group, test } from './test-runner.mjs';
import { checkSpecs, extractInterfaces, extractSpecs } from './spec-lint.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 用最小样本驱动检查器 */
function run(tables, types) {
  return checkSpecs(tables, types.map((text, i) => ({ fileName: `t${i}.ts`, text })));
}

/** 拼一份「一个表 + 一个类型」的样本 */
function sample(columns, typeBody) {
  const list = columns.map((c) => `'${c}'`).join(', ');
  return run(
    `export const THING_SPEC = defineTable('things', [${list}], {});
     export const thingsRepo = createRepo<Thing>(THING_SPEC);`,
    [`export interface Thing ${typeBody}`],
  );
}

group('检查器自身有效性');

await test('能检出：类型写驼峰、列名是下划线（插件白屏的真实成因）', () => {
  const problems = sample(['name', 'settings_schema'], `{ id: string; name: string; settingsSchema: Record<string, unknown> }`);
  assert.equal(problems.length, 1, `期望 1 处不一致，实际 ${problems.length} 处`);
  assert.deepEqual(problems[0].extra, ['settingsSchema'], '类型多出的字段应被点出');
  assert.deepEqual(problems[0].missing, ['settings_schema'], '类型缺失的字段应被点出');
});

await test('能检出：列存在但类型里漏了字段', () => {
  const problems = sample(['name'], `{ id: string }`);
  assert.equal(problems.length, 1);
  assert.deepEqual(problems[0].missing, ['name']);
});

await test('能检出：找不到对应的类型声明', () => {
  const problems = run(`export const T_SPEC = defineTable('t', ['a'], {});
    export const tRepo = createRepo<Missing>(T_SPEC);`, []);
  assert.equal(problems.length, 1);
  assert.match(problems[0].extra.join(), /Missing/);
});

await test('能检出：找不到表描述', () => {
  const problems = run(`export const tRepo = createRepo<Thing>(NOPE_SPEC);`, ['export interface Thing { id: string }']);
  assert.equal(problems.length, 1);
  assert.match(problems[0].extra.join(), /NOPE_SPEC/);
});

await test('不误报：完全一致', () => {
  assert.equal(sample(['name', 'created_at'], `{ id: string; name: string; created_at: number }`).length, 0);
});

await test('不误报：字段来自 extends 继承', () => {
  const problems = run(
    `export const THING_SPEC = defineTable('things', ['name', 'created_at'], {});
     export const thingsRepo = createRepo<Thing>(THING_SPEC);`,
    [
      `export interface Stamps { created_at: number }`,
      `export interface Thing extends Stamps { id: string; name: string }`,
    ],
  );
  assert.equal(problems.length, 0, `继承的字段应被解析出来，却报了：${JSON.stringify(problems)}`);
});

await test('不误报：索引签名不算属性名', () => {
  assert.equal(sample(['meta'], `{ id: string; meta: Record<string, unknown>; [k: string]: unknown }`).length, 0);
});

group('全量源码扫描');

/** 收集 src 下所有 .ts（含 .tsx 里的 interface） */
function collect(dir, out = []) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) collect(full, out);
    else if (/\.tsx?$/.test(item.name)) out.push({ fileName: relative(ROOT, full), text: readFileSync(full, 'utf8') });
  }
  return out;
}

const tablesSource = readFileSync(join(ROOT, 'src/lib/db/tables.ts'), 'utf8');
const typeFiles = collect(join(ROOT, 'src'));
const problems = checkSpecs(tablesSource, typeFiles);
const { repos } = extractSpecs(tablesSource);

await test('解析出了全部仓储（防止解析失败导致假通过）', () => {
  assert.ok(repos.length >= 17, `只解析出 ${repos.length} 个仓储，期望至少 17 个`);
});

await test(`扫描 ${typeFiles.length} 个源文件，${repos.length} 个仓储的表描述与领域类型完全一致`, () => {
  const detail = problems
    .map(
      (p) =>
        `\n    ${p.varName} → ${p.typeName}（表 ${p.table}）` +
        `\n      列里有、类型没有：${p.missing.join(', ') || '无'}` +
        `\n      类型有、列里没有：${p.extra.join(', ') || '无'}`,
    )
    .join('');
  assert.equal(problems.length, 0, `发现 ${problems.length} 处不一致：${detail}`);
});

group('插件 API 文档与源码一致');

/**
 * 插件开发指南曾经大面积失真：文档里写着 api.declareSettings / api.pluginSettings /
 * api.cards.* / deactivate() 等**并不存在**的接口，照着写必然跑不起来。
 * 指南里那行 `// worldforge:plugin-api ...` 是唯一权威清单，这里与源码强制比对。
 */
const guide = readFileSync(join(ROOT, 'docs/插件开发指南.md'), 'utf8');
const apiSource = readFileSync(join(ROOT, 'src/types/plugin-api.ts'), 'utf8');
const apiInterface = extractInterfaces([{ fileName: 'plugin-api.ts', text: apiSource }]).get('PluginAPI');

/** 取出指南里声明的成员清单 */
function documentedMembers() {
  const matched = guide.match(/\/\/\s*worldforge:plugin-api\s+([^\n]+)/);
  if (!matched) return null;
  return matched[1].split(',').map((s) => s.trim()).filter(Boolean);
}

await test('能从源码解析出 PluginAPI', () => {
  assert.ok(apiInterface, '未找到 PluginAPI 接口');
  assert.ok(apiInterface.members.size >= 10, `只解析出 ${apiInterface.members.size} 个成员，解析可能失效`);
});

await test('指南里的接口清单与 PluginAPI 完全一致', () => {
  const documented = documentedMembers();
  assert.ok(documented, '指南里找不到 `// worldforge:plugin-api` 清单行');
  const real = [...apiInterface.members];
  const missing = real.filter((m) => !documented.includes(m));
  const extra = documented.filter((m) => !real.includes(m));
  assert.equal(
    missing.length + extra.length,
    0,
    `文档与源码不一致：\n      源码有、文档没有：${missing.join(', ') || '无'}\n      文档有、源码没有：${extra.join(', ') || '无'}`,
  );
});

await test('指南的 API 参考一节不再出现未实现的接口', () => {
  // 只扫 §4「API 参考」这段规范性内容：
  //   - 文首的状态声明会主动列出「不能用」的接口名，不该算违规；
  //   - §3 的示例已被该声明标注为「尚未按实现重写」的设计参考。
  const reference = guide.match(/## 4[\s\S]*?(?=\n## 5)/)?.[0] ?? '';
  assert.ok(reference.length > 500, '没截取到 §4 内容，标题可能被改动');
  const ghosts = ['api.declareSettings', 'api.pluginSettings', 'api.cards.', 'api.worlds.', 'api.tags.', 'api.relations.'];
  const hits = ghosts.filter((g) => reference.includes(g));
  assert.equal(hits.length, 0, `API 参考里仍出现未实现的接口：${hits.join(', ')}`);
});

finish('表描述一致性');
