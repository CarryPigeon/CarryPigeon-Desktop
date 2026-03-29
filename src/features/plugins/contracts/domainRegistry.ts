/**
 * @fileoverview plugins domain registry contracts
 * @description
 * 定义 plugins runtime 与宿主协作时使用的稳定 domain registry 契约。
 */

import type { Component } from "vue";
import type { PluginComposerPayload } from "@/features/plugins/domain/types/pluginRuntimeTypes";

export type DomainBinding = {
  pluginId: string;
  pluginVersion: string;
  domain: string;
  domainVersion: string;
  renderer?: Component;
  composer?: Component;
  contract?: unknown;
};

export type DomainRegistryHostBridge = {
  getCid(): string;
  sendMessage(payload: PluginComposerPayload): Promise<void>;
};
