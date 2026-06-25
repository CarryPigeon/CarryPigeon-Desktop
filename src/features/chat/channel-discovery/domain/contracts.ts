/**
 * @fileoverview channel-discovery 领域契约。
 * @description
 * 频道发现子域的领域模型，与传输层无关。
 */

export type ChannelDiscoverItem = {
  channelId: string;
  name: string;
  brief?: string;
  avatar?: string;
  memberCount: number;
  requiresApplication: boolean;
  type?: string;
};

export type ChannelDiscoverPage = {
  items: ChannelDiscoverItem[];
  nextCursor?: string;
  hasMore?: boolean;
};

export type ChannelDiscoverQuery = {
  query?: string;
  cursor?: string;
  limit?: number;
  type?: string;
};
