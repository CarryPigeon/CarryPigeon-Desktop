/**
 * @fileoverview messageReceiveService.ts 文件职责说明。
 */
import Avatar from '/test_avatar.jpg?url';
import type { Message } from './messageTypes';
import { isIgnoredUser } from '../../store/ignoreStore';
import { addMessage, importMessage, messageList } from '../../store/messageList';
import { createLogger } from '@/shared/utils/logger';
import { getMessageStoreUsecase } from '@/features/chat/di/messageStore.di';
import { bumpLatestLocalMessageTimeMs } from '@/shared/utils/localState';
import { getServerSocket } from '@/features/servers/presentation/store/currentServer';
import { createChannelMessageService } from '@/features/channels/data/channelServiceFactory';

const logger = createLogger("messageReceiveService");
const messageStore = getMessageStoreUsecase();

if (import.meta.env.DEV && messageList.value.length === 0) {
  importMessage([
    {
      id: "1",
      from_id: 1,
      name: "张三",
      avatar: Avatar,
      content: "你好！欢迎使用聊天系统。",
      timestamp: new Date().toISOString(),
    },
    {
      id: "2",
      from_id: 2,
      name: "系统",
      avatar: Avatar,
      content: "这是一条系统消息，请开始您的对话。",
      timestamp: new Date().toISOString(),
    },
  ], "local", 0);
}

export class MessageReceiveService {
  /**
   * showNewMessage method.
   * @param messageData - TODO.
   * @param opts - TODO.
   * @returns TODO.
   */
  public async showNewMessage(
    messageData: string | Record<string, unknown>,
    opts?: { serverSocket?: string },
  ) {
    try {
      const parsedData = typeof messageData === 'string' ? JSON.parse(messageData) : messageData;
      const raw = parsedData as Record<string, unknown>;

      const payload = resolveMessagePayload(raw);
      if (!payload) return;

      const createdAtMs = resolveMessageTimeMs(payload.data);
      const timestampIso = new Date(createdAtMs).toISOString();
      const messageId = resolveMessageId(payload.data, createdAtMs);
      const fromId = resolveUserId(payload.data);
      const content = resolveContent(payload.data);
      const name = resolveName(payload.data);
      const channelId = resolveChannelId(payload.data);
      const serverSocket = (opts?.serverSocket ?? getServerSocket()).trim();

      if (payload.isSummary && payload.summaryType === "create" && serverSocket && channelId > 0) {
        try {
          const service = createChannelMessageService(serverSocket);
          await service.getMessages(channelId, createdAtMs, 1);
          return;
        } catch (e) {
          logger.debug("Pull latest message failed", { error: String(e) });
        }
      }

      if (!messageId || !Number.isFinite(channelId) || channelId <= 0 || !Number.isFinite(fromId)) return;

      const newMessage: Message = {
        id: messageId,
        from_id: fromId,
        name,
        avatar: Avatar,
        content,
        timestamp: timestampIso,
      };

      if (isIgnoredUser(newMessage.from_id)) return;
      addMessage(newMessage, serverSocket, channelId);

      try {
        if (!serverSocket) return;

        const existing = await messageStore.getById(serverSocket, channelId, newMessage.id);
        const record = {
          serverSocket,
          messageId: newMessage.id,
          channelId,
          userId: newMessage.from_id,
          content: newMessage.content,
          createdAt: createdAtMs,
          updatedAt: createdAtMs,
        };

        if (existing) {
          if (existing.updatedAt !== createdAtMs || existing.content !== newMessage.content) {
            await messageStore.update(record);
          }
        } else {
          await messageStore.create(record);
        }
        bumpLatestLocalMessageTimeMs(createdAtMs);
      } catch (e) {
        logger.debug("Persist message failed", { error: String(e) });
      }
    } catch (e) {
      logger.debug("Ignore invalid message payload", { error: String(e) });
    }
  }
}

/**
 * Exported constant.
 * @constant
 */
export const messageReceiveService = new MessageReceiveService();

/**
 * resolveMessageTimeMs 方法说明。
 * @param data - 参数说明。
 * @param unknown> - 参数说明。
 * @returns 返回值说明。
 */
function resolveMessageTimeMs(data: Record<string, unknown>): number {
  const candidates = [data["send_time"], data["created_at"], data["timestamp"], data["time"]];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) return Math.trunc(numeric);
      const parsed = Date.parse(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return Date.now();
}

/**
 * resolveMessagePayload 方法说明。
 * @param raw - 参数说明。
 * @param unknown> - 参数说明。
 * @returns 返回值说明。
 */
function resolveMessagePayload(raw: Record<string, unknown>): { data: Record<string, unknown>; isSummary: boolean; summaryType?: string } | null {
  if (raw["id"] === -1 && raw["code"] === 0) {
    const outer = raw["data"];
    if (outer && typeof outer === "object") {
      const outerObj = outer as Record<string, unknown>;
      if (outerObj["route"] === "/core/message") {
        const inner = outerObj["data"];
        if (inner && typeof inner === "object") {
          const summaryType = typeof (inner as Record<string, unknown>)["type"] === "string"
            ? String((inner as Record<string, unknown>)["type"])
            : undefined;
          return { data: inner as Record<string, unknown>, isSummary: true, summaryType };
        }
      }
    }
    return null;
  }

  if (raw["route"] === "/core/message") {
    const inner = raw["data"];
    if (inner && typeof inner === "object") {
      const summaryType = typeof (inner as Record<string, unknown>)["type"] === "string"
        ? String((inner as Record<string, unknown>)["type"])
        : undefined;
      return { data: inner as Record<string, unknown>, isSummary: true, summaryType };
    }
  }

  return { data: raw, isSummary: false };
}

/**
 * resolveMessageId 方法说明。
 * @param data - 参数说明。
 * @param unknown> - 参数说明。
 * @param fallbackTimeMs - 参数说明。
 * @returns 返回值说明。
 */
function resolveMessageId(data: Record<string, unknown>, fallbackTimeMs: number): string {
  const id = data["mid"] ?? data["message_id"] ?? data["id"];
  if (id !== undefined && id !== null) return String(id);
  const cid = resolveChannelId(data);
  const uid = resolveUserId(data);
  if (Number.isFinite(cid) && Number.isFinite(uid)) {
    return `${cid}-${uid}-${fallbackTimeMs}`;
  }
  return String(fallbackTimeMs);
}

/**
 * resolveUserId 方法说明。
 * @param data - 参数说明。
 * @param unknown> - 参数说明。
 * @returns 返回值说明。
 */
function resolveUserId(data: Record<string, unknown>): number {
  const value = data["uid"] ?? data["user_id"] ?? data["from_id"];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * resolveChannelId 方法说明。
 * @param data - 参数说明。
 * @param unknown> - 参数说明。
 * @returns 返回值说明。
 */
function resolveChannelId(data: Record<string, unknown>): number {
  const value = data["cid"] ?? data["channel_id"];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * resolveContent 方法说明。
 * @param data - 参数说明。
 * @param unknown> - 参数说明。
 * @returns 返回值说明。
 */
function resolveContent(data: Record<string, unknown>): string {
  const content = data["message"] ?? data["content"] ?? data["s_content"];
  return typeof content === "string" ? content : String(content ?? "");
}

/**
 * resolveName 方法说明。
 * @param data - 参数说明。
 * @param unknown> - 参数说明。
 * @returns 返回值说明。
 */
function resolveName(data: Record<string, unknown>): string {
  const name = data["name"] ?? data["username"];
  return typeof name === "string" ? name : "Unknown";
}
