/**
 * @fileoverview channel-discovery api types
 * @description 频道发现｜wire types。
 */

export type ChannelDiscoverItemWire = {
  cid: string;
  name: string;
  brief?: string;
  avatar?: string;
  member_count: number;
  requires_application: boolean;
  type?: string;
};

export type ChannelDiscoverPageWire = {
  items: ChannelDiscoverItemWire[];
  next_cursor?: string;
  has_more?: boolean;
};

export type ChannelDiscoverQueryWire = {
  q?: string;
  cursor?: string;
  limit?: number;
  type?: string;
};
