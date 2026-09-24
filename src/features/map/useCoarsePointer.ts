/**
 * 触屏 / 窄屏判定
 * ==================================================================
 * 需求：移动端把「悬浮弹浮窗」改成「点击弹底部抽屉」。
 * 判据用 (hover: none) 而不是只看宽度：鼠标在大窗口里悬停是好用的，
 * 而带触摸屏的笔记本两者都能用（hover: hover 时保留悬停体验）；
 * 再并上 max-width: 767px，照顾那些把 hover 报成 hover 的手机浏览器
 * —— 与全应用的移动端断点（侧栏在 max-md 变浮层）保持一致。
 */
import { useEffect, useState } from 'react';

const QUERY = '(hover: none), (max-width: 767px)';

function matches(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(matches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setCoarse(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return coarse;
}
