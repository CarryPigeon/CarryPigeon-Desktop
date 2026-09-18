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
 * 贴底吸附窗口：跳底动作完成后持续把视口钉在底部，直到高度稳定。
 *
 * 原因：消息列表是 @tanstack/vue-virtual 虚拟列表，行高先按 estimateSize 估算、
 * 渲染后再由 measureElement 实测修正。单次 `scrollTop = scrollHeight` 会在实测
 * 过程中随总高度变化而漂移，导致切频道/登录后并没有真正停在最新一条消息。
 *
 * 停止条件：scrollHeight 连续稳定若干 tick（高度收敛），或到达硬上限兜底，
 * 或用户产生真实滚动输入（wheel / touchstart / pointerdown）。
 */
const STICK_TICK_MS = 32;
/** 吸附“稳定即停”阈值：scrollHeight 连续稳定 5 个 tick（≈160ms）即认为高度收敛。 */
const STICK_STABLE_TICKS = 5;
/** 吸附硬上限：即使高度持续变化，超过该时长也强制停止，兜底防止无限吸附。 */
const STICK_MAX_DURATION_MS = 3000;
/** 用户真实输入事件：吸附期间任一触发即视为用户主动滚动，立即取消吸附。 */
const STICK_USER_INPUT_EVENTS = ["wheel", "touchstart", "pointerdown"] as const;

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
 *   避免单次滚动因估算高度漂移而偏离最新消息；用户真实滚动输入
 *   （wheel / touchstart / pointerdown）会立即解除吸附；
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
  /**
   * 贴底吸附状态：起始时间、轮询句柄、上一 tick 的 scrollHeight 与稳定计数，
   * 以及吸附期间挂在 signal pane 上的用户输入监听解绑函数。
   */
  let stickStartedAt = 0;
  let stickTimer: number | null = null;
  let stickLastHeight: number | null = null;
  let stickStableTicks = 0;
  let stickDetachInputListeners: (() => void) | null = null;

  /**
   * 移除吸附期间挂载的用户输入监听（wheel / touchstart / pointerdown）。
   */
  function detachStickInputListeners(): void {
    stickDetachInputListeners?.();
    stickDetachInputListeners = null;
  }

  /**
   * 在 signal pane 上挂载用户输入监听：吸附期间用户产生任何真实滚动输入
   * （滚轮、触摸、指针按下）即立即取消吸附。
   *
   * 用捕获阶段监听，避免被子元素 stopPropagation 拦截；解绑函数保存下来，
   * 在吸附结束（取消/稳定/超时）与组件卸载时移除。
   */
  function attachStickInputListeners(el: HTMLElement): void {
    if (stickDetachInputListeners) return;
    const onUserInput = (): void => {
      // 用户主动滚动：立即解除贴底吸附。
      cancelStickToBottom();
    };
    const removers: Array<() => void> = [];
    for (const type of STICK_USER_INPUT_EVENTS) {
      el.addEventListener(type, onUserInput, { capture: true });
      removers.push(() => el.removeEventListener(type, onUserInput, { capture: true }));
    }
    stickDetachInputListeners = () => {
      for (const remove of removers) remove();
    };
  }

  /**
   * 取消贴底吸附（切频道、吸附结束或用户真实输入滚动时调用）。
   */
  function cancelStickToBottom(): void {
    stickStartedAt = 0;
    stickLastHeight = null;
    stickStableTicks = 0;
    if (stickTimer !== null) {
      // 用全局 clearTimeout 而非 window.clearTimeout：测试环境 jsdom teardown 后
      // window 标识符被移除，残留的吸附定时器若访问 window 会抛 ReferenceError；
      // 生产行为与 window.clearTimeout 完全一致。
      clearTimeout(stickTimer);
      stickTimer = null;
    }
    detachStickInputListeners();
  }

  /**
   * 在吸附窗口内反复把视口钉在底部，直到实测高度稳定或用户主动滚动。
   *
   * 稳定即停：每个 tick 记录 scrollHeight，与上一 tick 相同则稳定计数 +1，
   * 连续稳定 STICK_STABLE_TICKS 个 tick 即认为虚拟列表实测行高已收敛，停止吸附；
   * 高度变化则重置计数并继续钉底。同时设置 STICK_MAX_DURATION_MS 硬上限兜底。
   *
   * 注意：不能用“scrollTop 减小”识别用户上滚——虚拟列表行高实测修正会改变
   * 总高度并触发浏览器/虚拟列表程序性下调 scrollTop，该启发式会误取消吸附，
   * 导致打开多历史消息的频道时视口停在历史位置。用户输入识别完全交给
   * attachStickInputListeners 挂载的真实输入事件监听。
   */
  function startStickToBottom(): void {
    stickStartedAt = Date.now();
    stickLastHeight = null;
    stickStableTicks = 0;
    const el = signalPaneRef.value;
    if (el) attachStickInputListeners(el);
    if (stickTimer !== null) return;
    const tick = (): void => {
      stickTimer = null;
      const pane = signalPaneRef.value;
      if (!pane || stickStartedAt === 0) return;
      // 面板可能在吸附开始后才绑定：补挂用户输入监听。
      attachStickInputListeners(pane);
      pane.scrollTop = pane.scrollHeight;
      const height = pane.scrollHeight;
      stickStableTicks =
        stickLastHeight !== null && height === stickLastHeight ? stickStableTicks + 1 : 0;
      stickLastHeight = height;
      if (stickStableTicks >= STICK_STABLE_TICKS) {
        // 高度已稳定：结束吸附并清理用户输入监听。
        cancelStickToBottom();
        return;
      }
      if (Date.now() - stickStartedAt > STICK_MAX_DURATION_MS) {
        // 硬上限兜底：高度长时间不稳定也强制结束。
        cancelStickToBottom();
        return;
      }
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
