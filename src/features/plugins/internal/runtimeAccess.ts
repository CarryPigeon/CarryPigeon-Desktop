/**
 * @fileoverview plugins internal runtime access
 * @description
 * 根入口内部访问层：暴露运行时加载、host bridge 与 domain 查询能力。
 */

export {
  attachPluginHostBridge,
  detachPluginHostBridge,
  ensurePluginRuntimeLoaded,
  getAvailableMessageDomains,
  getPluginRuntimeCapabilities,
  resolveDomainPluginHint,
} from "../application/runtimeService";
