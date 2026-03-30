/**
 * @fileoverview Signal pane 视口编排（滚动、历史分页、已读上报）。
 * @description chat｜presentation composable：将消息面板交互细节从页面拆出。
 */

import { nextTick, ref, watch, type ComputedRef, type Ref } from "vue";
import { createAsyncTaskRunner } from "./asyncTaskRunner";

type CountRef = Ref<number> | ComputedRef<number>;
type BoolRef = Ref<boolean> | ComputedRef<boolean>;
type StringRef = Ref<string> | ComputedRef<string>;
const AT_BOTTOM_GAP_PX = 60;
const TOP_AUTO_LOAD_THRESHOLD_PX = 40;
const AUTO_LOAD_COOLDOWN_MS = 900;

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
  maybeReportReadState(): void;
  handleWindowFocus(): void;
  handleVisibilityChange(): void;
};

/**
 * 管理 signal pane 的滚动与已读上报行为。
 *
 * 说明：
 * - 切换频道后：首次消息到达时自动滚到底部；
 * - 向上滚动到顶部：按节流自动加载历史页；
 * - 位于底部时：尽力上报已读状态。
 */
export function useSignalViewport(deps: UseSignalViewportDeps): SignalViewportModel {
  const signalPaneRef = ref<HTMLElement | null>(null);
  const showJumpToBottom = ref(false);

  let lastAutoLoadAt = 0;
  let pendingScrollToBottom = false;

  const runAsyncTask = createAsyncTaskRunner(deps.onAsyncError);

  /**
   * 由子组件回传 signal pane DOM 引用，供滚动定位与读状态上报使用。
   */
  function setSignalPaneRef(el: HTMLElement | null): void {
    signalPaneRef.value = el;
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
    pendingScrollToBottom = true;
    await nextTick();
    if (!pendingScrollToBottom) return;
    if (deps.currentMessageCount.value <= 0) return;
    finalizePendingScrollToBottom();
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
    if (!isSignalAtBottom()) {
      showJumpToBottom.value = true;
      return;
    }
    await nextTick();
    scrollSignalToBottom();
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

  return {
    signalPaneRef,
    showJumpToBottom,
    setSignalPaneRef,
    handleSignalScroll,
    handleLoadMoreMessages,
    handleJumpToBottom,
    maybeReportReadState,
    handleWindowFocus,
    handleVisibilityChange,
  };
}
