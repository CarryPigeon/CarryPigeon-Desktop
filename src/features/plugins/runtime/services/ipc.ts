/**
 * @fileoverview plugins 运行时能力服务：ipc（invoke / onEvent）。
 * @description
 * 命令与事件调用受两层约束：
 * 1. `plugin.json` 声明的 `ipcPrefixes`（已校验清单，Rust 侧权威来源）；
 * 2. 宿主侧「可暴露命名空间」白名单（`EXPOSABLE_IPC_NAMESPACES`），防止恶意清单用
 *    `*` / 空串等宽泛前缀放开任意 Tauri 命令。
 *
 * 只有同时满足两者的前缀才会生效；未命中前缀的命令/事件直接抛错拒绝。
 */

import type { Context } from "@cordisjs/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invokeTauri } from "@/shared/tauri";
import { createPluginRuntimeError } from "@/features/plugins/presentation/runtime/pluginRuntimeError";
import { isGuardDisposed, type RuntimeGuard } from "../guard";
import type { PluginIpcService } from "../types";

/**
 * 宿主当前允许暴露给插件的 IPC 命名空间。
 *
 * 说明：这是"manifest 声明 + 宿主白名单"的双重约束。新增可暴露命名空间需随宿主发版更新。
 */
export const EXPOSABLE_IPC_NAMESPACES: readonly string[] = ["voice_call:"];

/**
 * 从 manifest 声明的 `ipcPrefixes` 中筛选出宿主允许的前缀。
 *
 * 规则：声明前缀必须**以某个可暴露命名空间开头**（即其子集），
 * 从而拒绝 `""`、`"*"`、`"voice"` 这类过宽前缀。
 *
 * @param declared - manifest 声明的前缀列表。
 * @returns 生效的前缀列表（可能为空）。
 */

export function resolveIpcPrefixes(declared: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of declared ?? []) {
    const prefix = String(raw ?? "").trim();
    if (!prefix) continue;
    if (EXPOSABLE_IPC_NAMESPACES.some((ns) => prefix.startsWith(ns))) out.push(prefix);
  }
  return Array.from(new Set(out));
}

/**
 * 创建受限 IPC 服务。
 *
 * @param serverSocket 当前 server socket（透传给 Rust 侧做隔离）。
 * @param pluginId 插件标识（错误定位）。
 * @param ipcPrefixes 已由 `resolveIpcPrefixes` 过滤后的生效前缀。
 * @param permissions 已归一化的权限集合（分别门控 invoke / onEvent）。
 * @param pluginCtx 插件 fiber 上下文（用于自动取消事件订阅）。
 * @param guard 运行时守卫。
 */
export function createIpcService(
  serverSocket: string,
  pluginId: string,
  ipcPrefixes: readonly string[],
  permissions: ReadonlySet<string>,
  pluginCtx: Context,
  guard: RuntimeGuard,
): PluginIpcService {
  const prefixes = ipcPrefixes.length > 0 ? ipcPrefixes : [];
  // invoke / onEvent 分别由独立权限门控（合并为 ipc 服务后仍需保持各自边界）。
  const canInvoke = permissions.has("invoke");
  const canEvent = permissions.has("events");
  function assertAllowed(kind: "command" | "event", name: string): void {
    const value = String(name ?? "").trim();
    if (!value || !prefixes.some((prefix) => value.startsWith(prefix))) {
      throw createPluginRuntimeError(
        "plugin_permission_denied",
        `plugin ${pluginId} ${kind} denied: "${value}" not under allowed prefixes`,
        { pluginId, kind, name: value, prefixes },
      );
    }
  }
  return {
    async invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
      if (!canInvoke) {
        throw createPluginRuntimeError(
          "plugin_permission_denied",
          `plugin ${pluginId} lacks "invoke" permission`,
          { pluginId, command },
        );
      }
      if (isGuardDisposed(guard, "ipc.invoke", pluginId)) return null as T;
      assertAllowed("command", command);
      return invokeTauri<T>(command, { ...(args ?? {}), serverSocket });
    },
    onEvent<T = unknown>(event: string, handler: (payload: T) => void): () => void {
      if (!canEvent) {
        throw createPluginRuntimeError(
          "plugin_permission_denied",
          `plugin ${pluginId} lacks "events" permission`,
          { pluginId, event },
        );
      }
      if (isGuardDisposed(guard, "ipc.onEvent", pluginId)) return () => {};
      assertAllowed("event", event);
      let unlisten: UnlistenFn | null = null;
      let cancelled = false;
      listen<T>(event, (e) => handler(e.payload)).then((fn) => {
        unlisten = fn;
        if (cancelled) unlisten();
      });
      const off = (): void => {
        cancelled = true;
        unlisten?.();
      };
      // 绑定到插件 fiber：fiber 销毁时自动取消订阅。
      pluginCtx.effect(() => off);
      return off;
    },
  };
}
