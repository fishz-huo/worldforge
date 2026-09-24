/**
 * 地图的全局按键状态（空格 = 临时平移，Alt = 删除顶点）
 * ==================================================================
 * 两条规则都要求「任何模式都生效」，所以监听挂在 window 上，而不是画布元素上
 * （画布没聚焦时按键也得算数）。三个容易踩的点：
 *   1. **输入框里不拦空格**：侧栏「新地图名称」要能打空格，见 isEditableTarget；
 *   2. **空格要 preventDefault**：否则页面会跟着滚动，而且松开时浏览器会把
 *      空格当成「激活刚才点过的那个按钮」——表现是选好的工具自己跳回去；
 *   3. **失焦要复位**：按住空格时 Alt+Tab 切走，收不到 keyup，回来就会一直
 *      处于平移态（用户看着像"卡住了"）。keyup + window blur 两处都清。
 * Alt 只跟踪、不改默认行为（免得吃掉 Alt+Tab / Alt+F4 这类系统组合键）。
 */
import { useEffect, useState } from 'react';
import { isEditableTarget } from './mapPan';

export interface MapKeys {
  /** 空格按住：临时平移（优先于当前工具） */
  space: boolean;
  /** Alt 按住：顶点光标换「−」，点击即删 */
  alt: boolean;
}

export function useMapKeys(): MapKeys {
  const [space, setSpace] = useState(false);
  const [alt, setAlt] = useState(false);

  useEffect(() => {
    const reset = () => {
      setSpace(false);
      setAlt(false);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // 按住不放时 keydown 会连发，只有第一下有意义
        if (e.repeat || isEditableTarget(e.target)) return;
        e.preventDefault();
        setSpace(true);
        return;
      }
      if (e.key === 'Alt') setAlt(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpace(false);
      if (e.key === 'Alt') setAlt(false);
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, []);

  return { space, alt };
}
