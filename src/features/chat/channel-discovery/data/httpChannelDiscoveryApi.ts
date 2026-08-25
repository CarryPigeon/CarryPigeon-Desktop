/**
 * @fileoverview httpChannelDiscoveryApi.ts
 * @description 频道发现｜HTTP 实现。请求与响应在本层完成 wire ↔ 领域映射。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import type { ChannelDiscoverPageWire } from "./channelDiscoveryWire";
import { mapChannelDiscoverPageWire } from "./channelDiscoveryMappers";
import type { ChannelDiscoveryApiPort } from "../domain/ports";

/**
 * 创建真实 HTTP 频道发现适配器。
 */
export function createHttpChannelDiscoveryApi(): ChannelDiscoveryApiPort {
  return {
    async discoverChannels(serverSocket, accessToken, query) {
      const client = createAuthedHttpJsonClient(serverSocket, accessToken);
      const q: string[] = [];
      const keyword = String(query.query ?? "").trim();
      if (keyword) q.push(`q=${encodeURIComponent(keyword)}`);
      if (query.cursor) q.push(`cursor=${encodeURIComponent(query.cursor)}`);
      if (query.limit != null) q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.min(50, Math.trunc(query.limit)))))}`);
      if (query.type) q.push(`type=${encodeURIComponent(query.type)}`);
      const path = `/channels/discover${q.length ? `?${q.join("&")}` : ""}`;
      const wire = await client.requestJson<ChannelDiscoverPageWire>("GET", path);
      return mapChannelDiscoverPageWire(wire);
    },
  };
}
