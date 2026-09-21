/**
 * 卡片详情视图
 * ------------------------------------------------------------------
 * 主内容区里的「一页 Wiki」：左边写正文，右边改结构（字段/标签/图库/关联）。
 * 所有输入都是自动保存，符合「设定层不需要点保存」的直觉。
 *
 * 四种视图（页签栏在最上，抬头三段只跟着「编辑」与「分栏」出现）：
 *   edit    单栏：抬头三段 + 正文编辑器
 *   preview 单栏：整张渲染出来的卡片页面（CardPreviewPane 撑满，自带抬头）
 *   split   左右各半：左=编辑区（含抬头三段），右=预览面；窄了改上下堆叠
 *   props   单栏：属性区（结构化字段/标签/关联的文本投影）
 *
 * 右列（CardAside）默认收起，由头部开关控制 —— 它打开时会挤压主内容区，
 * 所以切到「分栏」会自动收起它，免得编辑区被压到 240px 以下没法用。
 * 顶部条与抬头三段各自拆成独立文件，保证本文件不超 200 行。
 */
import { useMemo, useState } from 'react';
import { Braces, Columns2, Eye, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { cardTypeOf } from '@/lib/plugin/registry';
import { countWords } from '@/lib/markdown';
import { cn, formatTime } from '@/lib/utils';
import { useStore } from '@/store';
import { CardAside } from './CardAside';
import { CardDetailHeader } from './CardDetailHeader';
import { CardHeadFields } from './CardHeadFields';
import { CardPreviewPane } from './CardPreviewPane';
import { CardPropsPanel } from './CardPropsPanel';

type ViewMode = 'edit' | 'preview' | 'split' | 'props';

export function CardDetailView({ cardId }: { cardId: string }) {
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));
  const updateCard = useStore((s) => s.updateCard);
  const selectCard = useStore((s) => s.selectCard);
  const branches = useStore((s) => s.branches);
  const [mode, setMode] = useState<ViewMode>('edit');
  /** 右列结构面板：默认收起（设计稿口径），每次进卡片都重新收起 */
  const [asideOpen, setAsideOpen] = useState(false);

  const def = useMemo(() => (card ? cardTypeOf(card) : null), [card]);
  if (!card || !def) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        卡片不存在或已被删除
      </div>
    );
  }
  const branch = branches.find((b) => b.id === card.branch_id);

  /** 切页签：选「分栏」时顺手收起右列，把宽度让给编辑区与预览面 */
  const changeMode = (next: ViewMode) => {
    if (next === 'split') setAsideOpen(false);
    setMode(next);
  };

  const editor = (
    <MarkdownEditor
      value={card.body}
      onChange={(body) => updateCard(card.id, { body })}
      className="rounded-lg border border-border"
      placeholder="写设定正文…支持 Markdown；提到其它卡片标题会自动变成可悬停预览的双链"
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CardDetailHeader
        card={card}
        def={def}
        branch={branch}
        asideOpen={asideOpen}
        onToggleAside={() => setAsideOpen(!asideOpen)}
      />

      {/*
        窄屏只有一列时高度必须交给内容：Grid 的自动行默认会被压进容器高度，
        于是左右两列各自缩成几十像素、内容互相盖住（"结构化字段和编辑器重叠"）。
        auto-rows-min 让每行取自己的内容高度，超出部分由外层 overflow-y-auto 滚。
        右列只在开关打开时占一列，收起时主内容区吃满整个宽度。

        行高两种口径：默认 auto-rows-min（编辑/属性区可能很长，行高跟着内容长，
        超出交给外层滚）；只有「分栏」改用 auto-rows-fr —— 行高按容器剩余空间分配，
        两栏因此都能撑满、不在下面留一片空白，窄屏堆叠时上下两行还天然各占一半。
      */}
      <div
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1 overflow-y-auto',
          mode === 'split' ? 'auto-rows-fr' : 'auto-rows-min',
          asideOpen && 'lg:grid-cols-[1fr_20rem]',
        )}
      >
        <div className="flex min-h-0 flex-col gap-2 p-3">
          <Tabs value={mode} onValueChange={(v) => changeMode(v as ViewMode)} className="flex min-h-0 flex-1 flex-col">
            {/* 页签栏在最上；右侧那串字数/时间是动态数据，不是要删的东西 */}
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="edit" className="gap-1">
                  <Pencil className="size-3" /> 编辑
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1">
                  <Eye className="size-3" /> 预览
                </TabsTrigger>
                <TabsTrigger value="split" className="gap-1">
                  <Columns2 className="size-3" /> 分栏
                </TabsTrigger>
                <TabsTrigger value="props" className="gap-1">
                  <Braces className="size-3" /> 属性区
                </TabsTrigger>
              </TabsList>
              <span className="text-[10px] text-muted-foreground">
                {countWords(card.body)} 字 · 更新于 {formatTime(card.updated_at)}
              </span>
            </div>

            {/*
              注意：TabsContent 上不能写 flex / grid 这类 display 类。Radix 用
              hidden 属性隐藏未激活面板，Tailwind 的 flex 会覆盖 display:none ——
              切到预览时编辑器仍实打实占着 400 多像素，把预览顶到很下面。
              所以下面每块都套一层 div 来撑布局。
            */}
            <TabsContent value="edit" className="mt-1 min-h-[320px] flex-1">
              <div className="flex h-full min-h-0 flex-col gap-2">
                <CardHeadFields card={card} def={def} />
                {editor}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-1 flex-1">
              {/* 预览面撑满：不再重复一段抬头，页面从最上方开始 */}
              <CardPreviewPane card={card} onCardClick={(id) => selectCard(id)} />
            </TabsContent>

            {/*
              分栏：左右各 50%，间隙 12px（gap-3）。这里没有用 lg: 那档视口断点，
              因为主内容区实际有多宽取决于侧栏 256 + 右列 320 + 界面缩放 ——
              同一块屏幕上它可能是 600 也可能是 300，视口断点会判错。
              改用「每栏最小 240px」交给浏览器算：≥496px 并排，更窄就上下堆叠
              （与写作模块同一套行为，写法更省事）。
            */}
            <TabsContent value="split" className="mt-1 min-h-0 flex-1">
              <div className="grid h-full grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                {/* 左栏自带抬头三段：那三个输入本来就只在编辑态出现 */}
                <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
                  <CardHeadFields card={card} def={def} />
                  <div className="flex min-h-0 flex-1 flex-col">{editor}</div>
                </div>
                {/* 右栏：同一张预览面，与「预览」页签共用一份渲染逻辑 */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <CardPreviewPane
                    card={card}
                    className="flex-1"
                    onCardClick={(id) => selectCard(id)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="props" className="mt-1 min-h-[340px] flex-1">
              <div className="flex h-full min-h-0 flex-col">
                <CardPropsPanel cardId={card.id} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* 右列：结构编辑。切到「属性区」时收成只剩图库，避免两个入口改同一批数据 */}
        {asideOpen && (
          <div className="border-t border-border p-2 lg:border-l lg:border-t-0">
            <CardAside cardId={card.id} compact={mode === 'props'} />
          </div>
        )}
      </div>
    </div>
  );
}
