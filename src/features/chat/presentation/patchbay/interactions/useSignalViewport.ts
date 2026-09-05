/**
 * @fileoverview Signal pane 视口编排（滚动、历史分页、已读上报）。
 * @description chat｜presentation composable：将消息面板交互细节从页面拆出。
 */

import { nextTick, onScopeDispose, ref, watch, type ComputedRef, type Ref } from "vue";
import { createAsyncTaskRunner } from "./asyncTaskRunner";

type CountRef = Ref<number> | ComputedRef<number>;
type BoolRef = Ref<boolean> | ComputedRef<boolean>;
type StringRef = Ref<string> | ComputedRef<string>;
const AT_BOTTOM_GAP_PX = 60;
const TOP_AUTO_LOAD_THRESHOLD_PX = 40;
const AUTO_LOAD_COOLDOWN_MS = 900;
/**
 * 贴底吸附窗口：跳底动作完成后的一小段时间内持续把视口钉在底部。
 *
 * 原因：消息列表是 @tanstack/vue-virtual 虚拟列表，行高先按 estimateSize 估算、
 * 渲染后再由 measureElement 实测修正。单次 `scrollTop = scrollHeight` 会在实测
 * 过程中随总高度变化而漂移，导致切频道/登录后并没有真正停在最新一条消息。
 */
const STICK_DURATION_MS = 900;
const STICK_TICK_MS = 32;

/**
 * Signal pane 视口编排依赖。
 */
export type UseSignalViewportDeps = {
  currentChannelId: StringRef;
  currentMessageCount: CountRef;
  currentChannelHasMore: BoolRef;
  loadingMoreMessages: BoolRef;
  loadMoreMessages(): Promise<void>;
  reportCurrentReadState(): Promise<void>;
  onAsyncError(action: string, error: unknown): void;
};

/**
 * Signal pane 视口模型。
 */
export type SignalViewportModel = {
  signalPaneRef: Ref<HTMLElement | null>;
  showJumpToBottom: Ref<boolean>;
  setSignalPaneRef(el: HTMLElement | null): void;
  handleSignalScroll(): void;
  handleLoadMoreMessages(): Promise<void>;
  handleJumpToBottom(): void;
  /** 自己发送消息后调用：等待消息入列后强制跳到底部。 */
  notifyOwnMessageSent(): Promise<void>;
  maybeReportReadState(): void;
  handleWindowFocus(): void;
  handleVisibilityChange(): void;
};

/**
 * 管理 signal pane 的滚动与已读上报行为。
 *
 * 说明：
 * - 切换频道后（含登录后进入首个频道、离开再返回聊天页）：自动滚到最新一条消息；
 * - 自己发送消息后：无论视口位置，自动跳到最底部；
 * - 跳底后短暂“贴底吸附”：等待虚拟列表（@tanstack/vue-virtual）实测行高稳定，
 *   避免单次滚动因估算高度漂移而偏离最新消息；用户主动上滚会立即解除吸附；
 * - 向上滚动到顶部：按节流自动加载历史页；
 * - 位于底部时：尽力上报已读状态。
 */
export function useSignalViewport(deps: UseSignalViewportDeps): SignalViewportModel {
  const signalPaneRef = ref<HTMLElement | null>(null);
  const showJumpToBottom = ref(false);

  let lastAutoLoadAt = 0;
  let pendingScrollToBottom = false;
  /** 自己发送的消息待入列标记：入列后无论视口位置都强制跳到底部。 */
  let pendingOwnSendScroll = false;
  /** 贴底吸附状态：截止时间、轮询句柄与上一帧 scrollTop（用于识别用户手动上滚）。 */
  let stickDeadline = 0;
  let stickTimer: number | null = null;
  let stickLastTop = 0;

  /**
   * 取消贴底吸附（切频道或用户主动上滚时调用）。
   */
  function cancelStickToBottom(): void {
    stickDeadline = 0;
    if (stickTimer !== null) {
      // 用全局 clearTimeout 而非 window.clearTimeout：测试环境 jsdom teardown 后
      // window 标识符被移除，残留的吸附定时器若访问 window 会抛 ReferenceError；
      // 生产行为与 window.clearTimeout 完全一致。
      clearTimeout(stickTimer);
      stickTimer = null;
    }
  }

  /**
   * 在吸附窗口内反复把视口钉在底部，直到实测高度稳定或用户上滚。
   *
   * 用户上滚识别：轮询时若发现 scrollTop 比上一帧记录值更小（排除自身写入），
   * 视为用户主动滚动，立即取消吸附。
   */
  function startStickToBottom(): void {
    stickDeadline = Date.now() + STICK_DURATION_MS;
    if (stickTimer !== null) return;
    stickLastTop = signalPaneRef.value?.scrollTop ?? 0;
    const tick = (): void => {
      stickTimer = null;
      const el = signalPaneRef.value;
      if (!el || Date.now() > stickDeadline) return;
      if (el.scrollTop < stickLastTop - 1) {
        // 用户在吸附期间向上滚动了历史，停止贴底。
        stickLastTop = el.scrollTop;
        return;
      }
      el.scrollTop = el.scrollHeight;
      stickLastTop = el.scrollTop;
      // 同上：全局 setTimeout，避免测试环境拆除后 window 未定义。
      stickTimer = setTimeout(tick, STICK_TICK_MS);
    };
    tick();
  }

  /** 最近一次已成功“进入即跳底”的频道，防止面板重挂载时重复触发。 */
  let lastJumpedChannelId = "";

  const runAsyncTask = createAsyncTaskRunner(deps.onAsyncError);

  /**
   * 由子组件回传 signal pane DOM 引用，供滚动定位与读状态上报使用。
   *
   * 登录/返回聊天页场景：频道在页面挂载前就已就绪，currentChannelId watcher
   * 不会触发；首次绑定面板时补记一次“进入频道待跳底”——消息已在缓存则直接
   * 完成，否则交给消息计数 watcher 在消息到达时完成。
   */
  function setSignalPaneRef(el: HTMLElement | null): void {
    signalPaneRef.value = el;
    if (!el) return;
    const cid = deps.currentChannelId.value;
    if (!cid || cid === lastJumpedChannelId || pendingScrollToBottom) return;
    if (deps.currentMessageCount.value <= 0) {
      // 消息未加载：保持待跳底标记，消息到达时由计数 watcher 完成跳底。
      pendingScrollToBottom = true;
      return;
    }
    pendingScrollToBottom = true;
    void (async () => {
      await nextTick();
      // 等待期间可能已切频道，复查标记仍属于当前频道再跳。
      if (pendingScrollToBottom && deps.currentChannelId.value === cid) {
        finalizePendingScrollToBottom();
      }
    })();
  }

  /**
   * 判断消息面板是否已滚动到底部。
   */
  function isSignalAtBottom(): boolean {
    const el = signalPaneRef.value;
    if (!el) return true;
    const gap = el.scrollHeight - (el.scrollTop + el.clientHeight);
    return gap < AT_BOTTOM_GAP_PX;
  }

  /**
   * 尽力上报已读状态：当用户到达底部时认为已读。
   */
  function maybeReportReadState(): void {
    if (!isSignalAtBottom()) return;
    runAsyncTask(deps.reportCurrentReadState(), "chat_report_read_state_failed");
  }

  /**
   * 将消息面板滚动到底部，并隐藏“跳到底部”入口。
   */
  function scrollSignalToBottom(): void {
    const el = signalPaneRef.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    showJumpToBottom.value = false;
  }

  /**
   * 完成“待滚到底部”流程：滚动、清理标记、上报已读。
   */
  function finalizePendingScrollToBottom(): void {
    scrollSignalToBottom();
    pendingScrollToBottom = false;
    lastJumpedChannelId = deps.currentChannelId.value;
    startStickToBottom();
    maybeReportReadState();
  }

  /**
   * 加载更早一页消息，同时保持滚动位置稳定。
   */
  async function handleLoadMoreMessages(): Promise<void> {
    const el = signalPaneRef.value;
    if (!el) {
      await deps.loadMoreMessages();
      return;
    }
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;
    await deps.loadMoreMessages();
    await nextTick();
    const nextHeight = el.scrollHeight;
    const delta = nextHeight - prevHeight;
    el.scrollTop = prevTop + delta;
  }

  /**
   * 滚动处理：到达顶部时自动加载更早历史消息。
   */
  function handleSignalScroll(): void {
    const el = signalPaneRef.value;
    if (!el) return;
    showJumpToBottom.value = !isSignalAtBottom();
    maybeReportReadState();
    if (!deps.currentChannelHasMore.value || deps.loadingMoreMessages.value) return;
    if (el.scrollTop > TOP_AUTO_LOAD_THRESHOLD_PX) return;
    const now = Date.now();
    if (now - lastAutoLoadAt < AUTO_LOAD_COOLDOWN_MS) return;
    lastAutoLoadAt = now;
    runAsyncTask(handleLoadMoreMessages(), "chat_load_more_messages_failed");
  }

  /**
   * “跳到底部”按钮处理。
   */
  function handleJumpToBottom(): void {
    scrollSignalToBottom();
    startStickToBottom();
    maybeReportReadState();
  }

  /**
   * 窗口聚焦处理：当用户返回且处于底部时，尽力标记为已读。
   */
  function handleWindowFocus(): void {
    maybeReportReadState();
  }

  /**
   * 页面可见性处理：从后台切回可见时，尽力标记为已读。
   */
  function handleVisibilityChange(): void {
    if (document.visibilityState !== "visible") return;
    maybeReportReadState();
  }

  async function onChannelChanged(): Promise<void> {
    // 切换频道：取消上一频道的贴底吸附与“自己发送跳底”请求，避免过期行为干扰新频道。
    cancelStickToBottom();
    pendingOwnSendScroll = false;
    pendingScrollToBottom = true;
    await nextTick();
    if (!pendingScrollToBottom) return;
    if (deps.currentMessageCount.value <= 0) return;
    finalizePendingScrollToBottom();
  }

  /**
   * 自己发送消息后的跳底通知。
   *
   * 时序说明：消息在发送结果返回前就已入列（appendMessageIfMissing 先于 resolve），
   * 计数 watcher 可能先于本通知执行并因“不在底部”而只显示跳底按钮；
   * 因此这里在 nextTick 后补一次强制跳底。若 watcher 尚未消费标记（消息晚于通知入列），
   * 则由 watcher 的强制分支完成跳底，此处直接退出，避免重复滚动。
   */
  async function notifyOwnMessageSent(): Promise<void> {
    pendingOwnSendScroll = true;
    await nextTick();
    if (!pendingOwnSendScroll) return;
    pendingOwnSendScroll = false;
    if (deps.currentMessageCount.value <= 0) return;
    scrollSignalToBottom();
    startStickToBottom();
    maybeReportReadState();
  }

  async function handlePendingScrollOnMessageCount(nextCount: number): Promise<boolean> {
    if (!pendingScrollToBottom) return false;
    if (nextCount <= 0) return true;
    await nextTick();
    finalizePendingScrollToBottom();
    return true;
  }

  async function handleIncrementalMessageAppend(nextCount: number, prevCount: number): Promise<void> {
    if (nextCount <= prevCount) return;
    if (pendingOwnSendScroll) {
      // 自己发送的消息已入列：无论用户当前滚动到何处，都直接跳到最底部。
      pendingOwnSendScroll = false;
      await nextTick();
      scrollSignalToBottom();
      startStickToBottom();
      maybeReportReadState();
      return;
    }
    if (!isSignalAtBottom()) {
      showJumpToBottom.value = true;
      return;
    }
    await nextTick();
    scrollSignalToBottom();
    // 登录后首屏 / 停在底部时的追加：同样吸附，等待虚拟列表实测高度稳定。
    startStickToBottom();
    maybeReportReadState();
  }

  async function onMessageCountChanged(nextCount: number, prevCount: number): Promise<void> {
    const el = signalPaneRef.value;
    if (!el) return;
    if (await handlePendingScrollOnMessageCount(nextCount)) return;
    await handleIncrementalMessageAppend(nextCount, prevCount);
  }

  watch(
    () => deps.currentChannelId.value,
    onChannelChanged,
  );

  watch(
    () => deps.currentMessageCount.value,
    onMessageCountChanged,
  );

  // 组件卸载时清理贴底吸附轮询，避免悬挂定时器。
  onScopeDispose(cancelStickToBottom);

  return {
    signalPaneRef,
    showJumpToBottom,
    setSignalPaneRef,
    handleSignalScroll,
    handleLoadMoreMessages,
    handleJumpToBottom,
    notifyOwnMessageSent,
    maybeReportReadState,
    handleWindowFocus,
    handleVisibilityChange,
  };
}
