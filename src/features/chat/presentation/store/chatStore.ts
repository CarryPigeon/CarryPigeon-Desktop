/**
 * @fileoverview chatStore.ts
 * @description Chat store facade for presentation components.
 *
 * Clean Architecture note:
 * - Store selection (mock vs live) is decided by `src/features/chat/di/chat.di.ts`.
 * - Presentation code imports this module, not data adapters directly.
 */

import { getChatStore } from "@/features/chat/di/chat.di";

const impl = getChatStore();

export type {
  ChatMessage,
  ChatChannel,
  ChatMember,
  MessageDomain,
  ComposerSubmitPayload,
  ChannelMember,
  ChannelApplication,
  ChannelBan,
} from "./chatStoreTypes";

/**
 * Filtered channel list for the rail.
 *
 * @constant
 */
export const channels = impl.channels;

/**
 * Unfiltered channel list (used by quick switcher and info pages).
 *
 * @constant
 */
export const allChannels = impl.allChannels;

/**
 * Channel search query used to filter the rail list.
 *
 * @constant
 */
export const channelSearch = impl.channelSearch;

/**
 * Current channel rail tab.
 *
 * @constant
 */
export const channelTab = impl.channelTab;

/**
 * Draft text inside the composer.
 *
 * @constant
 */
export const composerDraft = impl.composerDraft;

/**
 * Selected domain id for the composer (e.g. `Core:Text` or `Ext:Custom`).
 *
 * @constant
 */
export const selectedDomainId = impl.selectedDomainId;

/**
 * Message id the user is currently replying to (empty string means no reply).
 *
 * @constant
 */
export const replyToMessageId = impl.replyToMessageId;

/**
 * Last send/delete error message (UI banner).
 *
 * @constant
 */
export const sendError = impl.sendError;

/**
 * Currently selected channel id for the chat view.
 *
 * @constant
 */
export const currentChannelId = impl.currentChannelId;

/**
 * Current channel messages.
 *
 * @constant
 */
export const currentMessages = impl.currentMessages;

/**
 * Whether the current channel has more history pages (cursor pagination).
 *
 * @constant
 */
export const currentChannelHasMore = impl.currentChannelHasMore;

/**
 * Whether a "load more messages" request is currently in-flight.
 *
 * @constant
 */
export const loadingMoreMessages = impl.loadingMoreMessages;

/**
 * Current channel last read timestamp in ms.
 *
 * @constant
 */
export const currentChannelLastReadTimeMs = impl.currentChannelLastReadTimeMs;

/**
 * Member list for the current channel/server (best-effort).
 *
 * @constant
 */
export const members = impl.members;

/**
 * Ensure chat data and push connection are ready for the current server.
 *
 * @returns Promise<void>
 */
export function ensureChatReady(): Promise<void> {
  return impl.ensureChatReady();
}

/**
 * Domain list for composer: core + enabled plugin domains.
 *
 * @returns Domain list.
 */
export function availableDomains() {
  return impl.availableDomains();
}

/**
 * Lookup a message by id within a channel.
 *
 * @param channelId - Channel id in which to search.
 * @param messageId - Message id to find.
 * @returns The message when found, otherwise `null`.
 */
export function getMessageById(channelId: string, messageId: string) {
  return impl.getMessageById(channelId, messageId);
}

/**
 * Select a channel.
 *
 * @param id - Target channel id.
 * @returns Promise<void>.
 */
export function selectChannel(id: string): Promise<void> {
  return impl.selectChannel(id);
}

/**
 * Report read state for the current channel (best-effort).
 *
 * @returns Promise<void>
 */
export function reportCurrentReadState(): Promise<void> {
  return impl.reportCurrentReadState();
}

/**
 * Load the next page of older messages for the current channel (cursor pagination).
 *
 * @returns Promise<void>
 */
export function loadMoreMessages(): Promise<void> {
  return impl.loadMoreMessages();
}

/**
 * Apply/join a channel.
 *
 * @param channelId - Target channel id.
 * @returns Promise<void>.
 */
export function applyJoin(channelId: string): Promise<void> {
  return impl.applyJoin(channelId);
}

/**
 * Update channel metadata.
 *
 * @param channelId - Channel id.
 * @param patch - Patch payload.
 * @returns Promise<void>.
 */
export function updateChannelMeta(channelId: string, patch: { name?: string; brief?: string }): Promise<void> {
  return impl.updateChannelMeta(channelId, patch);
}

/**
 * Enter reply mode for a message.
 *
 * @param messageId - Message id.
 * @returns void.
 */
export function startReply(messageId: string): void {
  return impl.startReply(messageId);
}

/**
 * Exit reply mode without sending.
 *
 * @returns void.
 */
export function cancelReply(): void {
  return impl.cancelReply();
}

/**
 * Delete (hard-delete) a message by id.
 *
 * @param messageId - Message id.
 * @returns Promise<void>.
 */
export function deleteMessage(messageId: string): Promise<void> {
  return impl.deleteMessage(messageId);
}

/**
 * Send the current composer draft as a message.
 *
 * @param payload - Optional plugin-supplied payload (domain + version + data).
 * @returns Promise<void>.
 */
export function sendComposerMessage(payload?: Parameters<typeof impl.sendComposerMessage>[0]): Promise<void> {
  return impl.sendComposerMessage(payload);
}

// ============================================================================
// Channel management methods
// ============================================================================

/**
 * List channel members.
 *
 * @param channelId - Channel id.
 * @returns Promise<ChannelMember[]>.
 */
export function listMembers(channelId: string) {
  return impl.listMembers(channelId);
}

/**
 * Kick a member from a channel.
 *
 * @param channelId - Channel id.
 * @param uid - User id.
 * @returns Promise<void>.
 */
export function kickMember(channelId: string, uid: string): Promise<void> {
  return impl.kickMember(channelId, uid);
}

/**
 * Set a user as admin.
 *
 * @param channelId - Channel id.
 * @param uid - User id.
 * @returns Promise<void>.
 */
export function setAdmin(channelId: string, uid: string): Promise<void> {
  return impl.setAdmin(channelId, uid);
}

/**
 * Remove a user from admin.
 *
 * @param channelId - Channel id.
 * @param uid - User id.
 * @returns Promise<void>.
 */
export function removeAdmin(channelId: string, uid: string): Promise<void> {
  return impl.removeAdmin(channelId, uid);
}

/**
 * List join applications for a channel.
 *
 * @param channelId - Channel id.
 * @returns Promise<ChannelApplication[]>.
 */
export function listApplications(channelId: string) {
  return impl.listApplications(channelId);
}

/**
 * Decide a join application.
 *
 * @param channelId - Channel id.
 * @param applicationId - Application id.
 * @param approved - Whether to approve.
 * @returns Promise<void>.
 */
export function decideApplication(channelId: string, applicationId: string, approved: boolean): Promise<void> {
  return impl.decideApplication(channelId, applicationId, approved);
}

/**
 * List bans for a channel.
 *
 * @param channelId - Channel id.
 * @returns Promise<ChannelBan[]>.
 */
export function listBans(channelId: string) {
  return impl.listBans(channelId);
}

/**
 * Ban a user from a channel.
 *
 * @param channelId - Channel id.
 * @param uid - User id.
 * @param until - Ban until timestamp (ms).
 * @param reason - Ban reason.
 * @returns Promise<void>.
 */
export function setBan(channelId: string, uid: string, until: number, reason: string): Promise<void> {
  return impl.setBan(channelId, uid, until, reason);
}

/**
 * Remove a ban from a user.
 *
 * @param channelId - Channel id.
 * @param uid - User id.
 * @returns Promise<void>.
 */
export function removeBan(channelId: string, uid: string): Promise<void> {
  return impl.removeBan(channelId, uid);
}

/**
 * Create a channel.
 *
 * @param name - Channel name.
 * @param brief - Channel brief.
 * @returns Promise<ChatChannel>.
 */
export function createChannel(name: string, brief?: string) {
  return impl.createChannel(name, brief);
}

/**
 * Delete a channel.
 *
 * @param channelId - Channel id.
 * @returns Promise<void>.
 */
export function deleteChannel(channelId: string): Promise<void> {
  return impl.deleteChannel(channelId);
}
