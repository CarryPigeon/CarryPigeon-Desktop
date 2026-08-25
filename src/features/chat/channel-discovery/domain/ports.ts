/**
 * @fileoverview channel-discovery 领域端口。
 * @description
 * 发现列表的远端查询口，输入输出均为领域模型，不含 wire 字段。
 */

import type { ChannelDiscoverPage, ChannelDiscoverQuery } from "./contracts";

/**
 * 频道发现 HTTP/mock 适配端口。
 */
export type ChannelDiscoveryApiPort = {
  discoverChannels(
    serverSocket: string,
    accessToken: string,
    query: ChannelDiscoverQuery,
  ): Promise<ChannelDiscoverPage>;
};

/**
 * 发现列表本地投影写口。
 */
export type ChannelDiscoveryStatePort = {
  readQuery(): string;
  writeQuery(query: string): void;
  replacePage(page: ChannelDiscoverPage): void;
  appendPage(page: ChannelDiscoverPage): void;
  setLoading(loading: boolean): void;
  setError(error: string): void;
  markJoinRequested(channelId: string): void;
  readNextCursor(): string | undefined;
  readHasMore(): boolean;
  readLoading(): boolean;
};

/**
 * 当前登录会话读取口。
 */
export type ChannelDiscoveryScopePort = {
  getSocketAndValidToken(): Promise<[string | null, string | null]>;
};
