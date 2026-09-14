/**
 * 「其他类型」卡片定义
 * ------------------------------------------------------------------
 * 九种内置类型覆盖了常见的设定零件，但总有装不进去的东西
 * （一套礼仪、一份食谱、一张编年史……）。这个类型就是那个出口。
 *
 * 为什么单独一个文件：card-types.ts 已经接近单文件行数上限
 * （仓库规定每个文件不超过 200 行），而这一条是唯一一个"泛型"类型，
 * 语义上与其它九个不同，拆出来两边都更清楚。
 *
 * 与插件注册的类型（registerCardType）的区别：
 *   - 插件类型要写代码、要装插件，字段是固定的；
 *   - 这个类型开箱即用，字段是自由键值：在卡片的「属性区」里直接写
 *     `键: 值` 就会长出新字段，不需要改代码。
 */
import type { CardTypeDef } from './field';

/** 类型标识，写入 cards.type */
export const CUSTOM_CARD_TYPE = 'custom';

/** 类型名存在这个字段里，用户可以自己改 */
export const TYPE_LABEL_KEY = 'typeLabel';

export const OTHER_CARD_TYPE: CardTypeDef = {
  type: CUSTOM_CARD_TYPE,
  label: '其他类型',
  icon: 'Shapes',
  color: '#64748b',
  titlePlaceholder: '给它起个名字',
  summaryLabel: '一句话摘要',
  fields: [
    {
      key: TYPE_LABEL_KEY,
      label: '类型名',
      kind: 'text',
      group: '自定义',
      placeholder: '如：礼仪 / 菜谱 / 编年史',
      hint: '显示在卡片类型与导出结果里的名字；不填就显示「其他类型」',
    },
    { key: 'points', label: '要点', kind: 'list', group: '自定义', hint: '用逗号分隔，会在属性区里写成数组' },
    { key: 'detail', label: '补充说明', kind: 'textarea', group: '自定义' },
  ],
};
