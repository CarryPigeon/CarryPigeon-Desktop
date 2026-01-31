/**
 * @fileoverview tauriDbClient.ts 文件职责说明。
 */
import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import SHA256 from "crypto-js/sha256";
import type { DbExecResult, DbQueryResult, DbStatement, DbValue } from "./types";

export type DbInitKind = "system" | "server";

export interface DbClient {
  init(path?: string, kind?: DbInitKind): Promise<void>;
  execute(sql: string, params?: DbValue[]): Promise<DbExecResult>;
  query(sql: string, columns: string[], params?: DbValue[]): Promise<DbQueryResult>;
  transaction(statements: DbStatement[]): Promise<DbExecResult[]>;
  close(): Promise<void>;
  remove(): Promise<void>;
  path(): Promise<string>;
}

/**
 * Exported constant.
 * @constant
 */
export const SYSTEM_DB_KEY = "system";
const serverDbCache = new Map<string, DbClient>();

/**
 * createDbClient 方法说明。
 * @param key - 参数说明。
 * @returns 返回值说明。
 */
export function createDbClient(key: string): DbClient {
  const dbKey = key.trim();
  return {
    /**
     * init method.
     * @param path - TODO.
     * @param kind - TODO.
     * @returns TODO.
     */
    async init(path?: string, kind?: DbInitKind): Promise<void> {
      await invokeTauri(TAURI_COMMANDS.dbInit, { req: { key: dbKey, path, kind } });
    },

    /**
     * execute method.
     * @param sql - TODO.
     * @param params - TODO.
     * @returns TODO.
     */
    async execute(sql: string, params?: DbValue[]): Promise<DbExecResult> {
      return invokeTauri<DbExecResult>(TAURI_COMMANDS.dbExecute, { req: { key: dbKey, sql, params } });
    },

    /**
     * query method.
     * @param sql - TODO.
     * @param columns - TODO.
     * @param params - TODO.
     * @returns TODO.
     */
    async query(sql: string, columns: string[], params?: DbValue[]): Promise<DbQueryResult> {
      return invokeTauri<DbQueryResult>(TAURI_COMMANDS.dbQuery, { req: { key: dbKey, sql, params, columns } });
    },

    /**
     * transaction method.
     * @param statements - TODO.
     * @returns TODO.
     */
    async transaction(statements: DbStatement[]): Promise<DbExecResult[]> {
      return invokeTauri<DbExecResult[]>(TAURI_COMMANDS.dbTransaction, { req: { key: dbKey, statements } });
    },

    /**
     * close method.
     * @returns TODO.
     */
    async close(): Promise<void> {
      await invokeTauri(TAURI_COMMANDS.dbClose, { key: dbKey });
    },

    /**
     * remove method.
     * @returns TODO.
     */
    async remove(): Promise<void> {
      await invokeTauri(TAURI_COMMANDS.dbRemove, { key: dbKey });
    },

    /**
     * path method.
     * @returns TODO.
     */
    async path(): Promise<string> {
      return invokeTauri<string>(TAURI_COMMANDS.dbPath, { key: dbKey });
    },
  };
}

/**
 * Exported constant.
 * @constant
 */
export const tauriDbClient = createDbClient(SYSTEM_DB_KEY);

/**
 * serverDbKey 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function serverDbKey(serverSocket: string): string {
  const normalized = serverSocket.trim();
  const hash = SHA256(normalized).toString();
  return `server_${hash}`;
}

/**
 * getServerDbClient 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function getServerDbClient(serverSocket: string): DbClient {
  const key = serverDbKey(serverSocket);
  const existing = serverDbCache.get(key);
  if (existing) return existing;
  const client = createDbClient(key);
  serverDbCache.set(key, client);
  return client;
}

/**
 * ensureSystemDb 方法说明。
 * @returns 返回值说明。
 */
export async function ensureSystemDb(): Promise<DbClient> {
  const client = createDbClient(SYSTEM_DB_KEY);
  await client.init(undefined, "system");
  return client;
}

/**
 * ensureServerDb 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export async function ensureServerDb(serverSocket: string): Promise<DbClient> {
  const client = getServerDbClient(serverSocket);
  await client.init(undefined, "server");
  return client;
}

/**
 * closeServerDb 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export async function closeServerDb(serverSocket: string): Promise<void> {
  const key = serverDbKey(serverSocket);
  const client = serverDbCache.get(key) ?? createDbClient(key);
  await client.close();
  serverDbCache.delete(key);
}

/**
 * removeServerDb 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export async function removeServerDb(serverSocket: string): Promise<void> {
  const key = serverDbKey(serverSocket);
  const client = serverDbCache.get(key) ?? createDbClient(key);
  await client.remove();
  serverDbCache.delete(key);
}
