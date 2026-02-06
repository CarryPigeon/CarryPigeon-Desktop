/**
 * @fileoverview chatStore.ts
 * @description chat｜展示层状态（store）：chatStore。
 *
 * 架构说明（Clean Architecture）：
 * - store 的实现选择（mock vs live）由 `src/features/chat/di/chat.di.ts` 决定。
 * - 展示层（页面/组件）只应 import 本模块，不应直接依赖 data adapter。
 */

import { getChatStore } from "@/features/chat/di/chat.di";

const impl = getChatStore();

/**
 * 对外重导出的聊天 store 类型集合。
 *
 * 说明：
 * - 页面/组件应尽量只从本模块导入类型，避免直接依赖 store 实现细节。
 */
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
 * 供频道栏（rail）展示使用的过滤后频道列表。
 *
 * @constant
 */
export const channels = impl.channels;

/**
 * 未过滤的频道列表（供 quick switcher 与信息页等使用）。
 *
 * @constant
 */
export const allChannels = impl.allChannels;

/**
 * 频道搜索关键词（用于过滤频道栏列表）。
 *
 * @constant
 */
export const channelSearch = impl.channelSearch;

/**
 * 当前频道栏 tab（joined/discover）。
 *
 * @constant
 */
export const channelTab = impl.channelTab;

/**
 * 编辑器草稿文本。
 *
 * @constant
 */
export const composerDraft = impl.composerDraft;

/**
 * 编辑器当前选中的 domain id（例如 `Core:Text` / 插件 domain）。
 *
 * @constant
 */
export const selectedDomainId = impl.selectedDomainId;

/**
 * 当前处于“回复模式”的目标消息 id（空字符串表示未回复任何消息）。
 *
 * @constant
 */
export const replyToMessageId = impl.replyToMessageId;

/**
 * 最近一次“发送/删除”失败的错误消息（用于 UI 提示条）。
 *
 * @constant
 */
export const sendError = impl.sendError;

/**
 * 当前选中的频道 id（聊天主视图使用）。
 *
 * @constant
 */
export const currentChannelId = impl.currentChannelId;

/**
 * 当前频道的消息列表。
 *
 * @constant
 */
export const currentMessages = impl.currentMessages;

/**
 * 当前频道是否还有更多历史消息页（游标分页）。
 *
 * @constant
 */
export const currentChannelHasMore = impl.currentChannelHasMore;

/**
 * 是否正在加载更早一页消息（请求进行中）。
 *
 * @constant
 */
export const loadingMoreMessages = impl.loadingMoreMessages;

/**
 * 当前频道“最后已读时间戳”（毫秒）。
 *
 * @constant
 */
export const currentChannelLastReadTimeMs = impl.currentChannelLastReadTimeMs;

/**
 * 当前频道/服务器的成员列表（best-effort）。
 *
 * @constant
 */
export const members = impl.members;

/**
 * 确保聊天数据与推送连接已就绪（当前 server scope）。
 *
 * @returns 无返回值。
 */
export function ensureChatReady(): Promise<void> {
  return impl.ensureChatReady();
}

/**
 * 编辑器可用 domain 列表：core + 已启用插件的 domain。
 *
 * @returns domain 列表。
 */
export function availableDomains() {
  return impl.availableDomains();
}

/**
 * 在指定频道中按 id 查找消息。
 *
 * @param channelId - 频道 id（搜索范围）。
 * @param messageId - 目标消息 id。
 * @returns 找到则返回消息；否则返回 `null`。
 */
export function getMessageById(channelId: string, messageId: string) {
  return impl.getMessageById(channelId, messageId);
}

/**
 * 选择一个频道（切换当前频道上下文）。
 *
 * @param id - 目标频道 id。
 * @returns Promise<void>。
 */
export function selectChannel(id: string): Promise<void> {
  return impl.selectChannel(id);
}

/**
 * 上报当前频道的已读状态（best-effort）。
 *
 * @returns Promise<void>
 */
export function reportCurrentReadState(): Promise<void> {
  return impl.reportCurrentReadState();
}

/**
 * 加载当前频道更早一页消息（游标分页）。
 *
 * @returns Promise<void>
 */
export function loadMoreMessages(): Promise<void> {
  return impl.loadMoreMessages();
}

/**
 * 申请加入频道。
 *
 * @param channelId - Target channel id.
 * @returns Promise<void>。
 */
export function applyJoin(channelId: string): Promise<void> {
  return impl.applyJoin(channelId);
}

/**
 * 更新频道元信息（名称/简介）。
 *
 * @param channelId - 频道 id。
 * @param patch - patch 载荷。
 * @returns Promise<void>。
 */
export function updateChannelMeta(channelId: string, patch: { name?: string; brief?: string }): Promise<void> {
  return impl.updateChannelMeta(channelId, patch);
}

/**
 * 进入回复模式（指定一条消息作为 reply 目标）。
 *
 * @param messageId - 目标消息 id。
 * @returns void。
 */
export function startReply(messageId: string): void {
  return impl.startReply(messageId);
}

/**
 * 退出回复模式（不发送）。
 *
 * @returns void。
 */
export function cancelReply(): void {
  return impl.cancelReply();
}

/**
 * 删除消息（硬删除）。
 *
 * @param messageId - 目标消息 id。
 * @returns Promise<void>。
 */
export function deleteMessage(messageId: string): Promise<void> {
  return impl.deleteMessage(messageId);
}

/**
 * 发送当前编辑器内容。
 *
 * @param payload - 可选的插件载荷（domain + version + data），用于替代 core-text 发送。
 * @returns Promise<void>。
 */
export function sendComposerMessage(payload?: Parameters<typeof impl.sendComposerMessage>[0]): Promise<void> {
  return impl.sendComposerMessage(payload);
}

// ============================================================================
// 频道管理方法（管理页使用）
// ============================================================================

/**
 * 列出频道成员。
 *
 * @param channelId - 频道 id。
 * @returns 成员列表。
 */
export function listMembers(channelId: string) {
  return impl.listMembers(channelId);
}

/**
 * 将成员踢出频道。
 *
 * @param channelId - 频道 id。
 * @param uid - 用户 id。
 * @returns 无返回值。
 */
export function kickMember(channelId: string, uid: string): Promise<void> {
  return impl.kickMember(channelId, uid);
}

/**
 * 设置管理员。
 *
 * @param channelId - 频道 id。
 * @param uid - 用户 id。
 * @returns 无返回值。
 */
export function setAdmin(channelId: string, uid: string): Promise<void> {
  return impl.setAdmin(channelId, uid);
}

/**
 * 取消管理员。
 *
 * @param channelId - 频道 id。
 * @param uid - 用户 id。
 * @returns 无返回值。
 */
export function removeAdmin(channelId: string, uid: string): Promise<void> {
  return impl.removeAdmin(channelId, uid);
}

/**
 * 列出频道入群申请（管理页使用）。
 *
 * @param channelId - 频道 id。
 * @returns 申请列表。
 */
export function listApplications(channelId: string) {
  return impl.listApplications(channelId);
}

/**
 * 处理入群申请（同意/拒绝）。
 *
 * @param channelId - 频道 id。
 * @param applicationId - 申请 id。
 * @param approved - 是否同意。
 * @returns 无返回值。
 */
export function decideApplication(channelId: string, applicationId: string, approved: boolean): Promise<void> {
  return impl.decideApplication(channelId, applicationId, approved);
}

/**
 * 列出频道禁言列表（管理页使用）。
 *
 * @param channelId - 频道 id。
 * @returns 禁言列表。
 */
export function listBans(channelId: string) {
  return impl.listBans(channelId);
}

/**
 * 对用户执行禁言（管理页使用）。
 *
 * @param channelId - 频道 id。
 * @param uid - 用户 id。
 * @param until - 禁言截止时间戳（毫秒）。`0` 表示永久。
 * @param reason - 禁言原因（可为空字符串）。
 * @returns 无返回值。
 */
export function setBan(channelId: string, uid: string, until: number, reason: string): Promise<void> {
  return impl.setBan(channelId, uid, until, reason);
}

/**
 * 解除用户禁言。
 *
 * @param channelId - 频道 id。
 * @param uid - 用户 id。
 * @returns 无返回值。
 */
export function removeBan(channelId: string, uid: string): Promise<void> {
  return impl.removeBan(channelId, uid);
}

/**
 * 创建频道。
 *
 * @param name - Channel name.
 * @param brief - Channel brief.
 * @returns Promise<ChatChannel>。
 */
export function createChannel(name: string, brief?: string) {
  return impl.createChannel(name, brief);
}

/**
 * 删除频道。
 *
 * @param channelId - 频道 id。
 * @returns Promise<void>。
 */
export function deleteChannel(channelId: string): Promise<void> {
  return impl.deleteChannel(channelId);
}
