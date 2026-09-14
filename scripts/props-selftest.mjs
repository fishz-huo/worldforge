/**
 * 自测（十八）：卡片属性区（Markdown 投影的渲染与回读）
 * ------------------------------------------------------------------
 * 用法：node scripts/props-selftest.mjs
 *
 * 这一层唯一的正确性保证就是**往返**：卡片 → 属性区文本 → 卡片，
 * 字段值必须逐个相等（类型也要相等）。
 * 如果格式漂移，用户把导出的 Markdown 改一圈回来，字段就会悄悄丢 ——
 * 而界面上完全看不出来，等到导出 PDF 才发现内容少了。
 *
 * 所以这里的重点是那些"容易写坏"的值：带冒号的、带引号的、前后有空格的、
 * 负数与小数、真假值、多值列表、以及关联里的箭头与备注。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const { renderProps, renderPropsBlock, parseProps, parseScalar, propsKeys } = await import('@/lib/markdown/index.ts');
const { relationLine } = await import('@/lib/markdown/props-format.ts');

/** 造一张卡片（只填测试关心的字段） */
function makeCard(fields, over = {}) {
  return {
    id: 'card-1',
    world_id: 'w1',
    branch_id: null,
    type: 'character',
    title: '灰翼',
    subtitle: '燕鸥群的首领',
    summary: '带队的燕鸥',
    body: '正文不参与属性区',
    fields,
    cover_asset: null,
    pinned: 0,
    created_at: 0,
    updated_at: 0,
    ...over,
  };
}

/** 字段定义（只用于排序，值本身不依赖它） */
const DEFS = [
  { key: 'birth_t', label: '出生刻度', kind: 'time' },
  { key: 'death_t', label: '死亡刻度', kind: 'time' },
  { key: 'race', label: '种族', kind: 'text' },
  { key: 'identity', label: '身份', kind: 'text' },
  { key: 'goal', label: '目标', kind: 'textarea' },
  { key: 'tags', label: '标签', kind: 'list' },
];

group('标量排版与转义');

await test('干净的值裸写，含特殊字符的加引号', () => {
  assert.equal(parseScalar('第 7 年'), '第 7 年');
  assert.equal(parseScalar('7'), 7);
  assert.equal(parseScalar('-7.5'), -7.5);
  assert.equal(parseScalar('true'), 1);
  assert.equal(parseScalar('false'), 0);
  assert.equal(parseScalar('""'), '');
});

await test('带引号的值保持字符串，不会退化数字', () => {
  assert.equal(parseScalar('"7"'), '7');
  assert.equal(typeof parseScalar('"7"'), 'string');
  assert.equal(parseScalar('"真：值"'), '真：值');
});

await test('数组：引号内的逗号不切分', () => {
  assert.deepEqual(parseScalar('["a", "b, c"]'), ['a', 'b, c']);
  assert.deepEqual(parseScalar('[]'), []);
});

group('往返（卡片 → 文本 → 卡片）');

await test('基本字段往返：数字仍是数字，文本仍是文本', () => {
  const card = makeCard({ birth_t: -7, race: '燕鸥', goal: '把幼鸟带走' });
  const text = renderProps({ card, tags: [], relations: [], fieldDefs: DEFS });
  const back = parseProps(text);
  assert.equal(back.type, 'character');
  assert.equal(back.subtitle, '燕鸥群的首领');
  assert.equal(back.summary, '带队的燕鸥');
  assert.deepEqual(back.fields, { birth_t: -7, race: '燕鸥', goal: '把幼鸟带走' });
});

await test('刻薄的值也不丢：冒号、引号、井号、前后空格、换行', () => {
  const nasty = {
    race: '燕鸥：海鸥的亲戚',
    identity: '自称"守灯人"',
    goal: '先硬 # 再软',
    death_t: -0.5,
    tags: ['甲,乙', '丙'],
    need_quote: ' 两侧有空格 ',
    newline: '第一行\n第二行',
  };
  const card = makeCard(nasty);
  const text = renderProps({ card, tags: [], relations: [], fieldDefs: DEFS });
  const back = parseProps(text);
  Object.entries(nasty).forEach(([key, value]) => {
    assert.deepEqual(back.fields[key], value, `字段 ${key} 往返后不一致`);
  });
});

await test('空值与未填字段不写进文本（导出的东西不掺空行）', () => {
  const card = makeCard({ birth_t: -7, race: '', goal: null, identity: undefined });
  const text = renderProps({ card, tags: [], relations: [], fieldDefs: DEFS });
  assert.ok(!text.includes('race:'), '空字符串不该被写出来');
  assert.ok(!text.includes('goal:'), 'null 不该被写出来');
  assert.ok(text.includes('birth_t'), '填了的字段要写出来');
  assert.deepEqual(parseProps(text).fields, { birth_t: -7 });
});

await test('围栏完整往返：带 --- 的文本也能解析', () => {
  const card = makeCard({ birth_t: -7 });
  const block = renderPropsBlock({ card, tags: ['主角'], relations: [], fieldDefs: DEFS });
  assert.ok(block.startsWith('---\n') && block.endsWith('\n---'), '围栏应完整包住');
  const back = parseProps(block);
  assert.equal(back.fields.birth_t, -7);
  assert.deepEqual(back.tags, ['主角']);
});

await test('标签：含特殊字符的标签名往返不乱', () => {
  const card = makeCard({});
  const tags = ['角色之内', '潮汐线', '带,逗号'];
  const text = renderProps({ card, tags, relations: [], fieldDefs: DEFS });
  assert.deepEqual(parseProps(text).tags, tags);
});

group('关联行');

await test('三种方向都能解析出箭头、关系名、标题与 id', () => {
  const rel = (over) => ({
    id: 'r1', world_id: 'w1', branch_id: null, from_id: 'card-1', to_id: 'card-2',
    label: '率领', note: '', directed: 1, start_t: null, end_t: null, created_at: 0, ...over,
  });
  const titles = { 'card-1': '灰翼', 'card-2': '芦苇荡燕鸥群' };
  const out = relationLine(rel({}), 'card-1', (id) => titles[id]);
  const inb = relationLine(rel({ from_id: 'card-2', to_id: 'card-1' }), 'card-1', (id) => titles[id]);
  const und = relationLine(rel({ directed: 0 }), 'card-1', (id) => titles[id]);
  assert.ok(out.startsWith('→ 率领：'), out);
  assert.ok(inb.startsWith('← 率领：'), inb);
  assert.ok(und.startsWith('↔ 率领：'), und);

  const card = makeCard({});
  const text = renderProps({ card, tags: [], relations: [out, inb, und], fieldDefs: DEFS });
  const back = parseProps(text);
  assert.equal(back.relations.length, 3);
  assert.deepEqual(back.relations.map((r) => r.arrow), ['→', '←', '↔']);
  assert.deepEqual(back.relations.map((r) => r.label), ['率领', '率领', '率领']);
  assert.deepEqual(back.relations.map((r) => r.title), ['芦苇荡燕鸥群', '芦苇荡燕鸥群', '芦苇荡燕鸥群']);
  assert.deepEqual(back.relations.map((r) => r.id), ['card-2', 'card-2', 'card-2']);
});

await test('括号里的备注会与标题分开，标题里的括号不受影响', () => {
  const line = '→ 关联：营地（水坝猫群）（旧称） [[card-9]]';
  const back = parseProps(`relations:\n  - ${line}`);
  assert.equal(back.relations[0].title, '营地（水坝猫群）');
  assert.equal(back.relations[0].note, '旧称');
  assert.equal(back.relations[0].id, 'card-9');
});

await test('手写（没有 id、关系名留空）也能读出来', () => {
  const back = parseProps('relations:\n  - → 小满\n  - "→ 徒弟: 小五"');
  assert.equal(back.relations[0].label, '关联');
  assert.equal(back.relations[0].title, '小满');
  assert.equal(back.relations[0].id, null);
});

group('容错');

await test('无围栏、多余空行、行尾注释、未知顶层键都不炸', () => {
  const text = [
    'type: character   # 类型写在最前面',
    '',
    'subtitle: 首领',
    'who_knows: 这个键不认识',
    'fields:',
    '  birth_t: -7',
    '',
  ].join('\n');
  const back = parseProps(text);
  assert.equal(back.type, 'character');
  assert.equal(back.subtitle, '首领');
  assert.deepEqual(back.fields, { birth_t: -7 });
  assert.ok(!('who_knows' in back.fields), '未知顶层键不该混进字段');
});

await test('propsKeys 汇总声明的键（给界面提示用）', () => {
  const card = makeCard({ birth_t: -7 });
  const back = parseProps(renderProps({ card, tags: ['甲'], relations: [], fieldDefs: DEFS }));
  const keys = propsKeys(back);
  assert.ok(keys.includes('type'));
  assert.ok(keys.includes('tags'));
  assert.ok(keys.includes('birth_t'));
});

finish('卡片属性区');
