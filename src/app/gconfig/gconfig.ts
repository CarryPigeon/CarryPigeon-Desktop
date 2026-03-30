/**
 * @fileoverview 全局运行时注入配置。
 * @description
 * 为 feature 级 DI 提供稳定、可测试的配置来源，避免各 feature
 * 直接散落读取 env/mock-mode 细节。
 */

import { MOCK_MODE } from "@/shared/config/runtime";

/**
 * 特性依赖注入时可选的数据来源。
 *
 * - `data`：走真实 data adapter；若启用了 protocol mock，则由更底层 transport 拦截。
 * - `mock`：直接注入 feature 内存 mock 实现。
 */
export type FeatureDataSource = "data" | "mock";

/**
 * chat feature 的运行时注入配置。
 */
export type ChatInjectionConfig = {
  /**
   * chat runtime aggregate store 的来源。
   */
  runtimeDataSource: FeatureDataSource;
  /**
   * message-flow/upload 文件服务端口的来源。
   */
  uploadDataSource: FeatureDataSource;
};

/**
 * 当前应用的全局依赖注入配置。
 */
export type GConfig = {
  chat: ChatInjectionConfig;
};

function resolveChatDataSource(): FeatureDataSource {
  return MOCK_MODE === "store" ? "mock" : "data";
}

/**
 * 全局依赖注入配置对象。
 *
 * 约定：
 * - `store` mock 模式注入 feature/mock 实现；
 * - `off` 与 `protocol` 都走 data 层，`protocol` 的 mock 由 transport 层负责。
 */
export const gconfig: GConfig = {
  chat: {
    runtimeDataSource: resolveChatDataSource(),
    uploadDataSource: resolveChatDataSource(),
  },
};

