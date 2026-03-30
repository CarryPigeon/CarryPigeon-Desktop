/**
 * @fileoverview 可用消息 domain 构建。
 * @description chat/message-flow｜application：Core domain + 插件 domain 列表构建。
 *
 * 职责：
 * - 汇总 Core domain + 已启用插件提供的 domains，供 composer 下拉选择。
 * - 进行去重与基础字段补全，确保 UI 可稳定渲染与回显。
 *
 * 约定：
 * - 注释中文；日志由调用方负责（本模块不打日志）。
 * - `Core:Text` 始终存在，作为基础可用 domain。
 */

import type { MessageDomain } from "@/features/chat/message-flow/domain/contracts";
import type { AvailableMessageDomainsPort } from "../ports";

/**
 * domain 构建器的可选依赖集合。
 */
export type AvailableDomainsDeps = AvailableMessageDomainsPort;

/**
 * 创建“可用 domain 列表”能力。
 *
 * @param deps - 依赖集合。
 * @returns `{ availableDomains }`。
 */
export function createAvailableDomains(deps: AvailableDomainsDeps) {
  /**
   * 供 composer 使用的 domain 列表：Core + 已启用插件 domains。
   *
   * @returns domain 列表（已去重）。
   */
  function availableDomains(): MessageDomain[] {
    const socket = deps.getActiveServerSocket().trim();
    return deps.getAvailableMessageDomains(socket);
  }

  return { availableDomains };
}
