/**
 * 写作预览面
 * ------------------------------------------------------------------
 * 「预览」与「分栏」两种模式共用同一块渲染：Markdown 渲染后的正文，
 * 居中限宽（max-w-2xl）便于长文阅读。
 *
 * 为什么单独成文件：两个模式共用一份渲染逻辑，复制两份必然分叉；
 * 同时也让 WriterModule 留在 200 行以内。
 */
import { MarkdownView } from '@/components/common/MarkdownView';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

export function WriterPreviewPane({ text, className }: { text: string; className?: string }) {
  return (
    /*
      高度三件套一个都不能少：h-full 撑满格子、min-h-0 允许它被压缩（否则内容长了
      会把格子顶破、整页跟着长高）、overflow-y-auto 长文自己滚。
      padding 与边框由调用方通过 className 传（分栏时要带左边框、预览时不需要）。
    */
    <div className={cn('h-full min-h-0 overflow-y-auto', className)}>
      <div className="mx-auto max-w-2xl">
        <MarkdownView text={text} onCardClick={(id) => useStore.getState().selectCard(id)} />
      </div>
    </div>
  );
}
