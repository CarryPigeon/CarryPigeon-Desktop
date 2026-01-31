/**
 * @fileoverview channelStore.di.ts 文件职责说明。
 */
import { localChannelStoreAdapter } from "../data/localChannelStoreAdapter";
import { ChannelStore } from "../domain/usecases/ChannelStore";

let instance: ChannelStore | null = null;

/**
 * getChannelStoreUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getChannelStoreUsecase(): ChannelStore {
  if (instance) return instance;
  instance = new ChannelStore(localChannelStoreAdapter);
  return instance;
}
