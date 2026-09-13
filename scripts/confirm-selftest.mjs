/**
 * 确认对话框自测
 * ------------------------------------------------------------------
 * 背景（用户实测的桌面版缺陷）：Tauri 会把 `window.confirm` 转发给 dialog 插件，
 * 未放开权限时抛「dialog.confirm not allowed. Command not found」，
 * 于是所有删除/清空操作在桌面版里失效。现在统一走 askConfirm（应用内对话框）。
 *
 * 这个套件验证接线本身：
 *   1. 注册宿主后 askConfirm 会把请求原样交给宿主，并按用户选择返回布尔值；
 *   2. 宿主未挂载时返回 false（保守地"不执行"），且**绝不**回退到 window.confirm；
 *   3. 取消注册后不再被调用；
 *   4. 字符串参数会被包装成 { message }。
 *
 * 用法：node scripts/confirm-selftest.mjs
 */
import { register } from 'node:module';
// askConfirm 在 src/ 下，用 `@/` 别名导入；先装上解析钩子（与其它自测一致）
register('./alias-hook.mjs', import.meta.url);
const { askConfirm, registerConfirmHost } = await import('@/lib/confirm.ts');

let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) pass += 1;
  else fails.push(detail ? `${name} —— ${detail}` : name);
};

/* 1. 未注册宿主：返回 false，且不调用 window.confirm */
let nativeCalled = false;
globalThis.window = {
  confirm: () => {
    nativeCalled = true;
    return true;
  },
};
const beforeHost = await askConfirm('没有宿主时应该取消');
check('宿主未挂载时返回 false（保守地不执行破坏性操作）', beforeHost === false, String(beforeHost));
check('宿主未挂载时不会回退到 window.confirm', nativeCalled === false);

/* 2. 注册宿主：请求原样透传，选择原样返回 */
const seen = [];
const unregister = registerConfirmHost(async (request) => {
  seen.push(request);
  return request.message.includes('确认') ? true : false;
});
check('确认返回 true', (await askConfirm('请确认删除')) === true);
check('取消返回 false', (await askConfirm('随便问问')) === false);
check('请求被原样交给宿主', seen.length === 2 && seen[0].message === '请确认删除', JSON.stringify(seen));

/* 3. 字符串参数会被包装成对象；附加字段（danger / confirmText）保留 */
await askConfirm({ message: '清空全部数据？', danger: true, confirmText: '清空' });
const last = seen[seen.length - 1];
check('对象参数完整保留（danger / confirmText）',
  last.message === '清空全部数据？' && last.danger === true && last.confirmText === '清空',
  JSON.stringify(last));

/* 4. 取消注册后回到「未挂载」行为 */
unregister();
nativeCalled = false;
check('取消注册后返回 false', (await askConfirm('注销之后')) === false);
check('取消注册后仍然不碰 window.confirm', nativeCalled === false);

/* 5. 多次注册时以最后一次为准（例如热更新重新挂载） */
const calls = [];
registerConfirmHost(async () => { calls.push('first'); return true; });
registerConfirmHost(async () => { calls.push('second'); return true; });
await askConfirm('谁是宿主');
check('多次注册时使用最后一次注册的宿主', calls.join(',') === 'second', calls.join(','));

console.log(`[confirm-selftest] 通过 ${pass} 项，失败 ${fails.length} 项`);
if (fails.length) {
  fails.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
