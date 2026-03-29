/**
 * @fileoverview PluginGatewayPort.ts
 * @description plugins｜领域端口组合类型：PluginGatewayPort（Query + Command）。
 */

import type { PluginInstallQueryPort } from "./PluginInstallQueryPort";
import type { PluginLifecycleCommandPort } from "./PluginLifecycleCommandPort";

/**
 * 插件网关端口：安装态查询 + 生命周期命令的组合能力。
 */
export type PluginGatewayPort = PluginInstallQueryPort & PluginLifecycleCommandPort;
