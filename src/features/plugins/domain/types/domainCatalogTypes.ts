/**
 * @fileoverview plugins｜领域类型：domainCatalogTypes。
 * @description
 * Domain catalog 用于“契约发现（contract discovery）”与“缺少 provider”提示 UX。
 *
 * 说明：
 * - 字段命名遵循前端领域层的驼峰风格；
 * - 该类型不依赖 Vue/Tauri 等平台库，可被 presentation/usecases 复用。
 */

/**
 * domain 的提供方描述（Core 或 Plugin）。
 */
export type DomainProvider =
  | { type: "core" }
  | { type: "plugin"; pluginId: string; minPluginVersion?: string };

/**
 * domain 合同（contract）指针：schema 地址 + 内容哈希。
 */
export type DomainContractPointer = {
  schemaUrl: string;
  sha256: string;
};

/**
 * domain 约束信息（服务端可扩展字段）。
 */
export type DomainConstraints = {
  maxPayloadBytes?: number;
  maxDepth?: number;
  [key: string]: unknown;
};

/**
 * domain 目录条目（用于发现支持版本/推荐版本/约束/提供方等信息）。
 */
export type DomainCatalogItem = {
  domain: string;
  supportedVersions: string[];
  recommendedVersion: string;
  constraints: DomainConstraints;
  providers: DomainProvider[];
  contract?: DomainContractPointer;
};

