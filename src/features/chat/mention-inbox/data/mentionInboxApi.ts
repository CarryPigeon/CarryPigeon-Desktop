/**
 * @fileoverview mention-inbox HTTP 适配器。
 * @description 复用 chat HTTP port，把参数收敛为领域查询。
 */

import { httpChatApiPort } from "@/features/chat/data/chat-api/httpChatApiPort";
import { IS_STORE_MOCK } from "@/shared/config/runtime";
import type { MentionInboxApiPort } from "../domain/ports";

/**
 * 创建提及收件箱远端适配器。
 */
export function createMentionInboxApi(): MentionInboxApiPort {
  if (IS_STORE_MOCK) {
    return {
      async listMentions() {
        return { items: [], hasMore: false };
      },
      async markMentionRead() {},
      async batchMarkMentionsRead() {},
    };
  }
  return {
    listMentions(serverSocket, accessToken, query) {
      return httpChatApiPort.listMentions(
        serverSocket,
        accessToken,
        query.cursor,
        query.limit,
        query.unreadOnly,
        query.channelId,
      );
    },
    markMentionRead(serverSocket, accessToken, mentionId) {
      return httpChatApiPort.markMentionRead(serverSocket, accessToken, mentionId);
    },
    batchMarkMentionsRead(serverSocket, accessToken, beforeMentionId, channelId) {
      return httpChatApiPort.batchMarkMentionsRead(serverSocket, accessToken, beforeMentionId, channelId);
    },
  };
}
