/**
 * @fileoverview ChannelStorePort.ts 文件职责说明。
 */
export type ChannelStoreRecord = {
  id: number;
  name: string;
  serverSocket: string;
  ownerId: number;
  createdAt: number;
  adminIds: number[];
  memberIds: number[];
};

export interface ChannelStorePort {
  upsert(record: ChannelStoreRecord): Promise<void>;
  remove(serverSocket: string, channelId: number): Promise<void>;
  getAll(): Promise<ChannelStoreRecord[]>;
  getAllByServerSocket(serverSocket: string): Promise<ChannelStoreRecord[]>;
  getById(serverSocket: string, channelId: number): Promise<ChannelStoreRecord | null>;
  getByName(serverSocket: string, name: string): Promise<ChannelStoreRecord | null>;
  getByOwnerId(serverSocket: string, ownerId: number): Promise<ChannelStoreRecord | null>;
  getByAdminIds(serverSocket: string, adminIds: number[]): Promise<ChannelStoreRecord[]>;
}
