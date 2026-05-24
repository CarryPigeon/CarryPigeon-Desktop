/**
 * @fileoverview Draft persistence port — abstracts storage backend for per-channel message drafts.
 */

export type DraftRecord = {
  channelId: string;
  text: string;
  updatedAt: number;
};

export type DraftStoragePort = {
  readDraft(channelId: string): DraftRecord | null;
  saveDraft(draft: DraftRecord): void;
  deleteDraft(channelId: string): void;
};
