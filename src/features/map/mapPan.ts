/**
 * 平移手势的判定（纯函数）
 * ==================================================================
 * 第三轮定下的规则：
 *   - **中键**拖动任何模式都平移（像设计软件那样）；
 *   - **左键**拖动只在「平移态」下平移 —— 预览模式、选中「平移」工具、或按住空格。
 * 各图层在 pointerdown 里问它一句：这一下该不该让路给画布去平移？
 *
 * 让路的意思是**三不**：不 stopPropagation、不选中、不进入拖拽。
 * 否则画布根节点收不到这一下（图钉与顶点手柄原本无条件阻止冒泡），
 * 拖到标记或顶点上就变成拖那个东西，而不是平移画布（第三轮问题一）。
 */
export function isPanPress(button: number, panMode: boolean): boolean {
  if (button === 1) return true;
  return button === 0 && panMode;
}

/**
 * 光标是否落在「要打字」的地方：那时空格属于输入框，不该被平移快捷键抢走
 * （否则侧栏「新地图名称」里打不出空格）。
 * 只认标签名与 contentEditable，不看具体组件，避免和别的模块耦合。
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable === true;
}
