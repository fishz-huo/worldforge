/**
 * 拖拽的「每帧最多提交一次」
 * ==================================================================
 * 拖拽的每一次 pointermove 都要写回坐标，而写回是同步的：一次 SQL + 一次
 * 「整棵地图模块重渲染」——实测每次 6.07ms，是空转悬停（0.49ms）的 12 倍。
 * 指针每秒能报上百次，绝大多数落在同一帧里；把提交合并到 animation frame，
 * 写库与渲染就都降到 ≤60 次/秒，画面照样每帧更新一次。
 *
 * 松手必须 flush：最后一次移动可能还没等到下一帧，不补交就会丢掉终点。
 * 时钟可以注入（自测里换成假 rAF），所以这里不依赖 React、也没有副作用。
 */
export interface FrameCommit<T> {
  /** 记下最新值；本帧已经预约过就只更新值，不排新的帧 */
  push: (value: T) => void;
  /** 立刻提交还没提交的那次（松手时用） */
  flush: () => void;
  /** 丢掉还没提交的值（取消 / 换模式时用） */
  cancel: () => void;
}

/** 只用到 rAF 的这两件事；抽出来是为了自测能塞一个假时钟 */
export interface FrameClock {
  request: (cb: () => void) => number;
  cancel: (handle: number) => void;
}

const rafClock: FrameClock = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export function createFrameCommit<T>(
  commit: (value: T) => void,
  clock: FrameClock = rafClock,
): FrameCommit<T> {
  let handle = 0;
  let next: T | null = null;

  const run = () => {
    handle = 0;
    const value = next;
    next = null;
    if (value !== null) commit(value);
  };

  return {
    push(value) {
      next = value;
      if (!handle) handle = clock.request(run);
    },
    flush() {
      if (handle) {
        clock.cancel(handle);
        handle = 0;
      }
      run();
    },
    cancel() {
      if (handle) {
        clock.cancel(handle);
        handle = 0;
      }
      next = null;
    },
  };
}
