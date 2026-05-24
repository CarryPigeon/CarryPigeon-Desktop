/**
 * @fileoverview httpChannelDiscoveryApi.ts
 * @description 频道发现｜HTTP 实现。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import type { ChatChannelDiscoveryApi } from "../api";
import type { ChannelDiscoverPageWire } from "../api-types";

export function createHttpChannelDiscoveryApi(): ChatChannelDiscoveryApi {
  return {
    async discoverChannels(serverSocket, accessToken, query) {
      const client = createAuthedHttpJsonClient(serverSocket, accessToken);
      const q: string[] = [];
      if (query.q) q.push(`q=${encodeURIComponent(query.q)}`);
      if (query.cursor) q.push(`cursor=${encodeURIComponent(query.cursor)}`);
      if (query.limit != null) q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.min(50, Math.trunc(query.limit)))))}`);
      if (query.type) q.push(`type=${encodeURIComponent(query.type)}`);
      const path = `/channels/discover${q.length ? `?${q.join("&")}` : ""}`;
      return client.requestJson<ChannelDiscoverPageWire>("GET", path);
    },
  };
}
