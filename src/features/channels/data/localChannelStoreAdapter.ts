/**
 * @fileoverview localChannelStoreAdapter.ts 文件职责说明。
 */
import type { ChannelStorePort, ChannelStoreRecord } from "../domain/ports/ChannelStorePort";
import { readJson, writeJson } from "@/shared/utils/localStore";

const STORE_KEY = "carrypigeon:channels:v1";

type ChannelStoreSnapshot = {
  version: 1;
  records: ChannelStoreRecord[];
};

/**
 * defaultSnapshot 方法说明。
 * @returns 返回值说明。
 */
function defaultSnapshot(): ChannelStoreSnapshot {
  return { version: 1, records: [] };
}

/**
 * isRecord 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
function isRecord(value: unknown): value is ChannelStoreRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    typeof item.name === "string" &&
    typeof item.serverSocket === "string" &&
    typeof item.ownerId === "number" &&
    typeof item.createdAt === "number" &&
    Array.isArray(item.adminIds) &&
    Array.isArray(item.memberIds)
  );
}

/**
 * loadSnapshot 方法说明。
 * @returns 返回值说明。
 */
function loadSnapshot(): ChannelStoreSnapshot {
  const raw = readJson<ChannelStoreSnapshot>(STORE_KEY, defaultSnapshot());
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
function saveSnapshot(snapshot: ChannelStoreSnapshot): void {
  writeJson(STORE_KEY, snapshot);
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
 * normalizeIds 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toNumber(item)).filter((item) => Number.isFinite(item));
}

/**
 * normalizeRecord 方法说明。
 * @param input - 参数说明。
 * @returns 返回值说明。
 */
function normalizeRecord(input: ChannelStoreRecord): ChannelStoreRecord {
  return {
    id: toNumber(input.id),
    name: String(input.name ?? "").trim(),
    serverSocket: String(input.serverSocket ?? "").trim(),
    ownerId: toNumber(input.ownerId),
    createdAt: toNumber(input.createdAt),
    adminIds: normalizeIds(input.adminIds),
    memberIds: normalizeIds(input.memberIds),
  };
}

/**
 * sameRecord 方法说明。
 * @param a - 参数说明。
 * @param b - 参数说明。
 * @returns 返回值说明。
 */
function sameRecord(a: ChannelStoreRecord, b: ChannelStoreRecord): boolean {
  return a.serverSocket === b.serverSocket && a.id === b.id;
}

/**
 * sameIdSet 方法说明。
 * @param a - 参数说明。
 * @param b - 参数说明。
 * @returns 返回值说明。
 */
function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((value, index) => value === sortedB[index]);
}

/**
 * Exported constant.
 * @constant
 */
export const localChannelStoreAdapter: ChannelStorePort = {
  /**
   * upsert method.
   * @param record - TODO.
   * @returns TODO.
   */
  async upsert(record: ChannelStoreRecord): Promise<void> {
    const snapshot = loadSnapshot();
    const normalized = normalizeRecord(record);
    if (!normalized.serverSocket || !normalized.id) return;
    const index = snapshot.records.findIndex((item) => sameRecord(item, normalized));
    if (index >= 0) snapshot.records[index] = { ...snapshot.records[index], ...normalized };
    else snapshot.records.push(normalized);
    saveSnapshot(snapshot);
  },

  /**
   * remove method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @returns TODO.
   */
  async remove(serverSocket: string, channelId: number): Promise<void> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetId = toNumber(channelId);
    snapshot.records = snapshot.records.filter(
      (item) => !(item.serverSocket === targetSocket && item.id === targetId),
    );
    saveSnapshot(snapshot);
  },

  /**
   * getAll method.
   * @returns TODO.
   */
  async getAll(): Promise<ChannelStoreRecord[]> {
    return loadSnapshot().records;
  },

  /**
   * getAllByServerSocket method.
   * @param serverSocket - TODO.
   * @returns TODO.
   */
  async getAllByServerSocket(serverSocket: string): Promise<ChannelStoreRecord[]> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    return snapshot.records.filter((item) => item.serverSocket === targetSocket);
  },

  /**
   * getById method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @returns TODO.
   */
  async getById(serverSocket: string, channelId: number): Promise<ChannelStoreRecord | null> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetId = toNumber(channelId);
    const record = snapshot.records.find(
      (item) => item.serverSocket === targetSocket && item.id === targetId,
    );
    return record ? { ...record } : null;
  },

  /**
   * getByName method.
   * @param serverSocket - TODO.
   * @param name - TODO.
   * @returns TODO.
   */
  async getByName(serverSocket: string, name: string): Promise<ChannelStoreRecord | null> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetName = String(name ?? "").trim();
    const record = snapshot.records.find(
      (item) => item.serverSocket === targetSocket && item.name === targetName,
    );
    return record ? { ...record } : null;
  },

  /**
   * getByOwnerId method.
   * @param serverSocket - TODO.
   * @param ownerId - TODO.
   * @returns TODO.
   */
  async getByOwnerId(serverSocket: string, ownerId: number): Promise<ChannelStoreRecord | null> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const targetOwner = toNumber(ownerId);
    const record = snapshot.records.find(
      (item) => item.serverSocket === targetSocket && item.ownerId === targetOwner,
    );
    return record ? { ...record } : null;
  },

  /**
   * getByAdminIds method.
   * @param serverSocket - TODO.
   * @param adminIds - TODO.
   * @returns TODO.
   */
  async getByAdminIds(serverSocket: string, adminIds: number[]): Promise<ChannelStoreRecord[]> {
    const snapshot = loadSnapshot();
    const targetSocket = String(serverSocket ?? "").trim();
    const normalizedIds = normalizeIds(adminIds);
    return snapshot.records.filter(
      (item) => item.serverSocket === targetSocket && sameIdSet(item.adminIds, normalizedIds),
    );
  },
};
