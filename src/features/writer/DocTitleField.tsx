/**
 * 文稿标题输入框（写作区顶部标题 + 侧栏文稿列表共用）
 * ------------------------------------------------------------------
 * 必须是**受控**的：草稿放在本地（保证输入时不丢光标），库里的值一变就同步进来。
 * 旧写法用的 defaultValue 只在挂载时读一次 —— 顶部改了、侧栏仍显示旧标题，
 * 侧栏一失焦还把那个旧标题写回库，就是 2026-10-16 那个 P0 的根因。
 * 提交时机：失焦 / 回车。规则见 titleCommit.normalizeTitle。
 */
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { normalizeTitle } from './titleCommit';

export function DocTitleField({
  value,
  onCommit,
  className,
  placeholder,
  onFocus,
}: {
  value: string;
  /** 只会收到 trim 过、且与 value 不同的新标题 */
  onCommit: (next: string) => void;
  className?: string;
  placeholder?: string;
  onFocus?: () => void;
}) {
  const [draft, setDraft] = useState(value);

  // 外部改名（另一处标题 / 导入 / 撤销）同步进来：不重挂载，光标不跳
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const next = normalizeTitle(draft, value);
    if (next) onCommit(next);
    setDraft(next ?? value); // 空串 / 没改 / 只有空格：显示回退成库里的值
  };

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onFocus={onFocus}
      // 回车＝失焦提交（沿用软件里改标题的既有习惯）
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}
