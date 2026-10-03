/**
 * @fileoverview plugins 运行时：把单个插件应用到 server Context。
 * @description
 * 核心流程：
 * 1. 前置校验插件必需依赖对应的权限是否已授予（缺失立即抛错，不静默 pending）；
 * 2. 为插件实例逐服务名 `isolate`，避免同 server 下多插件注册同名能力服务冲突；
 * 3. 通过 host wrapper plugin 按权限 `ctx.set` 注入能力服务，再 `ctx.plugin(真实插件)`；
 * 4. `await serverCtx.start()` 冲掉 Cordis 异步 apply 任务，保证绑定注册就绪。
 */

import type { Context, ForkScope } from "@cordisjs/core";
import type {
  PluginComposerPayload,
  PluginMessagesApi,
} from "@/features/plugins/domain/types/pluginRuntimeTypes";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { DomainsRegistry } from "./domainsRegistry";
import { createRuntimeGuard } from "./guard";
import { assertRequiredPermissions, CAPABILITY_SERVICE_NAMES, isServiceVisible, normalizePermissions } from "./permissions";
import { createAiService } from "./services/ai";
import { createDomainsService } from "./services/domains";
import { createIpcService, resolveIpcPrefixes } from "./services/ipc";
import { createMessagesService } from "./services/messages";
import { createNetworkService } from "./services/network";
import { createStorageService } from "./services/storage";
import { createUiService, type PluginUiBridge } from "./services/ui";
import type { Plugin } from "./types";


export type ApplyPluginDeps = {
  /** 当前 server socket（透传给 Rust 侧命令；与 store 的 server key 一致）。 */
  serverSocket: string;
  /** 共享 domain 注册表。 */
  registry: DomainsRegistry;
  /** 宿主 chat UI 桥（可选：仅当 host 提供时注入 `ui` 服务）。 */
  uiBridge?: PluginUiBridge;
  /** chat 频道消息读取桥（`messages:read` 门控）。 */
  messagesReader?: PluginMessagesApi;
  /** 宿主发送桥（`messages:send` 门控）；实现方需自行做动态 host bridge 查找。 */
  sendMessage?: (payload: PluginComposerPayload) => Promise<void>;
};

export type AppliedPlugin = {
  /** 插件 fiber 上下文（已挂载能力服务）。 */
  ctx: Context;
  /** Cordis fork 句柄。 */
  fork: ForkScope;
  /** 销毁插件（触发 Cordis 级联清理）。 */
  dispose(): Promise<void>;
};

/**
 * 应用一个插件到指定 server context。
 *
 * @param serverCtx - 该 server 的 Cordis root context。
 * @param deps - 宿主桥依赖。
 * @param runtime - 插件 runtime entry（权限权威来源）。
 * @param mod - Cordis 插件对象（v2 模块或 v1 适配器）。
 * @param config - 插件运行期配置（可选）。
 * @returns 应用结果（上下文 + 销毁句柄）。
 */
export async function applyPlugin(
  serverCtx: Context,
  deps: ApplyPluginDeps,
  runtime: PluginRuntimeEntry,
  mod: Plugin,
  config?: unknown,
): Promise<AppliedPlugin> {
  // 1) 权限前置校验（缺失立即失败）
  assertRequiredPermissions(mod, runtime);

  const permissions = new Set(normalizePermissions(runtime.permissions));
  const { guard, markDisposed } = createRuntimeGuard();

  // 2) 逐服务名隔离（每次 isolate 产生独立 symbol，插件之间互不可见）
  const capabilityCtx = CAPABILITY_SERVICE_NAMES.reduce<Context>(
    (ctx, name) => ctx.isolate(name),
    serverCtx,
  );

  // Cordis 会把 apply 内的异常吞入 scope（status=FAILED、error 存于 runtime），
  // 因此需在 start 后显式检查 wrapper 与真实插件的 scope 状态并向上抛出。
  const SCOPE_STATUS_FAILED = 3;
  let childFork: ForkScope | null = null;

  const wrapper: Plugin.Object = {
    name: `host:${runtime.pluginId}@${runtime.version}`,
    apply(ctx: Context) {
      // 3) 能力服务随 wrapper fiber 生命周期注册/销毁
      ctx.on("dispose", () => markDisposed());
      ctx.set("storage", createStorageService(deps.serverSocket, runtime.pluginId, guard));
      ctx.set("domains", createDomainsService(deps.registry, runtime));
      if (isServiceVisible("network", permissions)) {
        ctx.set("network", createNetworkService(deps.serverSocket, runtime.pluginId, guard));
      }
      if (isServiceVisible("ai", permissions)) {
        ctx.set("ai", createAiService(runtime.pluginId, guard));
      }
      if (isServiceVisible("messages", permissions)) {
        ctx.set(
          "messages",
          createMessagesService({
            pluginId: runtime.pluginId,
            permissions,
            reader: deps.messagesReader,
            send: deps.sendMessage,
            guard,
          }),
        );
      }
      if (isServiceVisible("ui", permissions) && deps.uiBridge) {
        ctx.set("ui", createUiService(deps.uiBridge, ctx, runtime.pluginId, guard));
      }
      if (isServiceVisible("ipc", permissions)) {
        const prefixes = resolveIpcPrefixes(runtime.ipcPrefixes);
        ctx.set(
          "ipc",
          createIpcService(deps.serverSocket, runtime.pluginId, prefixes, permissions, ctx, guard),
        );
      }
      // 真实插件作为子 fiber 应用（config 由宿主透传，类型在运行时动态确定）
      childFork = (ctx.plugin as (plugin: Plugin, config?: unknown) => ForkScope)(mod, config);
    },
  };

  const fork = capabilityCtx.plugin(wrapper);
  // 4) 冲掉异步 apply 任务，确保 renderer/composer 注册在返回前完成
  await serverCtx.start();

  // 5) apply 失败检测：wrapper 或真实插件任一 scope 处于 FAILED 即向上抛出，
  //    使 store 能回滚状态并标记 failed（避免「加载成功但实际未生效」）。
  const failedScope = [fork, childFork].find(
    (scope) => scope !== null && scope.runtime?.status === SCOPE_STATUS_FAILED,
  );
  if (failedScope) {
    // 失败时销毁残留 fiber，避免半初始化实例留在 Cordis 注册表中。
    try {
      fork.dispose();
    } catch {
      // dispose 本身的异常不应覆盖原始 apply 错误。
    }
    throw failedScope.runtime.error ?? new Error(`Plugin ${runtime.pluginId} failed to apply`);
  }

  return {
    ctx: fork.ctx,
    fork,
    async dispose(): Promise<void> {
      if (!fork) return;
      try {
        fork.dispose();
      } finally {
        // 让 Cordis 触发的清理副作用（effect disposer）有机会执行。
        await Promise.resolve();
      }
    },
  };
}
