/**
 * @fileoverview channelMockService.ts 文件职责说明。
 */
import type { Message } from "@/features/chat/domain/types/Message";
import type { ChannelSummary } from "@/features/channels/data/channelApi";
import type { Member } from "@/features/user/domain/entities/Member";
import Avatar from "/test_avatar.jpg?url";
import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { addMessages } from "@/features/chat/presentation/store/messageList";

const serverState = new Map<string, MockServerState>();

type MockMessage = {
  mid: number;
  cid: number;
  uid: number;
  text: string;
  send_time: number;
};

type MockServerState = {
  channels: ChannelSummary[];
  discoverable: ChannelSummary[];
  members: Map<number, Member[]>;
  messages: Map<number, MockMessage[]>;
  seq: number;
};

/**
 * delay 方法说明。
 * @param ms - 参数说明。
 * @returns 返回值说明。
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * getState 方法说明。
 * @param socket - 参数说明。
 * @returns 返回值说明。
 */
function getState(socket: string): MockServerState {
  let state = serverState.get(socket);
  if (!state) {
    state = createDefaultState();
    serverState.set(socket, state);
  }
  return state;
}

/**
 * createDefaultState 方法说明。
 * @returns 返回值说明。
 */
function createDefaultState(): MockServerState {
  const channels: ChannelSummary[] = [
    { cid: 1001, name: "General", owner: 1, avatar: -1, brief: "Welcome to the General channel" },
    { cid: 1002, name: "Development", owner: 1, avatar: -1, brief: "Build notes & tech" },
    { cid: 1003, name: "Design", owner: 1, avatar: -1, brief: "UI & UX" },
  ];

  const discoverable: ChannelSummary[] = [
    { cid: 2001, name: "Announcements", owner: -1, avatar: -1, brief: "Official announcements" },
    { cid: 2002, name: "Support", owner: 2, avatar: -1, brief: "Ask for help" },
    { cid: 2003, name: "Random", owner: 3, avatar: -1, brief: "Off-topic chat" },
  ];

  const members = new Map<number, Member[]>();
  members.set(1001, [
    { id: 1, name: "Alice", avatarUrl: Avatar, description: "" },
    { id: 2, name: "Bob", avatarUrl: Avatar, description: "" },
  ]);
  members.set(1002, [
    { id: 1, name: "Alice", avatarUrl: Avatar, description: "" },
    { id: 3, name: "Carol", avatarUrl: Avatar, description: "" },
  ]);
  members.set(1003, [
    { id: 2, name: "Bob", avatarUrl: Avatar, description: "" },
    { id: 4, name: "Dave", avatarUrl: Avatar, description: "" },
  ]);

  const now = Date.now();
  const messages = new Map<number, MockMessage[]>();
  messages.set(1001, [
    { mid: 1, cid: 1001, uid: 2, text: "Welcome to the mock server!", send_time: now - 100000 },
    { mid: 2, cid: 1001, uid: 1, text: "Say hi 👋", send_time: now - 50000 },
  ]);
  messages.set(1002, [
    { mid: 3, cid: 1002, uid: 3, text: "Build is green.", send_time: now - 80000 },
  ]);
  messages.set(1003, [
    { mid: 4, cid: 1003, uid: 4, text: "New mockups uploaded.", send_time: now - 60000 },
  ]);

  return { channels, discoverable, members, messages, seq: 100 }; // seq for new mids
}

/**
 * mapToUiMessage 方法说明。
 * @param item - 参数说明。
 * @returns 返回值说明。
 */
function mapToUiMessage(item: MockMessage): Message {
  return {
    id: String(item.mid),
    from_id: item.uid,
    name: `User ${item.uid}`,
    avatar: Avatar,
    content: item.text,
    timestamp: new Date(item.send_time).toISOString(),
  };
}

export class MockChannelBasicService {
  constructor(private readonly serverSocket: string) {}

  /**
   * getAllChannels method.
   * @returns TODO.
   */
  async getAllChannels(): Promise<ChannelSummary[]> {
    await delay(MOCK_LATENCY_MS);
    return getState(this.serverSocket).channels;
  }
}

export class MockChannelMessageService {
  constructor(private readonly serverSocket: string) {}

  /**
   * getMessages method.
   * @param cid - TODO.
   * @param start_time - TODO.
   * @param count - TODO.
   * @returns TODO.
   */
  async getMessages(cid: number, start_time: number, count: number): Promise<Message[]> {
    await delay(MOCK_LATENCY_MS);
    const state = getState(this.serverSocket);
    const list = state.messages.get(cid) ?? [];
    const filtered = list
      .filter((item) => start_time <= 0 || item.send_time <= start_time)
      .sort((a, b) => b.send_time - a.send_time)
      .slice(0, count);
    const mapped = filtered.map(mapToUiMessage);
    addMessages(mapped, this.serverSocket, cid);
    return mapped;
  }

  /**
   * sendMessage method.
   * @param cid - TODO.
   * @param content - TODO.
   * @returns TODO.
   */
  async sendMessage(cid: number, content: string): Promise<number> {
    await delay(MOCK_LATENCY_MS);
    const state = getState(this.serverSocket);
    const nextId = ++state.seq;
    const msg: MockMessage = {
      mid: nextId,
      cid,
      uid: 1,
      text: content,
      send_time: Date.now(),
    };
    const list = state.messages.get(cid) ?? [];
    list.push(msg);
    state.messages.set(cid, list);
    return nextId;
  }

  /**
   * deleteMessage method.
   * @param mid - TODO.
   * @returns TODO.
   */
  async deleteMessage(mid: number): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    const state = getState(this.serverSocket);
    for (const [cid, list] of state.messages.entries()) {
      const next = list.filter((item) => item.mid !== mid);
      if (next.length !== list.length) state.messages.set(cid, next);
    }
  }

  /**
   * getAllUnreceivedMessages method.
   * @returns TODO.
   */
  async getAllUnreceivedMessages(): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    const state = getState(this.serverSocket);
    for (const channel of state.channels) {
      await this.getMessages(channel.cid, 0, 200);
    }
  }

  /**
   * getUnreadCount method.
   * @returns TODO.
   */
  async getUnreadCount(): Promise<number> {
    await delay(MOCK_LATENCY_MS);
    return 0;
  }

  /**
   * updateReadState method.
   * @returns TODO.
   */
  async updateReadState(): Promise<void> {
    await delay(MOCK_LATENCY_MS);
  }

  /**
   * getReadState method.
   * @returns TODO.
   */
  async getReadState(): Promise<{ last_read_time: number }>
  {
    await delay(MOCK_LATENCY_MS);
    return { last_read_time: 0 };
  }
}

export class MockChannelMemberService {
  constructor(private readonly serverSocket: string) {}

  /**
   * getAllMembers method.
   * @param cid - TODO.
   * @returns TODO.
   */
  async getAllMembers(cid: number): Promise<{ count: number; members: Member[] }>
  {
    await delay(MOCK_LATENCY_MS);
    const state = getState(this.serverSocket);
    const list = state.members.get(cid) ?? [];
    return { count: list.length, members: list };
  }
}

export class MockChannelApplicationService {
  constructor(_serverSocket: string) {}

  /**
   * applyChannel method.
   * @returns TODO.
   */
  async applyChannel(): Promise<void> {
    await delay(MOCK_LATENCY_MS);
  }
}

/**
 * mockSearchChannels 方法说明。
 * @param serverSocket - 参数说明。
 * @param query - 参数说明。
 * @returns 返回值说明。
 */
export function mockSearchChannels(serverSocket: string, query: string): ChannelSummary[] {
  const state = getState(serverSocket);
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return state.discoverable.filter((item) => {
    return item.name.toLowerCase().includes(needle) || String(item.cid).includes(needle);
  });
}
