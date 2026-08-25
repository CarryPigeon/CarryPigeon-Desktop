/**
 * @fileoverview 频道发现 application service。
 * @description
 * 负责搜索/分页编排与本地投影写入，不持有 Vue 状态。
 */

import { createLogger } from "@/shared/utils/logger";
import type { ChannelDiscoverQuery } from "../contracts";
import type { ChannelDiscoveryApiPort, ChannelDiscoveryScopePort, ChannelDiscoveryStatePort } from "../ports";

const logger = createLogger("channel-discovery");
const DEFAULT_LIMIT = 20;

/**
 * 频道发现 application service 依赖。
 */
export type ChannelDiscoveryApplicationServiceDeps = {
  api: ChannelDiscoveryApiPort;
  scope: ChannelDiscoveryScopePort;
  state: ChannelDiscoveryStatePort;
};

/**
 * 频道发现远端同步服务。
 */
export class ChannelDiscoveryApplicationService {
  private requestSeq = 0;

  constructor(private readonly deps: ChannelDiscoveryApplicationServiceDeps) {}

  /**
   * 按关键字重新拉取发现列表首页。
   */
  async search(query?: string): Promise<void> {
    const nextQuery = query === undefined ? this.deps.state.readQuery() : String(query ?? "").trim();
    this.deps.state.writeQuery(nextQuery);
    await this.loadPage({ query: nextQuery, limit: DEFAULT_LIMIT }, { append: false });
  }

  /**
   * 加载下一页发现结果。
   */
  async loadMore(): Promise<void> {
    if (this.deps.state.readLoading() || !this.deps.state.readHasMore()) return;
    const cursor = this.deps.state.readNextCursor();
    if (!cursor) return;
    await this.loadPage(
      { query: this.deps.state.readQuery(), cursor, limit: DEFAULT_LIMIT },
      { append: true },
    );
  }

  /**
   * 申请加入成功后，在发现列表本地标记“已发送申请”。
   */
  markJoinRequested(channelId: string): void {
    this.deps.state.markJoinRequested(channelId);
  }

  private async loadPage(query: ChannelDiscoverQuery, options: { append: boolean }): Promise<void> {
    const seq = ++this.requestSeq;
    this.deps.state.setLoading(true);
    this.deps.state.setError("");
    try {
      const [socket, token] = await this.deps.scope.getSocketAndValidToken();
      if (!socket || !token) {
        if (seq !== this.requestSeq) return;
        this.deps.state.replacePage({ items: [], hasMore: false });
        this.deps.state.setError("Not signed in.");
        return;
      }
      const page = await this.deps.api.discoverChannels(socket, token, query);
      if (seq !== this.requestSeq) return;
      if (options.append) this.deps.state.appendPage(page);
      else this.deps.state.replacePage(page);
    } catch (error) {
      logger.warn("Action: chat_channel_discover_failed", { error: String(error) });
      if (seq !== this.requestSeq) return;
      if (!options.append) this.deps.state.replacePage({ items: [], hasMore: false });
      this.deps.state.setError(error instanceof Error ? error.message : String(error));
    } finally {
      if (seq === this.requestSeq) this.deps.state.setLoading(false);
    }
  }
}
