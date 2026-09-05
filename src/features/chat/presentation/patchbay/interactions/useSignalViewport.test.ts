/**
 * @fileoverview useSignalViewport 单元测试。
 * @description 覆盖：自己发送消息后强制跳底、普通追加消息的既有滚动策略。
 */
import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { useSignalViewport } from "./useSignalViewport";

/**
 * 创建可变依赖（测试需直接改写 currentMessageCount / currentChannelId 触发 watcher）。
 * 结构上与 UseSignalViewportDeps 兼容，直接传入 useSignalViewport 即可。
 */
function createDeps() {
  return {
    currentChannelId: ref("ch1"),
    currentMessageCount: ref(0),
    currentChannelHasMore: ref(false),
    loadingMoreMessages: ref(false),
    loadMoreMessages: vi.fn().mockResolvedValue(undefined),
    reportCurrentReadState: vi.fn().mockResolvedValue(undefined),
    onAsyncError: vi.fn(),
  };
}

type TestPane = HTMLElement & {
  __scrollHeight: number;
  __clientHeight: number;
  __scrollTop: number;
};

/**
 * 创建带可编程布局尺寸的消息面板元素（jsdom 无布局，需手工模拟）。
 */
function createPane(scrollHeight: number, clientHeight: number, scrollTop: number): TestPane {
  const el = document.createElement("div") as unknown as TestPane;
  el.__scrollHeight = scrollHeight;
  el.__clientHeight = clientHeight;
  el.__scrollTop = scrollTop;
  Object.defineProperties(el, {
    scrollHeight: {
      configurable: true,
      get(this: TestPane) {
        return this.__scrollHeight;
      },
    },
    clientHeight: {
      configurable: true,
      get(this: TestPane) {
        return this.__clientHeight;
      },
    },
    scrollTop: {
      configurable: true,
      get(this: TestPane) {
        return this.__scrollTop;
      },
      set(this: TestPane, v: number) {
        this.__scrollTop = v;
      },
    },
  });
  return el;
}

/** 连续冲刷 Vue 调度队列，确保 watch 回调与其内部 nextTick 全部执行完毕。 */
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await nextTick();
    await Promise.resolve();
  }
}

describe("useSignalViewport", () => {
  it("自己发送消息后：即使视口停在历史位置，也强制跳到最底部", async () => {
    const deps = createDeps();
    deps.currentMessageCount.value = 5;
    // scrollTop=100，gap = 1000 - (100 + 400) = 500 → 不在底部
    const pane = createPane(1000, 400, 100);
    const model = useSignalViewport(deps);
    model.setSignalPaneRef(pane);
    // 首次绑定面板：进入频道即跳底（新语义），随后模拟用户上滚读历史
    await flushAsync();
    expect(pane.__scrollTop).toBe(1000);
    pane.__scrollTop = 100;

    // 消息入列（appendMessageIfMissing 先于发送结果 resolve）：计数 watcher 先行
    deps.currentMessageCount.value = 6;
    await flushAsync();
    // 既有行为：不在底部 → 仅显示“跳到底部”入口
    expect(model.showJumpToBottom.value).toBe(true);
    expect(pane.__scrollTop).toBe(100);

    // 发送结果返回 → 自己发送通知 → 补一次强制跳底
    await model.notifyOwnMessageSent();
    expect(pane.__scrollTop).toBe(1000);
    expect(model.showJumpToBottom.value).toBe(false);
    expect(deps.reportCurrentReadState).toHaveBeenCalled();
  });

  it("自己发送通知先于消息入列：由计数 watcher 的强制分支完成跳底", async () => {
    const deps = createDeps();
    deps.currentMessageCount.value = 5;
    const pane = createPane(1000, 400, 100);
    const model = useSignalViewport(deps);
    model.setSignalPaneRef(pane);

    // 通知先到（消息尚未入列）
    const notified = model.notifyOwnMessageSent();
    await flushAsync();
    // 消息随后入列 → watcher 强制分支跳底
    deps.currentMessageCount.value = 6;
    await flushAsync();
    await notified;

    expect(pane.__scrollTop).toBe(1000);
    expect(model.showJumpToBottom.value).toBe(false);
  });

  it("他人发送消息且视口不在底部：保持既有行为，只显示跳底入口", async () => {
    const deps = createDeps();
    deps.currentMessageCount.value = 5;
    const pane = createPane(1000, 400, 100);
    const model = useSignalViewport(deps);
    model.setSignalPaneRef(pane);
    // 首次绑定面板：进入频道即跳底（新语义），随后模拟用户上滚读历史
    await flushAsync();
    expect(pane.__scrollTop).toBe(1000);
    pane.__scrollTop = 100;

    deps.currentMessageCount.value = 6;
    await flushAsync();

    expect(pane.__scrollTop).toBe(100);
    expect(model.showJumpToBottom.value).toBe(true);
    // 已读上报只来自进入频道时的跳底，本次“不在底部”的追加不应触发
    expect(deps.reportCurrentReadState).toHaveBeenCalledTimes(1);
  });

  it("他人发送消息且视口在底部：自动滚动到最底部", async () => {
    const deps = createDeps();
    deps.currentMessageCount.value = 5;
    // scrollTop=600，gap = 1000 - (600 + 400) = 0 → 在底部
    const pane = createPane(1000, 400, 600);
    const model = useSignalViewport(deps);
    model.setSignalPaneRef(pane);

    deps.currentMessageCount.value = 6;
    await flushAsync();

    expect(pane.__scrollTop).toBe(1000);
    expect(model.showJumpToBottom.value).toBe(false);
  });

  it("切换频道：即使消息数不变也自动跳到最新一条", async () => {
    const deps = createDeps();
    deps.currentChannelId.value = "ch1";
    deps.currentMessageCount.value = 5;
    const pane = createPane(1000, 400, 100);
    const model = useSignalViewport(deps);
    model.setSignalPaneRef(pane);
    await flushAsync();

    // 切到消息数相同的 ch2（计数 watcher 不触发，仅 channelId watcher 生效）
    deps.currentChannelId.value = "ch2";
    await flushAsync();

    expect(pane.__scrollTop).toBe(1000);
    expect(model.showJumpToBottom.value).toBe(false);
  });

  it("登录首屏：面板挂载时频道已就绪但消息未加载，消息到达后自动跳底", async () => {
    const deps = createDeps();
    deps.currentChannelId.value = "ch1";
    deps.currentMessageCount.value = 0;
    const pane = createPane(1000, 400, 0);
    const model = useSignalViewport(deps);

    // 首次绑定面板（此时消息尚未加载）
    model.setSignalPaneRef(pane);
    await flushAsync();
    expect(pane.__scrollTop).toBe(0);

    // 首屏消息到达 → 完成“进入频道跳底”
    deps.currentMessageCount.value = 10;
    await flushAsync();
    expect(pane.__scrollTop).toBe(1000);
    expect(model.showJumpToBottom.value).toBe(false);
  });

  it("返回聊天页：面板挂载时消息已缓存，直接跳到最新一条", async () => {
    const deps = createDeps();
    deps.currentChannelId.value = "ch1";
    deps.currentMessageCount.value = 8;
    const pane = createPane(1000, 400, 0);
    const model = useSignalViewport(deps);

    model.setSignalPaneRef(pane);
    await flushAsync();

    expect(pane.__scrollTop).toBe(1000);
  });

  it("贴底吸附：用户在吸附窗口内上滚则停止贴底", async () => {
    vi.useFakeTimers();
    try {
      const deps = createDeps();
      deps.currentMessageCount.value = 5;
      const pane = createPane(1000, 400, 600);
      const model = useSignalViewport(deps);
      model.setSignalPaneRef(pane);

      deps.currentMessageCount.value = 6;
      await flushAsync();
      expect(pane.__scrollTop).toBe(1000);

      // 用户向上滚动历史
      pane.__scrollTop = 500;
      // 虚拟列表实测后总高度增长（若无用户滚动，吸附会继续钉底）
      pane.__scrollHeight = 1600;
      vi.advanceTimersByTime(200);
      // 用户已上滚 → 吸附解除，视口停留在用户位置
      expect(pane.__scrollTop).toBe(500);
    } finally {
      vi.useRealTimers();
    }
  });

  it("贴底吸附：高度漂移时保持钉在最新一条", async () => {
    vi.useFakeTimers();
    try {
      const deps = createDeps();
      deps.currentMessageCount.value = 5;
      const pane = createPane(1000, 400, 600);
      const model = useSignalViewport(deps);
      model.setSignalPaneRef(pane);

      deps.currentMessageCount.value = 6;
      await flushAsync();
      expect(pane.__scrollTop).toBe(1000);

      // 实测行高修正导致总高度变化，无用户滚动 → 吸附继续钉底
      pane.__scrollHeight = 1600;
      vi.advanceTimersByTime(200);
      expect(pane.__scrollTop).toBe(1600);
    } finally {
      vi.useRealTimers();
    }
  });
});
