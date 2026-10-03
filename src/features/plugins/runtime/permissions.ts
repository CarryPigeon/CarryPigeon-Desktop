/**
 * @fileoverview plugins 运行时：权限 → 能力服务可见性映射。
 * @description
 * 本模块把 manifest.permissions 翻译为「哪些 Cordis 能力服务会被注入」，
 * 并在 apply 之前对插件声明的必需依赖做前置校验，避免出现"权限缺失导致插件静默 pending"。
 *
 * 安全边界：
 * - 权限来源为已校验的 plugin.json（Rust 侧），插件 JS 模块无法自证权限；
 * - 未授权的能力服务不会被 `ctx.set`，插件即使拿到 `ctx.network` 也只会得到 undefined。
 */

import type { Plugin } from "@cordisjs/core";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import { createPluginRuntimeError } from "@/features/plugins/presentation/runtime/pluginRuntimeError";

/**
 * 能力服务名清单（顺序即 isolate 链顺序，需保持稳定）。
 *
 * 说明：`storage` / `domains` / `server` 为宿主始终注入的基础能力，
 * 其余服务按对应权限可见性注入。
 */
export const CAPABILITY_SERVICE_NAMES = [
  "storage",
  "domains",
  "network",
  "ai",
  "messages",
  "ui",
  "ipc",
] as const;

export type CapabilityServiceName = (typeof CAPABILITY_SERVICE_NAMES)[number];

/**
 * 能力服务 → 所需权限（满足其中任意一个即可见）。
 *
 * - 未列出的服务为基础能力（始终注入，无需权限）；
 * - `messages` 覆盖读与发两类，分别由 `messages:read` / `messages:send` 授权。
 */
export const PERMISSIONS_BY_SERVICE: Record<string, readonly string[]> = {
  network: ["network"],
  ai: ["ai"],
  messages: ["messages:read", "messages:send"],
  ui: ["ui"],
  ipc: ["invoke", "events"],
};

/** 归一化权限列表（去重、trim、去空）。 */
export function normalizePermissions(permissions: readonly string[] | undefined): string[] {
  const set = new Set<string>();
  for (const item of permissions ?? []) {
    const key = String(item ?? "").trim();
    if (key) set.add(key);
  }
  return Array.from(set);
}

/**
 * 判断某能力服务在当前权限下是否可见。
 *
 * @param service - 能力服务名。
 * @param permissions - 已归一化的权限集合。
 * @returns 可见返回 true。
 */
export function isServiceVisible(service: string, permissions: ReadonlySet<string>): boolean {
  const required = PERMISSIONS_BY_SERVICE[service];
  if (!required) return true;
  return required.some((permission) => permissions.has(permission));
}

/** 插件静态声明的依赖（`inject` / `using`）。 */
export type InjectedServices = Record<string, { required: boolean }>;

/**
 * 读取插件声明的依赖集合（兼容 `string[]` 与 `{ name: { required } }` 两种形状）。
 *
 * @param plugin - Cordis 插件（函数 / 对象 / 类）。
 * @returns 归一化后的依赖表。
 */
export function resolveInjectedServices(plugin: Plugin): InjectedServices {
  const raw = (plugin as { inject?: unknown; using?: unknown }).inject
    ?? (plugin as { using?: unknown }).using;
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.map((name) => [String(name), { required: true }]));
  }
  const out: InjectedServices = {};
  for (const [name, meta] of Object.entries(raw as Record<string, unknown>)) {
    out[name] = { required: (meta as { required?: boolean })?.required !== false };
  }
  return out;
}

/**
 * 前置校验：插件声明的**必需**能力服务，其对应权限必须已被 manifest 授予。
 *
 * 说明：
 * - 可选依赖（`required: false`）缺失时保持 Cordis 默认行为（服务为 undefined），不在此拒绝；
 * - 校验失败抛出带 code 的领域错误，由 reconciler 标记插件为 failed，而非静默 pending。
 *
 * @param plugin - Cordis 插件。
 * @param runtime - 插件 runtime entry（权限权威来源）。
 */
export function assertRequiredPermissions(plugin: Plugin, runtime: PluginRuntimeEntry): void {
  const permissions = new Set(normalizePermissions(runtime.permissions));
  const injected = resolveInjectedServices(plugin);
  for (const [service, meta] of Object.entries(injected)) {
    if (!meta.required) continue;
    if (isServiceVisible(service, permissions)) continue;
    const required = PERMISSIONS_BY_SERVICE[service];
    throw createPluginRuntimeError(
      "plugin_permission_denied",
      `Plugin ${runtime.pluginId} requires service "${service}" but lacks permission (${required?.join("|") ?? "unknown"})`,
      { pluginId: runtime.pluginId, service, required: required ?? [] },
    );
  }
}
