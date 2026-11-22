import { describe, expect, it, vi } from "vitest";
import { RoomSessionCatalogApplicationService } from "./roomSessionCatalogService";
import type { ChatChannel } from "@/features/chat/room-session/domain/contracts";

function fixture() {
  let channels: readonly ChatChannel[] = [];
  const api = {
    listChannels: vi.fn(async () => [{ id: "2001", name: "General" }, { id: "2002", name: "Updates" }]),
    getUnreads: vi.fn(async () => [{ channelId: "2001", unreadCount: 9 }]),
    getChannelReadState: vi.fn(async () => ({ channelId: "2001", userId: "1", lastReadMid: "9007199254740994", unreadCount: 2 })),
  };
  let mid = "9007199254740993";
  const directoryState = {
    listChannels: () => channels,
    replaceChannels: (next: readonly ChatChannel[]) => { channels = next; },
    readUnreadCount: (cid: string) => channels.find((entry) => entry.id === cid)?.unread ?? 0,
    incrementChannelUnread: (cid: string, delta: number) => {
      channels = channels.map((entry) => entry.id === cid ? { ...entry, unread: entry.unread + delta } : entry);
    },
  };
  const service = new RoomSessionCatalogApplicationService({
    api,
    scope: {
      getActiveServerSocket: () => "socket",
      getActiveScopeVersion: () => 1,
      getSocketAndValidToken: async () => ["socket", "token"],
    },
    directoryState,
    readMarkerState: {
      readLastReadMessageId: () => mid,
      writeLastReadMessageId: (_cid: string, value: string) => { mid = value; },
    } as ConstructorParameters<typeof RoomSessionCatalogApplicationService>[0]["readMarkerState"],
  });
  return { api, service, channels: () => channels, marker: () => mid };
}

describe("RoomSessionCatalogApplicationService", () => {
  it("uses aggregate counts for joined channels and defaults missing channels to zero", async () => {
    const f = fixture();
    await f.service.refreshChannels();
    expect(f.channels()).toEqual([
      expect.objectContaining({ id: "2001", joined: true, unread: 9 }),
      expect.objectContaining({ id: "2002", joined: true, unread: 0 }),
    ]);
    expect(f.api.getChannelReadState).not.toHaveBeenCalled();
  });

  it("preserves counts after a failed aggregate fetch", async () => {
    const f = fixture();
    await f.service.refreshChannels();
    f.api.getUnreads.mockRejectedValueOnce(new Error("offline"));
    await f.service.refreshChannels();
    expect(f.channels()[0].unread).toBe(9);
  });

  it("applies authoritative channel state without regressing the MID", async () => {
    const f = fixture();
    await f.service.refreshChannels();
    await f.service.refreshChannelReadState("2001");
    expect(f.marker()).toBe("9007199254740994");
    expect(f.channels()[0].unread).toBe(2);
    f.api.getChannelReadState.mockResolvedValueOnce({ channelId: "2001", userId: "1", lastReadMid: "9007199254740993", unreadCount: 15 });
    await f.service.refreshChannelReadState("2001");
    expect(f.marker()).toBe("9007199254740994");
    expect(f.channels()[0].unread).toBe(2);
  });
});
