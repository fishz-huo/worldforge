/**
 * 移动端底部导航
 * ------------------------------------------------------------------
 * 从 SideRail 拆出来，因为这里有一套**与桌面不同的信息取舍**：
 *
 * 桌面左侧栏可以放 9 个模块（竖着排得下，还有快捷键 1~9）；
 * 手机底部标签栏放不下 —— 360px 宽的屏幕分给 9 个标签，每个 40px，
 * 中文标签会被压成两行或直接溢出，这正是"很多地方叠在一起"的来源。
 *
 * 所以底部只留 4 个高频模块 + 一个「更多」，其余模块从「更多」里进。
 * 取舍依据是移动端的使用场景：查设定、看地图、翻时间轴、写两笔；
 * 版本/插件/设置属于低频配置，放进「更多」不损失可达性。
 *
 * 世界观切换器原本只挂在桌面图标栏底部（SideRail 里那段 `hidden md:flex`），
 * 窄屏下整条图标栏不渲染 —— 于是「切换 / 新建世界观」在手机上彻底没有入口。
 * 这里把 WorldSwitcher 原样搬进「更多」抽屉的顶部：桌面端一个像素都不动。
 */
import { useState } from 'react';
import { Globe2, MoreHorizontal } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { MODULES, type ModuleDef } from './modules';
import { WorldSwitcher } from './WorldSwitcher';

/** 底部常驻的四个模块（顺序即显示顺序） */
const PRIMARY: string[] = ['board', 'cards', 'map', 'timeline'];

export function MobileNav() {
  const module = useStore((s) => s.module);
  const setModule = useStore((s) => s.setModule);
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = PRIMARY
    .map((key) => MODULES.find((m) => m.key === key))
    .filter((m): m is ModuleDef => Boolean(m));
  const rest = MODULES.filter((m) => !PRIMARY.includes(m.key));
  /** 「更多」里是否包含当前模块：高亮要跟着走，否则用户找不到自己在哪 */
  const inRest = rest.some((m) => m.key === module);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {primary.map((m) => (
          <button
            key={m.key}
            onClick={() => setModule(m.key)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors',
              module === m.key ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon name={m.icon} className="size-4" />
            {m.label}
          </button>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors',
            inRest ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <MoreHorizontal className="size-4" />
          更多
        </button>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>更多</DialogTitle>
          </DialogHeader>

          {/* 世界观入口：窄屏没有左侧图标栏，切换/新建世界观只能从这里进 */}
          <div className="space-y-1 rounded-md border border-border bg-card p-2">
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Globe2 className="size-3" />
              世界观 / 平行世界
            </div>
            <WorldSwitcher />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {rest.map((m) => (
              <Button
                key={m.key}
                variant={module === m.key ? 'secondary' : 'outline'}
                className="h-auto flex-col items-start gap-1 py-2.5"
                onClick={() => {
                  setModule(m.key);
                  setMoreOpen(false);
                }}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <Icon name={m.icon} className="size-3.5" />
                  {m.label}
                </span>
                <span className="text-left text-[10px] font-normal leading-snug text-muted-foreground">
                  {m.hint}
                </span>
              </Button>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            桌面端用数字键 1~9 直接跳模块，手机上这里只保留 4 个常用的，其余收在这里；
            世界观切换器在桌面端位于左侧图标栏底部，手机上没有图标栏，所以放在这一格里。
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
