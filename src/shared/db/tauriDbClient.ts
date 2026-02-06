/**
 * @fileoverview 桌面端数据库客户端（Tauri DB：frontend → Rust DB commands）。
 *
 * 该模块是 data-layer 适配器：提供一个小而清晰的类型化 API，用于对 Rust 管理的数据库执行 SQL。
 *
 * 设计要点：
 * - 前端不直接接触 SQLite；所有操作都通过 `invokeTauri` 命令转交给 Rust 侧执行。
 * - 通过字符串 key 对 DB 实例做命名空间隔离，以支持 system DB 与 per-server DB 并存。
 */
import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import SHA256 from "crypto-js/sha256";
import type { DbExecResult, DbQueryResult, DbStatement, DbValue } from "./types";
import { getServerScopeKey } from "@/shared/serverIdentity";
import { NO_SERVER_KEY } from "@/shared/serverKey";

/**
 * 数据库初始化类型。
 *
 * - `system`：系统库（全局配置、服务器列表等）。
 * - `server`：按 server scope 隔离的业务库（频道/消息等）。
 */
export type DbInitKind = "system" | "server";

/**
 * 前端数据库客户端接口（Tauri DB）。
 *
 * 说明：
 * - 所有操作最终都会通过 `invokeTauri` 转交给 Rust 的 DB commands 执行；
 * - 该接口刻意保持“小而清晰”，便于在不同模块复用。
 */
export interface DbClient {
  /**
   * 初始化/打开 DB 实例。
   *
   * @param path - 可选路径覆盖（通常省略，由 Rust 决定）。
   * @param kind - DB 类型（system / server），用于 Rust 侧路由。
   */
  init(path?: string, kind?: DbInitKind): Promise<void>;

  /**
   * 执行一条 SQL 语句（INSERT/UPDATE/DELETE 等）。
   *
   * @param sql - SQL 语句。
   * @param params - 可选位置参数。
   */
  execute(sql: string, params?: DbValue[]): Promise<DbExecResult>;

  /**
   * 查询多行数据。
   *
   * @param sql - SQL 查询语句。
   * @param columns - 列名列表：用于将行数组映射为对象。
   * @param params - 可选位置参数。
   */
  query(sql: string, columns: string[], params?: DbValue[]): Promise<DbQueryResult>;

  /**
   * 在单个事务中执行多条语句。
   *
   * @param statements - 语句列表。
   */
  transaction(statements: DbStatement[]): Promise<DbExecResult[]>;

  /**
   * 关闭 DB 实例（best-effort）。
   */
  close(): Promise<void>;

  /**
   * 删除该实例对应的 DB 文件（破坏性操作）。
   */
  remove(): Promise<void>;

  /**
   * 获取该实例对应的 DB 文件路径。
   */
  path(): Promise<string>;
}

/**
 * 系统库（system DB）的约定 key。
 *
 * @constant
 */
export const SYSTEM_DB_KEY = "system";
const serverDbCache = new Map<string, DbClient>();

/**
 * 创建绑定到指定 DB key 的客户端。
 *
 * @param key - DB 命名空间 key。
 * @returns 基于 Tauri commands 的 DbClient 实现。
 */
export function createDbClient(key: string): DbClient {
  const dbKey = key.trim();
  return {
    async init(path?: string, kind?: DbInitKind): Promise<void> {
      await invokeTauri(TAURI_COMMANDS.dbInit, { req: { key: dbKey, path, kind } });
    },

    async execute(sql: string, params?: DbValue[]): Promise<DbExecResult> {
      return invokeTauri<DbExecResult>(TAURI_COMMANDS.dbExecute, { req: { key: dbKey, sql, params } });
    },

    async query(sql: string, columns: string[], params?: DbValue[]): Promise<DbQueryResult> {
      return invokeTauri<DbQueryResult>(TAURI_COMMANDS.dbQuery, { req: { key: dbKey, sql, params, columns } });
    },

    async transaction(statements: DbStatement[]): Promise<DbExecResult[]> {
      return invokeTauri<DbExecResult[]>(TAURI_COMMANDS.dbTransaction, { req: { key: dbKey, statements } });
    },

    async close(): Promise<void> {
      await invokeTauri(TAURI_COMMANDS.dbClose, { key: dbKey });
    },

    async remove(): Promise<void> {
      await invokeTauri(TAURI_COMMANDS.dbRemove, { key: dbKey });
    },

    async path(): Promise<string> {
      return invokeTauri<string>(TAURI_COMMANDS.dbPath, { key: dbKey });
    },
  };
}

/**
 * 系统库（system DB）的单例客户端（默认使用）。
 *
 * @constant
 */
export const tauriDbClient = createDbClient(SYSTEM_DB_KEY);

/**
 * 计算稳定的 per-server DB key。
 *
 * 说明：对 socket 做哈希，保证 key 对文件系统友好，并避免在文件名/日志中泄露服务器地址。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns 命名空间化的 DB key。
 */
export function serverDbKey(serverSocket: string): string {
  const normalized = getServerScopeKey(serverSocket) || serverSocket.trim() || NO_SERVER_KEY;
  const hash = SHA256(normalized).toString();
  return `server_${hash}`;
}

/**
 * 获取缓存的 per-server DB client（不会自动 init）。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns 缓存的 DbClient。
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
 * 确保 system DB 已初始化并可用。
 *
 * @returns 已初始化的 system DbClient。
 */
export async function ensureSystemDb(): Promise<DbClient> {
  const client = createDbClient(SYSTEM_DB_KEY);
  await client.init(undefined, "system");
  return client;
}

/**
 * 确保 per-server DB 已初始化并可用。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns 已初始化的 server DbClient。
 */
export async function ensureServerDb(serverSocket: string): Promise<DbClient> {
  const client = getServerDbClient(serverSocket);
  await client.init(undefined, "server");
  return client;
}

/**
 * 关闭 per-server DB，并从缓存中移除。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns 无返回值。
 */
export async function closeServerDb(serverSocket: string): Promise<void> {
  const key = serverDbKey(serverSocket);
  const client = serverDbCache.get(key) ?? createDbClient(key);
  await client.close();
  serverDbCache.delete(key);
}

/**
 * 删除 per-server DB（破坏性操作），并从缓存中移除。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns 无返回值。
 */
export async function removeServerDb(serverSocket: string): Promise<void> {
  const key = serverDbKey(serverSocket);
  const client = serverDbCache.get(key) ?? createDbClient(key);
  await client.remove();
  serverDbCache.delete(key);
}
