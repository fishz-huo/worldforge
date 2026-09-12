/**
 * 卡片字段定义（Table-Driven Fields）
 * ------------------------------------------------------------------
 * 每一类卡片（角色 / 地点 / 事件 …）拥有的差异化字段由 FieldDef 描述，
 * 编辑器与详情页都据此自动渲染表单，插件也能通过 registerCardField 追加字段。
 */
import type { Option } from './common';

/** 字段渲染控件类型 */
export type FieldKind =
  | 'text' // 单行文本
  | 'textarea' // 多行文本
  | 'number' // 数值
  | 'select' // 下拉单选
  | 'boolean' // 开关
  | 'time' // 时间轴刻度（数值，可为负）
  | 'color' // 颜色
  | 'list'; // 逗号分隔的字符串列表

/** 单个字段定义 */
export interface FieldDef {
  /** fields JSON 中的键名 */
  key: string;
  /** 表单标签 */
  label: string;
  kind: FieldKind;
  /** select 的候选项 */
  options?: Option[];
  /** 占位提示 */
  placeholder?: string;
  /** 字段说明（鼠标悬停显示） */
  hint?: string;
  /** 分组名，用于表单分区显示 */
  group?: string;
  /** 是否全文检索时纳入索引 */
  searchable?: boolean;
  /** 由插件注入的字段（UI 上会带插件标记） */
  fromPlugin?: string;
}

/** 卡片类型定义 */
export interface CardTypeDef {
  /** 类型标识，写入 cards.type */
  type: string;
  /** 显示名，如「角色」 */
  label: string;
  /** lucide 图标名（见 components/Icon.tsx 的映射表） */
  icon: string;
  /** 主题色 */
  color: string;
  /** 标题输入框的占位文案 */
  titlePlaceholder?: string;
  /** 摘要输入框的标签（不同题型语义不同） */
  summaryLabel?: string;
  /** 差异化字段 */
  fields: FieldDef[];
  /** 是否参与时间轴（事件 / 角色等） */
  timeline?: boolean;
  /** 由插件注册的类型，值为插件 id */
  fromPlugin?: string;
}

/** 常用下拉项 */
export const LOCATION_CATEGORIES: Option[] = [
  { value: 'continent', label: '大陆 / 大区' },
  { value: 'country', label: '国家 / 政权' },
  { value: 'city', label: '城市 / 聚落' },
  { value: 'site', label: '建筑 / 设施' },
  { value: 'ruin', label: '遗迹 / 秘境' },
  { value: 'nature', label: '自然奇观' },
  { value: 'other', label: '其它' },
];

export const LORE_CATEGORIES: Option[] = [
  { value: 'magic', label: '魔法 / 超凡体系' },
  { value: 'cultivation', label: '修炼 / 等级体系' },
  { value: 'divine', label: '神系 / 信仰' },
  { value: 'substance', label: '关键物质 / 能量' },
  { value: 'rule', label: '世界规则 / 物理法则' },
  { value: 'society', label: '社会制度 / 经济' },
  { value: 'tech', label: '科技树 / 技术水平' },
  { value: 'other', label: '其它' },
];

export const REFERENCE_SOURCES: Option[] = [
  { value: 'book', label: '书籍 / 专著' },
  { value: 'paper', label: '论文 / 研究' },
  { value: 'web', label: '网页 / 文章' },
  { value: 'video', label: '影视 / 视频' },
  { value: 'game', label: '游戏' },
  { value: 'myth', label: '神话 / 传说' },
  { value: 'image', label: '图片 / 画集' },
  { value: 'other', label: '其它' },
];
