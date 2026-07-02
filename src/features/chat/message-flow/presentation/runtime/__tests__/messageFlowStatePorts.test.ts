import { describe, it, expect } from "vitest";
import { ref, reactive } from "vue";
import { createMessageTimelineStatePort } from "../messageFlowStatePorts";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";

function createTestMessage(id: string, timeMs: number): ChatMessage {
  return {
    id,
    kind: "core_text",
    from: { userId: "u1", name: "User" },
    timeMs,
    domain: { id: "Core:Text" },
    text: `msg-${id}`,
  } as unknown as ChatMessage;
}

function compareByTimeMs(a: ChatMessage, b: ChatMessage): number {
  return a.timeMs - b.timeMs;
}

function createPort() {
  const deps = {
    currentChannelId: ref("ch1"),
    messagesByChannel: reactive<Record<string, ChatMessage[]>>({}),
    nextCursorByChannel: reactive<Record<string, string>>({}),
    hasMoreByChannel: reactive<Record<string, boolean>>({}),
    loadingMoreByChannel: reactive<Record<string, boolean>>({}),
    searchState: ref({
      query: "",
      loading: false,
      error: "",
      results: [],
      serverResults: [],
      searchScope: "channel" as const,
    }),
    highlightedMessageId: ref(""),
    serverSearchResults: ref([]),
    searchScope: ref<"channel" | "server">("channel"),
  };
  return { port: createMessageTimelineStatePort(deps), deps };
}

describe("createMessageTimelineStatePort", () => {
  it("replaces timeline messages", () => {
    const { port } = createPort();
    const messages = [createTestMessage("a", 1), createTestMessage("b", 2)];
    port.replaceTimeline("ch1", messages);
    expect(port.listMessages("ch1")).toHaveLength(2);
    expect(port.listMessages("ch1")[0].id).toBe("a");
  });

  it("appends missing message and keeps sorted order", () => {
    const { port } = createPort();
    port.replaceTimeline("ch1", [createTestMessage("a", 1), createTestMessage("c", 3)]);
    const added = port.appendMessageIfMissing("ch1", createTestMessage("b", 2), compareByTimeMs);
    expect(added).toBe(true);
    const list = port.listMessages("ch1");
    expect(list.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("skips duplicate messages", () => {
    const { port } = createPort();
    port.replaceTimeline("ch1", [createTestMessage("a", 1)]);
    const added = port.appendMessageIfMissing("ch1", createTestMessage("a", 2), compareByTimeMs);
    expect(added).toBe(false);
    expect(port.listMessages("ch1")).toHaveLength(1);
  });

  it("trims oldest messages when memory window is exceeded", () => {
    const { port } = createPort();
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 3005; i++) {
      messages.push(createTestMessage(`m${i}`, i));
    }
    port.replaceTimeline("ch1", messages);
    const list = port.listMessages("ch1");
    expect(list).toHaveLength(3000);
    expect(list[0].id).toBe("m5");
    expect(list[list.length - 1].id).toBe("m3004");
  });
});
