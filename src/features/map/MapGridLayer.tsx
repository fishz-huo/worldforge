/**
 * 地图网格层（编辑模式的「画布」底纹）
 * ------------------------------------------------------------------
 * 40px 的细密网格。没有直接用 index.css 里的 .bg-grid：那个类是所有
 * 无底图画布共用的，颜色写死在偏冷的 --border 上，而设计稿要的是极淡的
 * 暖灰；这里用两层渐变自己画，顺便把暗色一档一起给了。
 *
 * 两层渐变分别画竖线与横线，叠起来才是网格。必须 pointer-events-none：
 * 网格铺满整张画布，一旦能接收事件，「点空白落点 / 点空白取消选中」就废了。
 */
import type { CSSProperties } from 'react';

/** 浅色：暖灰 10%（rgba(120,113,100) 就是 Tailwind stone-500 的色相） */
const LIGHT: CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, rgba(120,113,100,0.10) 1px, transparent 1px),' +
    'linear-gradient(to bottom, rgba(120,113,100,0.10) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
};

/** 暗色：白色 6%（暗底上暖灰会看不见） */
const DARK: CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),' +
    'linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
};

export function MapGridLayer() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 dark:hidden" style={LIGHT} />
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden dark:block" style={DARK} />
    </>
  );
}
