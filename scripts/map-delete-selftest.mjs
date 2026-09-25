/**
 * 自测（三十）：地图删除快捷键的判定与文案
 * ------------------------------------------------------------------
 * 用法：node scripts/map-delete-selftest.mjs
 *
 * 为什么这一层必须有自测：按键白名单、输入框豁免、多选计数全是「按错了也不报错」
 * 的类型 —— 少认一个键只是「按了没反应」；豁免写漏了会在输入框里把地图上的东西
 * 删掉（用户当场丢数据，还很难查）。而且「选中多个才弹确认」这条分支**今天没有
 * 界面能触发**（三个选中槽互斥），只能靠这里的用例把它钉住。
 *
 * 事件监听与真实按键（CDP 发 keyDown）属于浏览器那一半，由实测覆盖。
 */
import { register } from 'node:module';
import { assert, finish, group, test } from './test-runner.mjs';

register('./alias-hook.mjs', import.meta.url);

const D = await import('@/features/map/mapDelete.ts');
const P = await import('@/features/map/mapPan.ts');

const none = { pin: null, region: null, terrain: null };

group('按键白名单');

await test('Delete 与 Backspace 都算删除键', () => {
  assert.equal(D.isMapDeleteKey('Delete'), true);
  assert.equal(D.isMapDeleteKey('Backspace'), true);
});

await test('其它键一个都不认（含相近写法与大小写）', () => {
  for (const key of ['Escape', 'Enter', 'd', 'delete', 'BackspaceX', ' ', '', '__nope__']) {
    assert.equal(D.isMapDeleteKey(key), false, `${JSON.stringify(key)} 不该被当成删除键`);
  }
});

group('输入框豁免（焦点在"打字的地方"就不删对象）');

await test('输入框 / 文本域 / 下拉 / 可编辑区都算可编辑，判定复用 isEditableTarget', () => {
  assert.equal(P.isEditableTarget({ tagName: 'INPUT' }), true);
  assert.equal(P.isEditableTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(P.isEditableTarget({ tagName: 'SELECT' }), true);
  assert.equal(P.isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
});

await test('按钮 / 普通元素不算可编辑 → 焦点在工具条上按 Delete 仍然生效', () => {
  assert.equal(P.isEditableTarget({ tagName: 'BUTTON' }), false);
  assert.equal(P.isEditableTarget({ tagName: 'DIV' }), false);
  assert.equal(P.isEditableTarget(null), false, '焦点在 body（target 为空）时也要能删');
});

group('待删除清单');

await test('什么都没选中 → 空清单（此时不拦截按键）', () => {
  assert.deepEqual(D.mapDeleteTargets(none), []);
});

await test('只选中标记 / 区域 / 地形：各出一条，并带上正确的 kind', () => {
  assert.deepEqual(D.mapDeleteTargets({ ...none, pin: 'p1' }), [{ kind: 'pin', id: 'p1' }]);
  assert.deepEqual(D.mapDeleteTargets({ ...none, region: 'r1' }), [{ kind: 'region', id: 'r1' }]);
  assert.deepEqual(D.mapDeleteTargets({ ...none, terrain: 't1' }), [{ kind: 'terrain', id: 't1' }]);
});

await test('三个槽同时有值（将来框选）→ 三条，顺序稳定为 pin → region → terrain', () => {
  assert.deepEqual(D.mapDeleteTargets({ pin: 'p1', region: 'r1', terrain: 't1' }), [
    { kind: 'pin', id: 'p1' }, { kind: 'region', id: 'r1' }, { kind: 'terrain', id: 't1' },
  ]);
});

await test('kind 只取三种值（useMapDelete 只把 region 分流，其余都走 deletePin）', () => {
  const kinds = D.mapDeleteTargets({ pin: 'p', region: 'r', terrain: 't' }).map((t) => t.kind);
  assert.deepEqual([...new Set(kinds)].sort(), ['pin', 'region', 'terrain']);
});

group('确认文案');

await test('多个才弹确认，文案带数量', () => {
  assert.equal(D.mapDeleteConfirm(2), '确定删除选中的 2 个对象？');
  assert.equal(D.mapDeleteConfirm(10), '确定删除选中的 10 个对象？');
});

await test('文案以「确定删除」开头、以中文问号结尾（确认框的既有口吻）', () => {
  assert.match(D.mapDeleteConfirm(3), /^确定删除.*？$/);
});

finish('地图删除快捷键');
