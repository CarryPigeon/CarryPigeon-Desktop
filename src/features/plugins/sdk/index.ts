/**
 * @fileoverview 插件 SDK（v2 / Cordis 契约）公共类型出口。
 * @description
 * 插件作者从本模块导入类型（`Context` 与各能力服务）。导入本模块会加载
 * `@cordisjs/core` 的 `Context` 类型扩展，从而在 TS 侧获得 `ctx.storage` / `ctx.domains` 等。
 *
 * 说明：本模块只导出类型，运行时零体积（`import type`）。
 */

export type {
  Context,
  Plugin,
  PluginAiService,
  PluginDomainsService,
  PluginFetchResponse,
  PluginIpcService,
  PluginMessagesService,
  PluginNetworkService,
  PluginServerService,
  PluginStorageService,
  PluginUiService,
} from "../runtime/types";
