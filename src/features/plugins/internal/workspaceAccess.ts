/**
 * @fileoverview plugins internal workspace access
 * @description
 * 根入口内部访问层：暴露工作区级查询、刷新与安装态协作能力。
 */

export {
  createPluginsWorkspaceCapabilities,
  getPluginsWorkspaceSnapshot,
  listInstalledPlugins,
  refreshDomainCatalog,
} from "../application/workspaceService";
