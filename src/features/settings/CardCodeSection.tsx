/**
 * 卡片编号设置（「设置 → 世界观」里的一节）
 * ------------------------------------------------------------------
 * 这里管两件事：
 *   1. **默认替换引用**开关：改编号时弹窗问「要不要把全库的 [[旧编号]] 换成新编号」。
 *      开（默认）= 弹窗把「替换引用」放在主按钮上；关 = 不问，直接保留旧编号为别名。
 *   2. **批量补全编号**：给所有还没有编号的卡片补号（老数据、旧备份导入的卡片
 *      都是「未编号」状态）。按创建时间先后发号，已有的编号一个都不动。
 *
 * 为什么要显示「已编号 / 未编号」的数量：用户能一眼看出要不要点那个按钮，
 * 而不是点完才发现「本来就有编号」。
 */
import { useState } from 'react';
import { Hash, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SectionTitle } from '@/components/ui/primitives';
import { Switch } from '@/components/ui/switch';
import { codeOf } from '@/lib/card-code';
import { askConfirm } from '@/lib/confirm';
import { useStore } from '@/store';

export function CardCodeSection() {
  const cards = useStore((s) => s.cards);
  const autoReplace = useStore((s) => s.autoReplaceCodeRefs);
  const setAutoReplace = useStore((s) => s.setAutoReplaceCodeRefs);
  const fillMissingCodes = useStore((s) => s.fillMissingCodes);
  const toast = useStore((s) => s.toast);
  const [busy, setBusy] = useState(false);

  const missing = cards.filter((c) => !codeOf(c)).length;
  const coded = cards.length - missing;

  /** 批量补号：不可撤销（新编号会写进卡片），所以先确认一次 */
  const fill = async () => {
    if (missing === 0 || busy) return;
    const ok = await askConfirm({
      message: `给 ${missing} 张还没有编号的卡片补上编号？\n\n`
        + '规则：角色 CHR-001、地点 LOC-001、事件 EVT-001……按卡片创建时间先后发号。\n'
        + '已经编过号的卡片不受影响。',
      confirmText: '补全编号',
    });
    if (!ok) return;
    setBusy(true);
    const done = fillMissingCodes();
    setBusy(false);
    toast(`已为 ${done} 张卡片补全编号`, 'success');
  };

  return (
    <section className="space-y-2">
      <SectionTitle>
        <span className="flex items-center gap-1">
          <Hash className="size-3" /> 卡片编号
        </span>
      </SectionTitle>
      <div className="space-y-2 px-1">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          每张卡片有一个永久编号（如 CHR-001）。标题随便改，正文里写 [[CHR-001]] 永远跳转到同一张卡片；
          在编辑器里输入 [[ 时，也可以直接搜编号。编号显示在卡片详情页顶部，鼠标移上去点铅笔即可修改。
        </p>

        <div className="flex items-center justify-between">
          <Label className="text-xs">
            改编号时默认替换正文引用
            <span className="ml-1 font-normal text-muted-foreground">
              （关掉则总是保留旧编号为别名，旧引用仍可跳转）
            </span>
          </Label>
          <Switch checked={autoReplace} onCheckedChange={setAutoReplace} />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-2">
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            本世界观：<span className="text-foreground">{coded}</span> 张已编号 ·{' '}
            <span className={missing > 0 ? 'text-amber-500' : 'text-foreground'}>{missing}</span> 张未编号
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={missing === 0 || busy}
            onClick={() => void fill()}
          >
            <Wand2 className="size-3" /> 批量补全编号
          </Button>
        </div>
      </div>
    </section>
  );
}
