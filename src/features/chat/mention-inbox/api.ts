/**
 * @fileoverview chat/mention-inbox 对外 API。
 */

import type { MentionInboxCapabilities } from "./api-types";
import { createMentionInboxCapabilitySource } from "./capability-source";

export type { MentionInboxCapabilities, MentionInboxItem, MentionInboxSnapshot } from "./api-types";

export function createMentionInboxCapabilities(): MentionInboxCapabilities {
  return createMentionInboxCapabilitySource();
}

let mentionInboxCapabilitiesSingleton: MentionInboxCapabilities | null = null;

export function getMentionInboxCapabilities(): MentionInboxCapabilities {
  mentionInboxCapabilitiesSingleton ??= createMentionInboxCapabilities();
  return mentionInboxCapabilitiesSingleton;
}
