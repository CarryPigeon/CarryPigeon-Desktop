import { expect, it, vi } from "vitest";
import { createReadStateEventRouter } from "./readStateEventRouter";

it("applies the current account’s MID in numeric order and refreshes the authoritative unread count", () => {
  let mid = "9007199254740993";
  const refreshChannelReadState = vi.fn();
  const route = createReadStateEventRouter({
    getCurrentUserId: () => "1",
    state: {
      readLastReadMessageId: () => mid,
      writeLastReadMessageId: (_cid, value) => { mid = value; },
    },
    refreshChannelReadState,
  });
  const event = (userId: string, lastReadMessageId: string) => route("read_state.updated", { channelId: "2001", userId, lastReadMessageId });
  event("2", "9007199254740995");
  event("1", "9007199254740992");
  expect(mid).toBe("9007199254740993");
  expect(refreshChannelReadState).not.toHaveBeenCalled();
  event("1", "9007199254740994");
  expect(mid).toBe("9007199254740994");
  expect(refreshChannelReadState).toHaveBeenCalledExactlyOnceWith("2001");
});
