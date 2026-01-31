/**
 * @fileoverview ChannelStore.ts 文件职责说明。
 */
import type { ChannelStorePort, ChannelStoreRecord } from "../ports/ChannelStorePort";

export class ChannelStore {
  constructor(private readonly store: ChannelStorePort) {}

  /**
   * upsert method.
   * @param record - TODO.
   * @returns TODO.
   */
  upsert(record: ChannelStoreRecord): Promise<void> {
    return this.store.upsert(record);
  }

  /**
   * remove method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @returns TODO.
   */
  remove(serverSocket: string, channelId: number): Promise<void> {
    return this.store.remove(serverSocket, channelId);
  }

  /**
   * getAll method.
   * @returns TODO.
   */
  getAll(): Promise<ChannelStoreRecord[]> {
    return this.store.getAll();
  }

  /**
   * getAllByServerSocket method.
   * @param serverSocket - TODO.
   * @returns TODO.
   */
  getAllByServerSocket(serverSocket: string): Promise<ChannelStoreRecord[]> {
    return this.store.getAllByServerSocket(serverSocket);
  }

  /**
   * getById method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @returns TODO.
   */
  getById(serverSocket: string, channelId: number): Promise<ChannelStoreRecord | null> {
    return this.store.getById(serverSocket, channelId);
  }

  /**
   * getByName method.
   * @param serverSocket - TODO.
   * @param name - TODO.
   * @returns TODO.
   */
  getByName(serverSocket: string, name: string): Promise<ChannelStoreRecord | null> {
    return this.store.getByName(serverSocket, name);
  }

  /**
   * getByOwnerId method.
   * @param serverSocket - TODO.
   * @param ownerId - TODO.
   * @returns TODO.
   */
  getByOwnerId(serverSocket: string, ownerId: number): Promise<ChannelStoreRecord | null> {
    return this.store.getByOwnerId(serverSocket, ownerId);
  }

  /**
   * getByAdminIds method.
   * @param serverSocket - TODO.
   * @param adminIds - TODO.
   * @returns TODO.
   */
  getByAdminIds(serverSocket: string, adminIds: number[]): Promise<ChannelStoreRecord[]> {
    return this.store.getByAdminIds(serverSocket, adminIds);
  }
}
