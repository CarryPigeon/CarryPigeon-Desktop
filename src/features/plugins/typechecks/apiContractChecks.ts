/**
 * @fileoverview plugins API 编译期契约检查。
 * @description
 * 该文件只用于 TypeScript 编译期检查 plugins 根 capability 入口的稳定契约。
 */

import {
  createPluginsCapabilities,
  getPluginsCapabilities,
} from "@/features/plugins/api";
import type { PluginsCapabilities } from "@/features/plugins/api-types";

export const pluginsCapabilitiesFactoryContractCheck: PluginsCapabilities = createPluginsCapabilities();
export const pluginsCapabilitiesAccessorContractCheck: PluginsCapabilities = getPluginsCapabilities();
