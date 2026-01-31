/**
 * @fileoverview messageStore.di.ts 文件职责说明。
 */
import { localMessageStoreAdapter } from "../data/localMessageStoreAdapter";
import { MessageStore } from "../domain/usecases/MessageStore";

let instance: MessageStore | null = null;

/**
 * getMessageStoreUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getMessageStoreUsecase(): MessageStore {
  if (instance) return instance;
  instance = new MessageStore(localMessageStoreAdapter);
  return instance;
}
