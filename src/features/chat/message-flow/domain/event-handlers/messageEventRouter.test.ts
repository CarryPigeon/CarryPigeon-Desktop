import { describe, expect, it, vi } from "vitest";
import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import { createMessageEventRouter } from "./messageEventRouter";
import { createMessageMapper } from "../mappers/messageModel";

const record: ChatMessageRecord = {
  id: "723155640365318144", channelId: "2001", userId: "1001", sentTime: 1700000000000,
  domain: "Core:Text", domainVersion: "1.0.0", data: { text: "Hello" },
};

function setup() {
  let resolve: (value: ChatMessageRecord) => void = () => undefined;
  const pending = new Promise<ChatMessageRecord>((done) => { resolve = done; });
  const loadMessage = vi.fn(() => pending);
  const append = vi.fn(() => true);
  const markRecalled = vi.fn();
  const notify = vi.fn();
  const unread = vi.fn();
  const recompute = vi.fn();
  let version = 0;
  const route = createMessageEventRouter({
    scope: { getActiveServerSocket: () => "host" }, getScopeVersion: () => version,
    loadMessage,
    timelineState: { readCurrentChannelId: () => "2002", appendMessageIfMissing: append, markMessageRecalled: markRecalled },
    unreadProjection: { incrementChannelUnread: unread, recomputeChannelUnreadLocally: recompute },
    mapWireMessage: createMessageMapper({ resolveDomainPluginHint: () => "" }).mapWireMessage,
    compareMessages: () => 0, onNewMessage: notify,
  });
  return { route, loadMessage, append, markRecalled, notify, unread, recompute, resolve, advanceScope: () => version++ };
}

const signal = { channelId: record.channelId, messageId: record.id, eventSequence: 42 };

describe("message WS signals", () => {
  it("hydrates an ID once and projects a notification only for a newly inserted message", async () => {
    const m = setup();
    m.route("message.created", signal);
    m.route("message.created", signal);
    expect(m.loadMessage).toHaveBeenCalledExactlyOnceWith(record.id);
    m.resolve(record);
    await vi.waitFor(() => expect(m.append).toHaveBeenCalledTimes(1));
    expect(m.notify).toHaveBeenCalledTimes(1);
    expect(m.unread).toHaveBeenCalledExactlyOnceWith("2001");
  });

  it("does not resurrect a message recalled while its detail was loading", async () => {
    const m = setup();
    m.route("message.created", signal);
    m.route("message.recalled", { ...signal, recalledAt: 1700000000001 });
    m.resolve(record);
    await vi.waitFor(() => expect(m.append).toHaveBeenCalledTimes(1));
    expect(m.append).toHaveBeenCalledWith("2001", expect.objectContaining({ recalledAt: 1700000000001 }), expect.any(Function));
    expect(m.markRecalled).toHaveBeenCalledExactlyOnceWith("2001", record.id, 1700000000001, "");
    expect(m.notify).not.toHaveBeenCalled();
    expect(m.unread).not.toHaveBeenCalled();
  });

  it("drops details returned after the account scope changed on the same server", async () => {
    const m = setup();
    m.route("message.created", signal);
    m.advanceScope();
    m.resolve(record);
    await Promise.resolve();
    expect(m.append).not.toHaveBeenCalled();
  });
});
