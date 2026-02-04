/**
 * @fileoverview pluginTypes.ts
 * @description Domain types for plugin center (no framework dependencies).
 */

export type PluginSource = "server" | "repo";

export type PluginDomainPort = {
  id: string;
  label: string;
  version: string;
  colorVar:
    | "--cp-domain-core"
    | "--cp-domain-ext-a"
    | "--cp-domain-ext-b"
    | "--cp-domain-ext-c"
    | "--cp-domain-unknown";
};

export type PluginPermission = {
  key: string;
  label: string;
  risk: "low" | "medium" | "high";
};

export type PluginCatalogEntry = {
  pluginId: string;
  name: string;
  tagline: string;
  description: string;
  homepage?: string;
  source: PluginSource;
  downloadUrl?: string;
  sha256: string;
  required: boolean;
  versions: string[];
  providesDomains: PluginDomainPort[];
  permissions: PluginPermission[];
};

export type PluginRuntimeEntry = {
  serverId: string;
  pluginId: string;
  version: string;
  entry: string;
  permissions: string[];
  providesDomains: Array<{ domain: string; domain_version: string }>;
  minHostVersion: string;
};

export type InstalledPluginState = {
  pluginId: string;
  installedVersions: string[];
  currentVersion: string | null;
  enabled: boolean;
  status: "ok" | "failed";
  lastError: string;
};

export type PluginProgressStage =
  | "select_version"
  | "confirm"
  | "checking_updates"
  | "downloading"
  | "verifying_sha256"
  | "unpacking"
  | "switching"
  | "rolling_back"
  | "installed"
  | "enabling"
  | "enabled"
  | "failed";

export type PluginProgress = {
  pluginId: string;
  stage: PluginProgressStage;
  percent: number;
  message: string;
};
