/**
 * 错误边界
 * ------------------------------------------------------------------
 * 为什么必须有它：React 18 中，渲染期抛出的错误若没有边界接管，
 * React 会卸载**整棵组件树** —— 用户看到的就是一片白屏，
 * 既不知道出了什么事，也没法退回到别的功能继续工作。
 *
 * 本组件把「崩溃」降级成一块可读的错误面板，并提供恢复动作，
 * 让故障的影响范围限制在出错的那一块（一个模块 / 一个面板）。
 *
 * 用法：
 *   <ErrorBoundary key={module} label={名称}><View /></ErrorBoundary>
 * 注意那个 key：边界一旦捕获过错误就会一直渲染错误面板，
 * 靠 key 变化让它在切换模块时重新挂载、重置状态。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** 出错区域的名字，用于提示文案，例如「地图」 */
  label?: string;
}

interface State {
  /** 非空表示已捕获错误，此时渲染错误面板 */
  error: Error | null;
  /** 错误发生处的组件栈，仅用于折叠展示 */
  stack: string;
  /** 技术详情是否展开 */
  open: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: '', open: false };

  /**
   * 渲染阶段捕获错误：只负责把错误写进 state，
   * React 会用返回值合并 state 并重新渲染（此时显示错误面板）。
   * 这一步不能有副作用，所以日志放在 componentDidCatch。
   */
  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  /** 提交阶段捕获：可以安全地做副作用，这里只写日志便于 F12 定位 */
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[worldforge] ${this.props.label ?? '应用'}渲染失败:`, error, info.componentStack);
    this.setState({ stack: info.componentStack ?? '' });
  }

  /** 重试：清空错误状态，让子树重新挂载一次 */
  private reset = () => this.setState({ error: null, stack: '', open: false });

  render() {
    const { error, stack, open } = this.state;
    if (!error) return this.props.children;

    const where = this.props.label ?? '应用';
    return (
      <div className="flex h-full w-full items-center justify-center overflow-y-auto p-6">
        <div className="w-full max-w-lg space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-destructive">{where}渲染出错</div>
              <div className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground">
                {error.message}
              </div>
            </div>
          </div>

          {/* 出错时用户最担心的是数据，所以明确安抚一句 */}
          <div className="rounded border border-border bg-card/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
            你的设定没有丢失：内容保存在本地数据库里，且每次改动都会即时落盘。
            可以先点「重试」，或切到其他模块继续工作，稍后再回到这里。
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={this.reset}>
              <RotateCw /> 重试
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
              重新加载页面
            </Button>
            <Button size="sm" variant="ghost" onClick={() => this.setState({ open: !open })}>
              {open ? '隐藏技术详情' : '查看技术详情'}
            </Button>
          </div>

          {open && (
            <pre className="max-h-56 overflow-auto rounded border border-border bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
              {error.stack || '（无调用栈）'}
              {stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
