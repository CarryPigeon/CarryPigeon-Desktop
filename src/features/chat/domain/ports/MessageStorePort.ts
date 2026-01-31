/**
 * @fileoverview MessageStorePort.ts 文件职责说明。
 */
export type MessageStoreRecord = {
  serverSocket: string;
  messageId: string;
  channelId: number;
  userId: number;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type MessageIdLike = string | number | bigint | null | undefined;

export interface MessageStorePort {
  create(record: MessageStoreRecord): Promise<void>;
  update(record: MessageStoreRecord): Promise<void>;
  delete(messageId: string): Promise<void>;
  getById(serverSocket: string, channelId: number, messageId: string): Promise<MessageStoreRecord | null>;
  listByChannel(
    serverSocket: string,
    channelId: number,
    fromId?: MessageIdLike,
    toId?: MessageIdLike,
  ): Promise<MessageStoreRecord[]>;
  listByKeyword(serverSocket: string, channelId: number, keyword: string): Promise<MessageStoreRecord[]>;
  listByUser(
    serverSocket: string,
    userId: number,
    fromId?: MessageIdLike,
    toId?: MessageIdLike,
  ): Promise<MessageStoreRecord[]>;
  listByTimeRange(
    serverSocket: string,
    channelId: number,
    fromTimeMs: number,
    toTimeMs: number,
  ): Promise<MessageStoreRecord[]>;
  getLatestLocalMessageDate(serverSocket: string, channelId: number): Promise<number | null>;
}
