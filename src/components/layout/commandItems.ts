/**
 * 命令面板的条目构建
 * ------------------------------------------------------------------
 * 从 CommandPalette 拆出来：面板只负责「搜索 + 键盘导航 + 渲染」，
 * 条目从哪来、点了做什么，都在这里定义。新增命令只需改这个文件。
 */
import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Boxes, FileText, Hash, Puzzle, Settings2 } from 'lucide-react';
import { MODULES } from './modules';
import { usePluginRegistry } from '@/hooks/usePluginRegistry';
import { useStore } from '@/store';
import { flush } from '@/lib/db';

/** 面板中的一项 */
export interface CommandItem {
  id: string;
  title: string;
  hint?: string;
  group: string;
  /** lucide 组件（与 iconName 二选一） */
  icon: LucideIcon | null;
  /** 卡片类型等动态图标名，见 components/Icon.tsx */
  iconName?: string;
  run: () => void;
}

/** 汇总全部可搜索条目：导航 / 动作 / 插件命令 / 卡片 / 文稿 */
export function useCommandItems(): CommandItem[] {
  const cards = useStore((s) => s.cards);
  const docs = useStore((s) => s.docs);
  const registry = usePluginRegistry();

  return useMemo(() => {
    const s = useStore.getState();
    const list: CommandItem[] = [];

    // 1) 模块跳转
    MODULES.forEach((m) =>
      list.push({
        id: `module.${m.key}`,
        title: `前往「${m.label}」`,
        hint: m.hint,
        group: '导航',
        icon: null,
        iconName: m.icon,
        run: () => s.setModule(m.key),
      }),
    );

    // 2) 常用动作
    list.push(
      {
        id: 'action.new-card',
        title: '新建卡片',
        hint: '默认创建概念卡，之后可改类型',
        group: '动作',
        icon: Boxes,
        run: () => {
          const card = s.createCard('concept', { title: '未命名概念' });
          s.setModule('cards');
          s.selectCard(card.id);
        },
      },
      {
        id: 'action.new-manuscript',
        title: '新建正文文稿',
        group: '动作',
        icon: FileText,
        run: () => {
          s.createDoc('manuscript', '新正文');
          s.setModule('writer');
        },
      },
      {
        id: 'action.new-outline',
        title: '新建大纲',
        group: '动作',
        icon: FileText,
        run: () => {
          s.createDoc('outline', '新大纲');
          s.setModule('outline');
        },
      },
      {
        id: 'action.snapshot',
        title: '保存设定快照',
        hint: '把当前设定存为一个可对比的版本',
        group: '动作',
        icon: Hash,
        run: () => {
          s.createVersion(`快照 ${new Date().toLocaleString('zh-CN')}`);
          s.setModule('versions');
        },
      },
      {
        id: 'action.save',
        title: '立即保存到本地',
        group: '动作',
        icon: Hash,
        run: () => void flush().then(() => s.toast('已保存到本地', 'success')),
      },
      {
        id: 'action.focus',
        title: '切换专注模式',
        group: '动作',
        icon: Settings2,
        run: () => s.toggleFocus(),
      },
    );

    // 3) 插件注册的命令与面板
    registry.commands.forEach((cmd) =>
      list.push({
        id: `plugin.${cmd.id}`,
        title: cmd.title,
        hint: cmd.hint ?? `来自插件 ${cmd.pluginName}`,
        group: '插件命令',
        icon: Puzzle,
        run: () => void cmd.run(),
      }),
    );
    registry.panels.forEach((panel) =>
      list.push({
        id: `panel.${panel.id}`,
        title: `打开插件面板：${panel.title}`,
        hint: `来自插件 ${panel.pluginName}`,
        group: '插件命令',
        icon: Puzzle,
        run: () => s.setModule('plugins'),
      }),
    );

    // 4) 实体跳转（卡片上限 400 条，避免超大世界观拖慢面板）
    cards.slice(0, 400).forEach((card) =>
      list.push({
        id: `card.${card.id}`,
        title: card.title,
        hint: card.summary || '卡片',
        group: '卡片',
        icon: null,
        iconName: 'Boxes',
        run: () => {
          s.setModule('cards');
          s.selectCard(card.id);
        },
      }),
    );
    docs.forEach((doc) =>
      list.push({
        id: `doc.${doc.id}`,
        title: doc.title,
        hint: doc.kind === 'outline' ? '大纲' : doc.kind === 'note' ? '笔记' : '正文',
        group: '文稿',
        icon: FileText,
        run: () => {
          s.setModule(doc.kind === 'outline' ? 'outline' : 'writer');
          if (doc.kind === 'outline') s.selectOutline(doc.id);
          else s.selectDoc(doc.id);
        },
      }),
    );

    return list;
  }, [cards, docs, registry.commands, registry.panels]);
}
