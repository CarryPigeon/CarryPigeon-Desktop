/**
 * @fileoverview MessageStore.ts 文件职责说明。
 */
import type { MessageIdLike, MessageStorePort, MessageStoreRecord } from "../ports/MessageStorePort";

export class MessageStore {
  constructor(private readonly store: MessageStorePort) {}

  /**
   * create method.
   * @param record - TODO.
   * @returns TODO.
   */
  create(record: MessageStoreRecord): Promise<void> {
    return this.store.create(record);
  }

  /**
   * update method.
   * @param record - TODO.
   * @returns TODO.
   */
  update(record: MessageStoreRecord): Promise<void> {
    return this.store.update(record);
  }

  /**
   * delete method.
   * @param messageId - TODO.
   * @returns TODO.
   */
  delete(messageId: string): Promise<void> {
    return this.store.delete(messageId);
  }

  /**
   * getById method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @param messageId - TODO.
   * @returns TODO.
   */
  getById(serverSocket: string, channelId: number, messageId: string): Promise<MessageStoreRecord | null> {
    return this.store.getById(serverSocket, channelId, messageId);
  }

  /**
   * listByChannel method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @param fromId - TODO.
   * @param toId - TODO.
   * @returns TODO.
   */
  listByChannel(
    serverSocket: string,
    channelId: number,
    fromId?: MessageIdLike,
    toId?: MessageIdLike,
  ): Promise<MessageStoreRecord[]> {
    return this.store.listByChannel(serverSocket, channelId, fromId, toId);
  }

  /**
   * listByKeyword method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @param keyword - TODO.
   * @returns TODO.
   */
  listByKeyword(serverSocket: string, channelId: number, keyword: string): Promise<MessageStoreRecord[]> {
    return this.store.listByKeyword(serverSocket, channelId, keyword);
  }

  /**
   * listByUser method.
   * @param serverSocket - TODO.
   * @param userId - TODO.
   * @param fromId - TODO.
   * @param toId - TODO.
   * @returns TODO.
   */
  listByUser(
    serverSocket: string,
    userId: number,
    fromId?: MessageIdLike,
    toId?: MessageIdLike,
  ): Promise<MessageStoreRecord[]> {
    return this.store.listByUser(serverSocket, userId, fromId, toId);
  }

  /**
   * listByTimeRange method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @param fromTimeMs - TODO.
   * @param toTimeMs - TODO.
   * @returns TODO.
   */
  listByTimeRange(
    serverSocket: string,
    channelId: number,
    fromTimeMs: number,
    toTimeMs: number,
  ): Promise<MessageStoreRecord[]> {
    return this.store.listByTimeRange(serverSocket, channelId, fromTimeMs, toTimeMs);
  }

  /**
   * getLatestLocalMessageDate method.
   * @param serverSocket - TODO.
   * @param channelId - TODO.
   * @returns TODO.
   */
  getLatestLocalMessageDate(serverSocket: string, channelId: number): Promise<number | null> {
    return this.store.getLatestLocalMessageDate(serverSocket, channelId);
  }
}
