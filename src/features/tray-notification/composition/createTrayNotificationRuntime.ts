/**
 * @fileoverview tray-notification 运行时装配。
 * @description 将端口实现与外部依赖注入组装为完整的托盘通知运行时。
 */

import { watch, type WatchStopHandle } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";
import { IS_MOCK_ENABLED } from "@/shared/config/runtime";
import { createLogger } from "@/shared/utils/logger";
import type { TrayNotificationPorts } from "../domain/ports";
import type { UnreadPreview, TrayStateSnapshot, NotificationContext } from "../domain/model";
import { decideNotification } from "../domain/model";
import type { TrayNotificationCapabilities, TrayNotificationLease } from "../api-types";

const logger = createLogger("trayNotificationRuntime");
const MAX_PREVIEW_COUNT = 4;

export interface TrayNotificationDependencies {
  /** 未读总数 observable */
  unreadCount: { value: number };
  /** 获取未读消息预览 */
  getUnreadPreviews(maxCount: number): UnreadPreview[];
  /** 新消息事件处理器注册 */
  onNewMessage?: (handler: (channelId: string, message: unknown) => void) => () => void;
  /** 桌面通知开关 */
  getDesktopNotificationsEnabled?(): Promise<boolean>;
  /** 当前频道 ID */
  getCurrentChannelId?(): string;
  /** 当前用户 ID */
  getCurrentUserId?(): string;
  /** 频道通知偏好 */
  getChannelNotificationPreference?(channelId: string): Promise<"all" | "mentions_only" | "muted">;
  /** 频道名称 */
  getChannelName?(channelId: string): string;
  /** 窗口聚焦状态 */
  isWindowFocused?(): Promise<boolean>;
  /** 跳转到频道 */
  selectChannel?(channelId: string): Promise<unknown>;
  /** 存储的 locale */
  getStoredLocale?(): string | null;
  /** 持久化 locale */
  setStoredLocale?(locale: string): void;
}

export function createTrayNotificationRuntime(
  ports: TrayNotificationPorts,
  deps: TrayNotificationDependencies,
): TrayNotificationCapabilities {
  if (!isTauriRuntimeAvailable() || IS_MOCK_ENABLED) {
    return createStubCapabilities();
  }

  // --- 内部状态 ---
  let isRunning = false;
  let leaseCount = 0;
  let stopHandles: (() => void)[] = [];

  const state = {
    hasUnread: false,
    isFlashing: false,
    popoverOpen: false,
    unreadPreviewCount: 0,
  };
  const observers = new Set<(s: TrayStateSnapshot) => void>();

  function emitSnapshot() {
    const snap: TrayStateSnapshot = { ...state };
    for (const ob of observers) {
      ob(snap);
    }
  }

  // --- 未读闪烁同步（从 trayUnreadBridge 提取） ---
  function startUnreadFlashing(): WatchStopHandle | null {
    let lastState: boolean | null = null;
    return watch(
      () => deps.unreadCount.value > 0,
      (hasUnread) => {
        if (hasUnread === lastState) return;
        lastState = hasUnread;
        state.hasUnread = hasUnread;
        emitSnapshot();
        void ports.flashing.setFlashing(hasUnread);
      },
      { immediate: true },
    );
  }

  // --- 悬停弹窗（从 trayHoverBridge 提取） ---
  async function startHoverListener(): Promise<() => void> {
    const unlisteners: UnlistenFn[] = [];

    const unlistenHover = await listen<{ x: number; y: number }>("tray-hover-settled", async (event) => {
      const previews = deps.getUnreadPreviews(MAX_PREVIEW_COUNT);
      if (previews.length === 0) return;

      state.popoverOpen = true;
      state.unreadPreviewCount = previews.length;
      emitSnapshot();

      await ports.popover.openPopover(event.payload, previews);
    });
    unlisteners.push(unlistenHover);

    const unlistenJump = await listen<{ channelId: string }>("jump-to-channel", async (event) => {
      if (deps.selectChannel) {
        try {
          await deps.selectChannel(event.payload.channelId);
        } catch (err) {
          logger.warn("Action: chat_jump_channel_failed", { error: String(err) });
        }
      }
    });
    unlisteners.push(unlistenJump);

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }

  // --- 桌面通知（从 notificationBridge 提取） ---
  function startNotificationHandler(): (() => void) | undefined {
    if (!deps.onNewMessage) return undefined;

    interface IncomingMessage {
      mentions?: Array<{ userId: string; type: string }>;
      from?: { name?: string };
      kind?: string;
      text?: string;
      preview?: string;
      id?: string;
    }

    return deps.onNewMessage(async (channelId: string, message: unknown) => {
      try {
        const desktopEnabled = deps.getDesktopNotificationsEnabled
          ? await deps.getDesktopNotificationsEnabled()
          : true;

        if (!desktopEnabled) return;

        let focused = true;
        if (deps.isWindowFocused) {
          try {
            focused = await deps.isWindowFocused();
          } catch (err) {
            logger.debug("Action: chat_window_focused_check_failed", { error: String(err) });
          }
        }

        const currentCid = deps.getCurrentChannelId?.() ?? "";
        let preference: "all" | "mentions_only" | "muted" = "all";
        if (deps.getChannelNotificationPreference) {
          try {
            preference = await deps.getChannelNotificationPreference(channelId);
          } catch (err) {
            logger.debug("Action: chat_channel_preference_fetch_failed", { error: String(err) });
          }
        }

        const currentUserId = deps.getCurrentUserId?.() ?? "";
        const msg = message as IncomingMessage;
        const isMentioned =
          msg.mentions != null &&
          msg.mentions.some(
            (m) => m.userId === currentUserId || m.type === "everyone" || m.type === "here",
          );

        const ctx: NotificationContext = {
          isAppFocused: focused,
          notificationPreference: preference,
          hasMention: isMentioned,
          isCurrentChannel: channelId === currentCid,
        };

        const decision = decideNotification(ctx);
        if (!decision.shouldNotify) {
          logger.debug("Action: chat_notification_skipped", { reason: decision.reason });
          return;
        }

        const channelName = deps.getChannelName?.(channelId) ?? channelId;
        const senderName = msg.from?.name ?? "Unknown";
        const msgText = msg.text ?? "";
        const previewText = msg.preview ?? msgText;
        const title = `${senderName} · #${channelName}`;
        const body = previewText.length > 100 ? previewText.slice(0, 100) + "..." : previewText;

        await ports.desktopNotification.send({
          title,
          body,
          channelId,
          messageId: msg.id ?? "",
        });
      } catch (e) {
        logger.error("Action: chat_notification_handle_failed", { error: String(e) });
      }
    });
  }

  // --- locale 同步（从 trayLocaleBridge 提取） ---
  function syncLocaleOnStartup(): void {
    const stored = deps.getStoredLocale?.();
    if (!stored) return;
    void ports.locale.setLocale(stored);
  }

  // --- capabilities 实现 ---
  function start() {
    if (isRunning) return;
    isRunning = true;

    // 同步语言
    syncLocaleOnStartup();

    // 订阅未读计数
    const unreadStop = startUnreadFlashing();
    if (unreadStop) stopHandles.push(unreadStop);

    // 监听悬停事件
    void startHoverListener().then((unlisten) => {
      stopHandles.push(unlisten);
    }).catch((err) => {
      logger.error("Action: chat_hover_listener_start_failed", { error: String(err) });
    });

    // 处理桌面通知
    const notificationStop = startNotificationHandler();
    if (notificationStop) stopHandles.push(notificationStop);
  }

  function stop() {
    isRunning = false;
    for (const handle of stopHandles) {
      try {
        handle();
      } catch (err) {
        logger.debug("Action: chat_stop_handle_cleanup_failed", { error: String(err) });
      }
    }
    stopHandles = [];
    void ports.flashing.clearFlashing();
  }

  return {
    getSnapshot(): TrayStateSnapshot {
      return { ...state };
    },

    observeSnapshot(observer): () => void {
      observers.add(observer);
      return () => {
        observers.delete(observer);
      };
    },

    async setLocale(locale: string): Promise<void> {
      deps.setStoredLocale?.(locale);
      await ports.locale.setLocale(locale);
    },

    async dismissPopover(): Promise<void> {
      state.popoverOpen = false;
      emitSnapshot();
      await ports.popover.closePopover();
    },

    async acquireLease(): Promise<TrayNotificationLease> {
      leaseCount++;
      if (leaseCount === 1) {
        start();
      }
      let released = false;
      return {
        async release(): Promise<void> {
          if (released) return;
          released = true;
          leaseCount = Math.max(0, leaseCount - 1);
          if (leaseCount === 0) {
            stop();
          }
        },
      };
    },
  };
}

function createStubCapabilities(): TrayNotificationCapabilities {
  const snapshot: TrayStateSnapshot = {
    hasUnread: false,
    isFlashing: false,
    popoverOpen: false,
    unreadPreviewCount: 0,
  };
  const observers = new Set<(s: TrayStateSnapshot) => void>();

  return {
    getSnapshot() {
      return { ...snapshot };
    },
    observeSnapshot(observer) {
      observers.add(observer);
      return () => {
        observers.delete(observer);
      };
    },
    async setLocale(_locale: string) {},
    async dismissPopover() {},
    async acquireLease() {
      return {
        async release() {},
      };
    },
  };
}
