/**
 * @fileoverview chat composition-level dependency selector。
 * @description
 * 统一根据全局配置决定 chat 注入 data 层还是 mock 层实现。
 *
 * 说明：
 * - `composition/` 是 chat 唯一装配层；
 * - 不再单独保留 `di/` 目录；
 * - 本文件只负责“选哪种实现”，不承载子域业务规则。
 */

import { gconfig } from "@/app/gconfig/gconfig";
import { httpFileServicePort } from "@/shared/file-transfer/httpFileServicePort";
import type { FileServicePort } from "@/shared/file-transfer/fileServicePort";
import { createChatRuntimeContainer } from "@/features/chat/composition/createChatRuntimeContainer";
import { createMockChatStore } from "@/features/chat/mock/mockChatStore";
import { createChatRuntimeStore } from "@/features/chat/composition/store/createChatRuntimeStore";
import type { ChatRuntimeAggregateStore } from "@/features/chat/composition/contracts/chatStoreTypes";
import { mockFileServicePort } from "@/features/chat/message-flow/upload/data/mock/mockFileServicePort";

let chatAggregateStore: ChatRuntimeAggregateStore | null = null;
let uploadFileServicePort: FileServicePort | null = null;

/**
 * 创建 chat 聚合 store。
 *
 * 说明：
 * - `data`：装配真实 runtime container，再构造 live aggregate store；
 * - `mock`：直接注入 feature 内存 mock store。
 */
export function createChatAggregateStore(): ChatRuntimeAggregateStore {
  if (gconfig.chat.runtimeDataSource === "mock") {
    return createMockChatStore();
  }

  const container = createChatRuntimeContainer();
  return createChatRuntimeStore(container.gateways);
}

/**
 * 获取缓存后的 chat 聚合 store。
 *
 * chat feature 内部只保留一个 aggregate store 实例，避免 capability/store
 * 读取到不一致的运行时对象。
 */
export function getChatAggregateStore(): ChatRuntimeAggregateStore {
  if (!chatAggregateStore) {
    chatAggregateStore = createChatAggregateStore();
  }
  return chatAggregateStore;
}

/**
 * 获取 chat 上传子包使用的文件服务端口。
 */
export function getChatUploadFileServicePort(): FileServicePort {
  if (uploadFileServicePort) return uploadFileServicePort;

  uploadFileServicePort =
    gconfig.chat.uploadDataSource === "mock"
      ? mockFileServicePort
      : httpFileServicePort;

  return uploadFileServicePort;
}
