/**
 * @fileoverview liveChat 可用消息 domain 构建。
 * @description chat｜展示层（store 子模块）：liveChatDomains。
 *
 * 职责：
 * - 汇总 Core domain + 已启用插件提供的 domains，供 composer 下拉选择。
 * - 进行去重与基础字段补全，确保 UI 可稳定渲染与回显。
 *
 * 约定：
 * - 注释中文；日志由调用方负责（本模块不打日志）。
 * - `Core:Text` 始终存在，作为基础可用 domain。
 */

import { currentServerSocket } from "@/features/servers/api";
import { usePluginCatalogStore, usePluginInstallStore } from "@/features/plugins/api";
import type { MessageDomain } from "../chatStoreTypes";

/**
 * domain 构建器的可选依赖集合。
 */
export type LiveChatDomainsDeps = {
  /**
   * 获取当前生效的 server socket。
   *
   * 说明：
   * - 若不传，将使用 `currentServerSocket` 作为默认来源。
   */
  getActiveServerSocket?: () => string;
};

/**
 * 创建“可用 domain 列表”能力。
 *
 * @param deps - 依赖集合。
 * @returns `{ availableDomains }`。
 */
export function createLiveChatDomains(deps?: LiveChatDomainsDeps) {
  const getActiveServerSocket = deps?.getActiveServerSocket ?? (() => currentServerSocket.value.trim());

  /**
   * 供 composer 使用的 domain 列表：Core + 已启用插件 domains。
   *
   * @returns domain 列表（已去重）。
   */
  function availableDomains(): MessageDomain[] {
    const socket = getActiveServerSocket().trim();
    const catalog = usePluginCatalogStore(socket).catalog.value;
    const install = usePluginInstallStore(socket).installedById;

    const enabledDomains: MessageDomain[] = [];
    for (const p of catalog) {
      const st = install[p.pluginId];
      const ok = Boolean(st?.enabled) && st?.status === "ok";
      if (!ok) continue;
      for (const d of p.providesDomains) enabledDomains.push({ ...d, pluginIdHint: p.pluginId });
    }

    const core: MessageDomain = {
      id: "Core:Text",
      label: "Core:Text",
      colorVar: "--cp-domain-core",
      pluginIdHint: "core.text",
      version: "1.0.0",
    };

    const unique = new Map<string, MessageDomain>();
    unique.set(core.id, core);
    for (const d of enabledDomains) unique.set(d.id, d);
    return Array.from(unique.values());
  }

  return { availableDomains };
}
