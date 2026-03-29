/**
 * @fileoverview account/auth-flow 安装插件 provider application facade。
 * @description
 * 隔离 auth-flow 对 installed-plugins provider 的写入入口，避免子域 API 直接依赖 data 实现文件。
 */

import {
  setInstalledPluginsQueryProvider as setInstalledPluginsQueryProviderInternal,
  type InstalledPluginsQueryProvider,
} from "../data/installedPluginsQueryProvider";

export type { InstalledPluginsQueryProvider } from "../data/installedPluginsQueryProvider";

/**
 * 配置 installed plugins 查询 provider。
 */
export function configureInstalledPluginsQueryProvider(provider: InstalledPluginsQueryProvider): void {
  setInstalledPluginsQueryProviderInternal(provider);
}
