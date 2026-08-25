/**
 * @fileoverview 提及收件箱 application service。
 * @description
 * 编排 GET/PUT mentions，并维护本地已读投影。点击进入频道，不请求 around_mid。
 */

import { createLogger } from "@/shared/utils/logger";
import type { MentionInboxApiPort, MentionInboxNavigationPort, MentionInboxScopePort, MentionInboxStatePort } from "../ports";

const logger = createLogger("mention-inbox");
const PAGE_LIMIT = 50;

export type MentionInboxApplicationServiceDeps = {
  api: MentionInboxApiPort;
  scope: MentionInboxScopePort;
  state: MentionInboxStatePort;
  navigation: MentionInboxNavigationPort;
};

/**
 * 提及收件箱远端同步服务。
 */
export class MentionInboxApplicationService {
  constructor(private readonly deps: MentionInboxApplicationServiceDeps) {}

  /**
   * 刷新收件箱列表与未读计数。
   */
  async refresh(): Promise<void> {
    const session = await this.deps.scope.getSocketAndValidToken();
    if (!session[0] || !session[1]) {
      this.deps.state.replaceItems([]);
      this.deps.state.setUnreadCount(0, false);
      return;
    }
    const [socket, token] = session;
    this.deps.state.setLoading(true);
    this.deps.state.setError("");
    try {
      const [page, unreadPage] = await Promise.all([
        this.deps.api.listMentions(socket, token, { limit: PAGE_LIMIT, unreadOnly: false }),
        this.deps.api.listMentions(socket, token, { limit: PAGE_LIMIT, unreadOnly: true }),
      ]);
      this.deps.state.replaceItems(page.items, page.nextCursor, page.hasMore);
      this.deps.state.setUnreadCount(unreadPage.items.length, Boolean(unreadPage.hasMore));
    } catch (error) {
      logger.warn("Action: chat_mention_inbox_refresh_failed", { error: String(error) });
      this.deps.state.setError(error instanceof Error ? error.message : String(error));
    } finally {
      this.deps.state.setLoading(false);
    }
  }

  /**
   * 标记单条已读。
   */
  async markRead(mentionId: string): Promise<void> {
    const id = String(mentionId ?? "").trim();
    if (!id) return;
    const session = await this.deps.scope.getSocketAndValidToken();
    if (!session[0] || !session[1]) return;
    this.deps.state.markLocalRead(id);
    try {
      await this.deps.api.markMentionRead(session[0], session[1], id);
      await this.refresh();
    } catch (error) {
      logger.warn("Action: chat_mention_mark_read_failed", { error: String(error), mentionId: id });
      await this.refresh();
    }
  }

  /**
   * 批量标记全部已读。
   */
  async markAllRead(): Promise<void> {
    const session = await this.deps.scope.getSocketAndValidToken();
    if (!session[0] || !session[1]) return;
    this.deps.state.markAllLocalRead();
    try {
      await this.deps.api.batchMarkMentionsRead(session[0], session[1]);
      await this.refresh();
    } catch (error) {
      logger.warn("Action: chat_mention_mark_all_read_failed", { error: String(error) });
      await this.refresh();
    }
  }

  /**
   * 打开一条提及：先标已读，再进入对应频道。
   *
   * 不调用 `around_mid` / 上下文定位，避免服务端已知 SQL 500。
   */
  async openMention(mentionId: string): Promise<void> {
    const item = this.deps.state.findItem(mentionId);
    await this.markRead(mentionId);
    const channelId = String(item?.channelId ?? "").trim();
    if (!channelId) return;
    await this.deps.navigation.selectChannel(channelId);
  }
}
