/**
 * @fileoverview localMessageStoreAdapter.ts 文件职责说明。
 */
import type { MessageIdLike, MessageStorePort, MessageStoreRecord } from "../domain/ports/MessageStorePort";
import { bumpLatestLocalMessageTimeMs } from "@/shared/utils/localState";
import { readJson, writeJson } from "@/shared/utils/localStore";

const STORE_KEY = "carrypigeon:messages:v1";

type MessageStoreSnapshot = {
  version: 1;
  records: MessageStoreRecord[];
};

/**
 * defaultSnapshot 方法说明。
 * @returns 返回值说明。
 */
function defaultSnapshot(): MessageStoreSnapshot {
  return { version: 1, records: [] };
}

/**
 * isRecord 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
function isRecord(value: unknown): value is MessageStoreRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.serverSocket === "string" &&
    typeof item.messageId === "string" &&
    typeof item.channelId === "number" &&
    typeof item.userId === "number" &&
    typeof item.content === "string" &&
    typeof item.createdAt === "number" &&
    typeof item.updatedAt === "number"
  );
}

/**
 * loadSnapshot 方法说明。
 * @returns 返回值说明。
 */
function loadSnapshot(): MessageStoreSnapshot {
  const raw = readJson<MessageStoreSnapshot>(STORE_KEY, defaultSnapshot());
  if (!raw || typeof raw !== "object") return defaultSnapshot();
  if (raw.version !== 1 || !Array.isArray(raw.records)) return defaultSnapshot();
  return {
    version: 1,
    records: raw.records.filter(isRecord).map(normalizeRecord),
  };
}

/**
 * saveSnapshot 方法说明。
 * @param snapshot - 参数说明。
 * @returns 返回值说明。
 */
function saveSnapshot(snapshot: MessageStoreSnapshot): void {
  writeJson(STORE_KEY, snapshot);
}

/**
 * normalizeRecord 方法说明。
 * @param input - 参数说明。
 * @returns 返回值说明。
 */
function normalizeRecord(input: MessageStoreRecord): MessageStoreRecord {
  const createdAt = toNumber(input.createdAt);
  const updatedAt = toNumber(input.updatedAt) || createdAt;
  return {
    serverSocket: String(input.serverSocket ?? "").trim(),
    messageId: String(input.messageId ?? "").trim(),
    channelId: toNumber(input.channelId),
    userId: toNumber(input.userId),
    content: String(input.content ?? ""),
    createdAt,
    updatedAt,
  };
}

/**
 * toNumber 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return 0;
}

/**
 * toFiniteNumberOrNull 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

/**
 * toBigInt 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
function toBigInt(value: MessageIdLike): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim() !== "") {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * inIdRange 方法说明。
 * @param id - 参数说明。
 * @param fromId? - 参数说明。
 * @param toId? - 参数说明。
 * @returns 返回值说明。
 */
function inIdRange(id: MessageIdLike, fromId?: MessageIdLike, toId?: MessageIdLike): boolean {
  if (fromId === undefined || toId === undefined) return true;
  const bid = toBigInt(id);
  const bfrom = toBigInt(fromId);
  const bto = toBigInt(toId);
  if (bid !== null && bfrom !== null && bto !== null) return bid > bfrom && bid < bto;
  const nid = toFiniteNumberOrNull(id as unknown);
  const nfrom = toFiniteNumberOrNull(fromId as unknown);
  const nto = toFiniteNumberOrNull(toId as unknown);
  if (nid !== null && nfrom !== null && nto !== null) return nid > nfrom && nid < nto;
  return true;
}

/**
 * sameKey 方法说明。
 * @param a - 参数说明。
 * @param b - 参数说明。
 * @returns 返回值说明。
 */
function sameKey(a: MessageStoreRecord, b: MessageStoreRecord): boolean {
  return (
    a.serverSocket === b.serverSocket &&
    a.channelId === b.channelId &&
    a.messageId === b.messageId
  );
}

/**
 * Exported constant.
 * @constant
 */
export const localMessageStoreAdapter: MessageStorePort = {
  /**
   * create method.
   * @param record - TODO.
   * @returns TODO.
   */
  async create(record: MessageStoreRecord): Promise<void> {
    const snapshot = loadSnapshot();
    const normalized = normalizeRecord(record);
    if (!normalized.serverSocket || !normalized.messageId) return;
    const index = snapshot.records.findIndex((item) => sameKey(item, normalized));
    if (index >= 0) {
      snapshot.records[index] = { ...snapshot.records[index], ...normalized };
    } else {
      snapshot.records.push(normalized);
    }
    bumpLatestLocalMessageTimeMs(normalized.createdAt);
    saveSnapshot(snapshot);
  },

  /**
   * update method.
   * @param record - TODO.
   * @returns TODO.
   */
  async update(record: MessageStoreRecord): Promise<void> {
    const snapshot = loadSnapshot();
    const normalized = normalizeRecord(record);
    if (!normalized.serverSocket || !normalized.messageId) return;
    const index = snapshot.records.findIndex((item) => sameKey(item, normalized));
    if (index >= 0) {
      snapshot.records[index] = { ...snapshot.records[index], ...normalized };
    } else {
      snapshot.records.push(normalized);
    }
    bumpLatestLocalMessageTimeMs(normalized.updatedAt || normalized.createdAt);
    saveSnapshot(snapshot);
  },

  /**
   * delete method.
   * @param messageId - TODO.
   * @returns TODO.
   */
  async delete(messageId: string): Promise<void> {
    const snapshot = loadSnapshot();
    const target = String(messageId ?? "").trim();
    if (!target) return;
    snapshot.records = snapshot.records.filter((item) => item.messageId !== target);
    saveSnapshot(snapshot);
  },

  /**
   * getById method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @param messageId - TODO.
   * @returns TODO.
   */
  async getById(serverSocket: string, channelId: number, messageId: string): Promise<MessageStoreRecord | null> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetId = String(messageId ?? "").trim();
    const targetChannel = toNumber(channelId);
    if (!targetSocket || !targetId) return null;
    const record = snapshot.records.find(
      (item) =>
        item.serverSocket === targetSocket &&
        item.channelId === targetChannel &&
        item.messageId === targetId,
    );
    return record ? { ...record } : null;
  },

  /**
   * listByChannel method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @param fromId - TODO.
   * @param toId - TODO.
   * @returns TODO.
   */
  async listByChannel(
    serverSocket: string,
    channelId: number,
    fromId?: MessageIdLike,
    toId?: MessageIdLike,
  ): Promise<MessageStoreRecord[]> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetChannel = toNumber(channelId);
    return snapshot.records.filter(
      (item) =>
        item.serverSocket === targetSocket &&
        item.channelId === targetChannel &&
        inIdRange(item.messageId, fromId, toId),
    );
  },

  /**
   * listByKeyword method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @param keyword - TODO.
   * @returns TODO.
   */
  async listByKeyword(serverSocket: string, channelId: number, keyword: string): Promise<MessageStoreRecord[]> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetChannel = toNumber(channelId);
    const query = String(keyword ?? "");
    if (!query) return [];
    return snapshot.records.filter(
      (item) =>
        item.serverSocket === targetSocket &&
        item.channelId === targetChannel &&
        item.content.includes(query),
    );
  },

  /**
   * listByUser method.
   * @param serverSocket - TODO.
   * @param userId - TODO.
   * @param fromId - TODO.
   * @param toId - TODO.
   * @returns TODO.
   */
  async listByUser(
    serverSocket: string,
    userId: number,
    fromId?: MessageIdLike,
    toId?: MessageIdLike,
  ): Promise<MessageStoreRecord[]> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetUser = toNumber(userId);
    return snapshot.records.filter(
      (item) =>
        item.serverSocket === targetSocket &&
        item.userId === targetUser &&
        inIdRange(item.messageId, fromId, toId),
    );
  },

  /**
   * listByTimeRange method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @param fromTimeMs - TODO.
   * @param toTimeMs - TODO.
   * @returns TODO.
   */
  async listByTimeRange(
    serverSocket: string,
    channelId: number,
    fromTimeMs: number,
    toTimeMs: number,
  ): Promise<MessageStoreRecord[]> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetChannel = toNumber(channelId);
    const fromTime = toNumber(fromTimeMs);
    const toTime = toNumber(toTimeMs);
    return snapshot.records.filter(
      (item) =>
        item.serverSocket === targetSocket &&
        item.channelId === targetChannel &&
        item.createdAt > fromTime &&
        item.createdAt < toTime,
    );
  },

  /**
   * getLatestLocalMessageDate method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @returns TODO.
   */
  async getLatestLocalMessageDate(serverSocket: string, channelId: number): Promise<number | null> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetChannel = toNumber(channelId);
    let latest: number | null = null;
    for (const item of snapshot.records) {
      if (item.serverSocket !== targetSocket || item.channelId !== targetChannel) continue;
      if (latest === null || item.createdAt > latest) latest = item.createdAt;
    }
    return latest;
  },
};
