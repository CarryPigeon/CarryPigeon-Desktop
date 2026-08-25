/**
 * @fileoverview channel-discovery wire types。
 * @description 仅 data 适配器使用的 snake_case 传输结构。
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
