/**
 * @fileoverview settings API 编译期契约检查。
 * @description
 * 该文件只用于 TypeScript 编译期检查 settings 根 capability 入口契约。
 */

import {
  createSettingsCapabilities,
  getSettingsCapabilities,
} from "@/features/settings/api";
import type { SettingsCapabilities } from "@/features/settings/api-types";

export const settingsCapabilitiesContractCheck: SettingsCapabilities = createSettingsCapabilities();
export const settingsCapabilitiesGetterContractCheck: SettingsCapabilities = getSettingsCapabilities();
