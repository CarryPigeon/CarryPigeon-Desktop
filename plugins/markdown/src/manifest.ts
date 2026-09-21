// 插件清单出口：从 manifest.json 读取单一真源，避免重复维护版本号。
import manifest from "../manifest.json";

export const markdownManifest = manifest;
export const PLUGIN_ID = manifest.pluginId;
export const PLUGIN_VERSION = manifest.version;
