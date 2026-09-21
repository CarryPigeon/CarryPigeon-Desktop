/**
 * @fileoverview mock 插件目录（mockPluginCatalog.ts）。
 * @description 用于本地 UI 预览的 mock 插件目录（无需后端）。
 */

/**
 * mock 插件提供的 domain 描述。
 */
export type MockPluginDomain = {
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

/**
 * mock 插件权限声明条目（用于权限 UI 展示）。
 */
export type MockPluginPermission = {
  key: string;
  label: string;
  risk: "low" | "medium" | "high";
};

/**
 * mock 插件目录条目（用于插件中心 UI 预览）。
 */
export type MockPluginEntry = {
  pluginId: string;
  name: string;
  tagline: string;
  description: string;
  homepage?: string;
  source: "server" | "repo";
  downloadUrl?: string;
  sha256: string;
  required: boolean;
  versions: string[];
  providesDomains: MockPluginDomain[];
  permissions: MockPluginPermission[];
};

/**
 * 静态 mock 插件目录（用于 UI 预览）。
 *
 * @constant
 */
export const MOCK_PLUGIN_CATALOG: MockPluginEntry[] = [
  {
    pluginId: "core.text",
    name: "Core Text",
    tagline: "Plain signal encoder/decoder",
    description:
      "Provides the baseline text domain for chat. In Patchbay, 'text' is just another signal you can route and transform.",
    source: "server",
    sha256: "b9b0b0d1d2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9",
    required: true,
    versions: ["1.2.0", "1.1.1", "1.1.0"],
    providesDomains: [{ id: "Core:Text", label: "Core:Text", version: "1.0.0", colorVar: "--cp-domain-core" }],
    permissions: [
      { key: "compose", label: "Compose messages", risk: "low" },
      { key: "render", label: "Render messages", risk: "low" },
    ],
  },
  {
    pluginId: "ext.codec",
    name: "Ext Codec",
    tagline: "Custom payload decode pipeline",
    description:
      "Decodes custom payloads into readable previews and rich render output. This entry exists to validate the host/plugin contract end-to-end.",
    source: "server",
    sha256: "79a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8",
    required: true,
    versions: ["0.9.0", "0.8.3"],
    providesDomains: [{ id: "Ext:Alpha", label: "Ext:Alpha", version: "1.0.0", colorVar: "--cp-domain-ext-a" }],
    permissions: [
      { key: "render", label: "Render custom payloads", risk: "low" },
      { key: "clipboard", label: "Copy rendered preview", risk: "low" },
    ],
  },
  {
    pluginId: "ext.styler",
    name: "Ext Styler",
    tagline: "Expressive renderer presets",
    description:
      "Adds expressive render styles for a custom domain. Demonstrates a non-required, repo-sourced extension module.",
    source: "repo",
    downloadUrl: "https://repo.example.com/plugins/ext.styler/0.3.2.zip",
    sha256: "0fa1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b6c7d8e9",
    required: false,
    versions: ["0.3.2", "0.3.1"],
    providesDomains: [{ id: "Ext:Beta", label: "Ext:Beta", version: "1.0.0", colorVar: "--cp-domain-ext-b" }],
    permissions: [{ key: "render", label: "Render styled content", risk: "low" }],
  },
  {
    pluginId: "ext.bridge",
    name: "Ext Bridge",
    tagline: "High-permission integration bridge",
    description:
      "Demonstrates a high-permission plugin entry (network + filesystem). Included to validate permission UI and failure handling.",
    source: "repo",
    downloadUrl: "https://repo.example.com/plugins/ext.bridge/2.1.0.zip",
    sha256: "e9d8c7b6a59483726150f4e3d2c1b0a9f8e7d6c5b4a392817161504f3e2d1c0b",
    required: false,
    versions: ["2.1.0"],
    providesDomains: [{ id: "Ext:Gamma", label: "Ext:Gamma", version: "1.0.0", colorVar: "--cp-domain-ext-c" }],
    permissions: [
      { key: "network", label: "Access network sockets", risk: "high" },
      { key: "fs", label: "Read/write local files", risk: "high" },
    ],
  },
  {
    pluginId: "theme",
    name: "Theme Switcher",
    tagline: "Light / dark / patchbay themes and accents",
    description:
      "Client-side theme plugin: cycles host themes (light/dark/patchbay) and accent colors, persisting the preference via plugin storage. Enabled by default.",
    source: "repo",
    downloadUrl: "https://repo.example.com/plugins/theme/0.1.0.zip",
    sha256: "aa11bb22cc33dd44ee55ff6600112233445566778899aabbccddeeff0011223",
    required: false,
    versions: ["0.1.0"],
    providesDomains: [],
    permissions: [
      { key: "ui", label: "Register toolbar entry", risk: "low" },
      { key: "storage", label: "Persist theme preference", risk: "low" },
    ],
  },
  {
    pluginId: "markdown",
    name: "Markdown Messages",
    tagline: "Safe markdown composer & renderer",
    description:
      "Local markdown message plugin: provides the 'markdown' message domain with a textarea composer and a safe, dependency-free markdown renderer. Enabled by default.",
    source: "repo",
    downloadUrl: "https://repo.example.com/plugins/markdown/0.1.0.zip",
    sha256: "bb22cc33dd44ee55ff6600112233445566778899aabbccddeeff0011223344",
    required: false,
    versions: ["0.1.0"],
    providesDomains: [{ id: "markdown", label: "Markdown", version: "1", colorVar: "--cp-domain-ext-a" }],
    permissions: [
      { key: "render", label: "Render markdown messages", risk: "low" },
      { key: "compose", label: "Compose markdown messages", risk: "low" },
      { key: "storage", label: "Persist drafts", risk: "low" },
    ],
  },
  {
    pluginId: "group-notice",
    name: "Group Notice",
    tagline: "Server-sourced group notifications",
    description:
      "Server-sourced plugin for group notifications: renders group_notice messages and fetches the notice list from the current server origin. Enabled by default.",
    source: "server",
    sha256: "cc33dd44ee55ff6600112233445566778899aabbccddeeff0011223344556",
    required: false,
    versions: ["0.1.0"],
    providesDomains: [{ id: "group_notice", label: "GroupNotice", version: "1", colorVar: "--cp-domain-ext-b" }],
    permissions: [
      { key: "render", label: "Render group notices", risk: "low" },
      { key: "network", label: "Fetch notices from current server", risk: "medium" },
      { key: "storage", label: "Persist read cursor", risk: "low" },
    ],
  },
  {
    pluginId: "ai-summary",
    name: "AI Summary",
    tagline: "Channel digest via server AI endpoint",
    description:
      "Summarizes the current channel by calling the current server origin's /api/ai/summarize endpoint, showing the result in an overlay panel. Enabled by default.",
    source: "repo",
    downloadUrl: "https://repo.example.com/plugins/ai-summary/0.1.0.zip",
    sha256: "dd44ee55ff6600112233445566778899aabbccddeeff001122334455667788",
    required: false,
    versions: ["0.1.0"],
    providesDomains: [{ id: "ai_summary", label: "AiSummary", version: "1", colorVar: "--cp-domain-ext-c" }],
    permissions: [
      { key: "network", label: "Call current server AI endpoint", risk: "medium" },
      { key: "storage", label: "Cache summaries", risk: "low" },
    ],
  },
];
