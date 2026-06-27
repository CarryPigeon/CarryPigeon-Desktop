/**
 * @fileoverview 基于自适应排序器的异步 mergeMessages。
 */

import type { ChatMessage } from "@/features/chat/message-flow/domain/contracts";
import { dedupeMessages } from "@/features/chat/message-flow/domain/mappers/messageModel";
import type { createAdaptiveMessageSorter } from "./adaptiveMessageSorter";

export function createAdaptiveMergeMessages(
  sorter: ReturnType<typeof createAdaptiveMessageSorter>,
): (existing: ChatMessage[], incoming: ChatMessage[]) => Promise<ChatMessage[]> {
  return async (existing, incoming) => {
    const combined = dedupeMessages([...existing, ...incoming]);
    return sorter.sort(combined);
  };
}
