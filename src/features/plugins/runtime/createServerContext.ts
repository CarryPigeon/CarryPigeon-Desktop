/**
 * @fileoverview plugins 运行时：server 级 Cordis context 创建与销毁。
 * @description
 * 每个 server 一个独立 root `Context`（天然按 server 隔离），承载 `server` 服务与
 * 共享 domain 注册表。插件能力服务在 `applyPlugin` 中按插件实例隔离注入。
 */

import { Context } from "@cordisjs/core";
import { createLogger } from "@/shared/utils/logger";
import { createDomainsRegistry, type DomainsRegistry } from "./domainsRegistry";
import { createServerService } from "./services/server";

const logger = createLogger("plugin-cordis-runtime");

export type ServerRuntimeOptions = {
  serverSocket: string;
  serverId: string;
  /** 实时读取当前频道 id。 */
  getCid(): string;
  /** 实时读取当前用户 id。 */
  getUid(): string;
  /** 当前界面语言。 */
  lang: string;
};

export type ServerRuntime = {
  /** server 级 Cordis root context。 */
  ctx: Context;
  /** 共享 domain 注册表。 */
  registry: DomainsRegistry;
  /** 销毁整棵 server runtime（级联清理全部插件 fiber）。 */
  dispose(): Promise<void>;
};

/**
 * 创建 server 级 Cordis runtime。
 */
export function createServerRuntime(options: ServerRuntimeOptions): ServerRuntime {
  const ctx = new Context();
  const registry = createDomainsRegistry();
  ctx.set(
    "server",
    createServerService({
      serverSocket: options.serverSocket,
      serverId: options.serverId,
      getCid: options.getCid,
      getUid: options.getUid,
      lang: options.lang,
    }),
  );
  // 将 Cordis 内部的 error / warning 路由到宿主统一日志（英文 + Action 前缀），
  // 同时抑制 Cordis 默认的 console 输出（其内部存在“仅单一 hook 时才打印”的保护）。
  ctx.on(
    "internal/error",
    (...args: unknown[]) => {
      logger.error("Action: plugins_cordis_error", {
        serverId: options.serverId,
        error: String(args[0] ?? ""),
      });
    },
    { global: true },
  );
  ctx.on(
    "internal/warning",
    (...args: unknown[]) => {
      logger.warn("Action: plugins_cordis_warning", {
        serverId: options.serverId,
        error: String(args[0] ?? ""),
      });
    },
    { global: true },
  );
  return {
    ctx,
    registry,
    async dispose(): Promise<void> {
      try {
        ctx.scope.dispose();
      } finally {
        // 让 Cordis 触发的异步 disposer（effect 清理）有机会执行。
        await Promise.resolve();
      }
    },
  };
}
