/**
 * @fileoverview tray-notification Feature 对外类型。
 * @description 跨 feature 若需要消费 tray-notification 的稳定能力，应优先依赖本文件导出的类型。
 */

import type { TrayStateSnapshot } from "./domain/model";

export type { TrayStateSnapshot };

/** tray-notification feature 对外稳定能力契约 */
export interface TrayNotificationCapabilities {
  /** 获取当前托盘状态快照 */
  getSnapshot(): TrayStateSnapshot;

  /** 订阅托盘状态变化 */
  observeSnapshot(observer: (snapshot: TrayStateSnapshot) => void): () => void;

  /** 同步托盘菜单语言 */
  setLocale(locale: string): Promise<void>;

  /** 关闭托盘通知弹窗 */
  dismissPopover(): Promise<void>;

  /** 获取运行时租约（控制生命周期） */
  acquireLease(): Promise<TrayNotificationLease>;
}

export interface TrayNotificationLease {
  release(): Promise<void>;
}
