/**
 * @fileoverview room-session 频道视图 application service。
 * @description
 * 统一封装频道切换、消息定位与读状态上报。
 *
 * 这个对象对应“当前频道视图”的用户动作面：
 * - 选频道
 * - 查消息
 * - 推进当前读状态
 */

import type { ChatReadStateReporterPort } from "@/features/chat/domain/ports/runtimePorts";
import type { ChatMessage } from "@/features/chat/message-flow/domain/contracts";
import type {
  ChannelSelectionErrorCode,
  ChannelSelectionErrorInfo,
  ChannelSelectionOutcome,
} from "@/features/chat/room-session/domain/contracts";
import type { RoomSessionStatePort } from "../ports";

/**
 * room-session 视图动作依赖的已读状态上报端口别名。
 */
export type ReadStateReporterPort = ChatReadStateReporterPort;

/**
 * `RoomSessionViewApplicationService` 的依赖集合。
 *
 * 这里只接受最小 state port，而不是完整 session store，
 * 目的是保持 application 层对底层状态实现无感。
 */
export type RoomSessionViewApplicationServiceDeps = {
  state: Pick<
    RoomSessionStatePort,
    | "findChannelById"
    | "readUnreadCount"
    | "markChannelReadLocally"
    | "incrementChannelUnread"
    | "setCurrentChannelId"
    | "readCurrentChannelId"
    | "listMessages"
    | "findMessageById"
    | "readLastReadTimeMs"
    | "writeLastReadMessageId"
    | "readLastReportAtMs"
  >;
  loadChannelMessages: (cid: string) => Promise<void>;
  refreshMembersRail: (cid: string) => Promise<void>;
  readStateReporter: ReadStateReporterPort;
};

/**
 * room-session 子域中负责“当前频道视图动作”的 application service。
 */
export class RoomSessionViewApplicationService {
  constructor(private readonly deps: RoomSessionViewApplicationServiceDeps) {}

  /**
   * 在给定频道里按消息 id 查找消息。
   */
  getMessageById(channelId: string, messageId: string): ChatMessage | null {
    return this.deps.state.findMessageById(channelId, messageId);
  }

  /**
   * 切换到某个频道，并驱动必要的后续动作。
   *
   * 执行顺序：
   * 1. 校验频道 id 是否合法
   * 2. 本地切换当前频道并清零未读数
   * 3. 拉取该频道的消息历史
   * 4. 异步刷新成员列表侧栏
   * 5. 在条件满足时推进并上报已读状态到服务器
   *
   * 错误处理说明：
   * - 所有预期内的业务失败都通过 Result 模式返回 { ok: false, error: ... }
   * - 使用 try-catch 捕获 loadChannelMessages 可能抛出的异常，不向上抛出
   * - 异常也会被包装成失败结果返回给调用方，由调用方处理上报
   * - 不会静默吞错，也不会让异常逃逸导致 Promise  rejected
   * - 拉取失败时会回滚未读数（恢复到切换前的状态）
   */
  async selectChannel(id: string): Promise<ChannelSelectionOutcome> {
    const cid = String(id).trim();
    if (!cid) {
      // 空频道 id -> 直接返回业务失败结果，不静默吞错
      return {
        ok: false,
        kind: "chat_channel_selection_rejected",
        error: this.createSelectionError("missing_channel_id", "Missing channel id."),
      };
    }
    const channel = this.deps.state.findChannelById(cid);
    if (!channel) {
      // 频道不存在 -> 返回业务失败结果，不静默吞错
      return {
        ok: false,
        kind: "chat_channel_selection_rejected",
        error: this.createSelectionError("channel_not_found", "Channel not found.", { channelId: cid }),
      };
    }

    this.deps.state.setCurrentChannelId(cid);
    const prevUnread = this.deps.state.readUnreadCount(cid);
    this.deps.state.markChannelReadLocally(cid);

    try {
      await this.deps.loadChannelMessages(cid);
    } catch (error) {
      // 拉取消息失败 -> 回滚未读数，返回失败结果给调用方处理
      // 不吞错，也不向上抛异常，保证调用方能够收到失败信息并上报
      if (prevUnread > 0) this.deps.state.incrementChannelUnread(cid, prevUnread);
      return {
        ok: false,
        kind: "chat_channel_selection_rejected",
        error: this.createSelectionError(
          "select_channel_failed",
          error instanceof Error ? error.message || "Select channel failed." : String(error) || "Select channel failed.",
          { channelId: cid },
        ),
      };
    }
    void this.deps.refreshMembersRail(cid);

    const list = this.deps.state.listMessages(cid);
    const last = list[list.length - 1];
    const lastMid = last?.id ? String(last.id) : "";
    if (!lastMid) {
      return {
        ok: true,
        kind: "chat_channel_selected",
        channelId: cid,
      };
    }

    const now = Date.now();
    const prevReadTime = this.deps.state.readLastReadTimeMs(cid);
    const nextReadTime = this.deps.readStateReporter.advanceLocalReadTime(cid, now);
    this.deps.state.writeLastReadMessageId(cid, lastMid);
    const lastReportAt = this.deps.state.readLastReportAtMs(cid);
    const shouldReport =
      (prevUnread > 0 || prevReadTime <= 0 || now - lastReportAt > 60_000) &&
      this.deps.readStateReporter.canReportNow(cid, now, 1500);
    if (!shouldReport) {
      return {
        ok: true,
        kind: "chat_channel_selected",
        channelId: cid,
      };
    }

    void this.deps.readStateReporter.reportIfAllowed(cid, lastMid, nextReadTime, now, 1500);
    return {
      ok: true,
      kind: "chat_channel_selected",
      channelId: cid,
    };
  }

  /**
   * 尽力上报当前频道的最后已读消息。
   *
   * 该动作不会抛业务异常，也不会要求调用方显式处理结果，
   * 因为它表达的是“best effort”的同步语义。
   */
  async reportCurrentReadState(): Promise<void> {
    const cid = this.deps.state.readCurrentChannelId();
    if (!cid) return;
    const list = this.deps.state.listMessages(cid);
    const last = list[list.length - 1] ?? null;
    const lastMid = last?.id ? String(last.id) : "";
    if (!lastMid) return;

    const now = Date.now();
    const nextReadTime = this.deps.readStateReporter.advanceLocalReadTime(cid, now);
    this.deps.state.writeLastReadMessageId(cid, lastMid);
    void this.deps.readStateReporter.reportIfAllowed(cid, lastMid, nextReadTime, now, 1500);
  }

  /**
   * 统一构造频道切换错误投影。
   */
  private createSelectionError(
    code: ChannelSelectionErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ChannelSelectionErrorInfo {
    return {
      code,
      message,
      retryable: code === "select_channel_failed",
      details,
    };
  }
}
