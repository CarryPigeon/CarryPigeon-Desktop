/**
 * @fileoverview pluginInstallOperations.ts
 * @description plugins｜展示层编排：安装态操作类型与常量定义。
 */

export const PLUGIN_INSTALL_OPERATION = {
  install: "install",
  update: "update",
  switchVersion: "switch_version",
  rollback: "rollback",
  enable: "enable",
  disable: "disable",
  uninstall: "uninstall",
} as const;

export type PluginInstallOperation =
  (typeof PLUGIN_INSTALL_OPERATION)[keyof typeof PLUGIN_INSTALL_OPERATION];

