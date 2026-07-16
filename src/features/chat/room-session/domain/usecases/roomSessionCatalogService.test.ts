import { describe, it, expect, vi } from "vitest";
import { RoomSessionCatalogApplicationService } from "./roomSessionCatalogService";
import type { ChatChannel } from "@/features/chat/room-session/domain/contracts";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";

function makeChannel(id: string, unread: number): ChatChannel {
  return {
    id,
    name: id,
    brief: "",
    unread,
    joined: true,
    joinRequested: false,
  } as unknown as ChatChannel;
}

function makeService(opts: {
  channels: ChatChannel[];
  unreads: Array<{ channelId: string; unreadCount: number; lastReadTime: number }>;
  timelineByCid: Record<string, ChatMessage[]>;
  markerByCid: Record<string, { lastReadTimeMs: number; lastReadMessageId: string }>;
}) {
  const channelsRef: ChatChannel[] = [];
  const api = {
    listChannels: vi.fn(async () => opts.channels),
    getUnreads: vi.fn(async () => opts.unreads),
  };
  const scope = {
    getActiveServerSocket: () => "sock",
    getActiveScopeVersion: () => 1,
    getSocketAndValidToken: async () => ["sock", "token"] as [string, string],
  };
  const directoryState = {
    replaceChannels: (next: readonly ChatChannel[]) => {
      channelsRef.length = 0;
      channelsRef.push(...next);
    },
  };
  const readMarkerState = {
    writeLastReadTimeMs: vi.fn(),
    readLastReadTimeMs: (cid: string) => opts.markerByCid[cid]?.lastReadTimeMs ?? 0,
    readLastReadMessageId: (cid: string) => opts.markerByCid[cid]?.lastReadMessageId ?? "",
  };
  const messageCache = {
    listMessages: (cid: string) => opts.timelineByCid[cid] ?? [],
  };
  const service = new RoomSessionCatalogApplicationService({
    api: api as any,
    scope: scope as any,
    directoryState: directoryState as any,
    readMarkerState: readMarkerState as any,
    messageCache: messageCache as any,
  });
  return { service, channelsRef };
}

function timeline(ids: string[], baseTime = 100): ChatMessage[] {
  return ids.map((id, i) => ({ id, timeMs: baseTime + i } as unknown as ChatMessage));
}

describe("RoomSessionCatalogApplicationService.refreshChannels unread override", () => {
  it("overrides server unread with local recompute when timeline is loaded", async () => {
    // 服务端说 c1 有 3 条未读，但本地时间线全部在已读标记之前 -> 应显示为 0
    const { service, channelsRef } = makeService({
      channels: [makeChannel("c1", 0)],
      unreads: [{ channelId: "c1", unreadCount: 3, lastReadTime: 1000 }],
      timelineByCid: { c1: timeline(["a", "b", "c"], 100) },
      markerByCid: { c1: { lastReadTimeMs: 1000, lastReadMessageId: "z" } },
    });
    await service.refreshChannels();
    expect(channelsRef[0].unread).toBe(0);
  });

  it("keeps server unread when no local timeline is available", async () => {
    const { service, channelsRef } = makeService({
      channels: [makeChannel("c1", 0)],
      unreads: [{ channelId: "c1", unreadCount: 3, lastReadTime: 1000 }],
      timelineByCid: {}, // 未加载时间线
      markerByCid: {},
    });
    await service.refreshChannels();
    expect(channelsRef[0].unread).toBe(3);
  });

  it("counts only unread visible messages after the marker", async () => {
    // 4 条消息，标记在 id "b"(time 101)；id c/d 在之后 -> 2 条未读，且排除被撤回的
    const recalled = { id: "d", timeMs: 103, recalledAt: 50 } as unknown as ChatMessage;
    const { service, channelsRef } = makeService({
      channels: [makeChannel("c1", 0)],
      unreads: [{ channelId: "c1", unreadCount: 9, lastReadTime: 101 }],
      timelineByCid: { c1: [...timeline(["a", "b", "c"], 100), recalled] },
      markerByCid: { c1: { lastReadTimeMs: 101, lastReadMessageId: "b" } },
    });
    await service.refreshChannels();
    expect(channelsRef[0].unread).toBe(1); // only "c"
  });
});
