/**
 * @fileoverview 前端窗口级 chat 事件兼容层。
 * @description
 * 新代码应优先依赖 `features/chat/presentation/shared/windowMessageEvents.ts`。
 * 本文件只保留历史导出名到新语义 helper 的兼容映射。
 */

export type {
  ChannelProjectionChangedEvent as ChannelChangedEventDetail,
  ForwardMessageRequestedEvent as ForwardMessageEventDetail,
  InsertTextRequestedEvent as InsertTextEventDetail,
  InsertTextMode,
} from "@/features/chat/presentation/shared/windowMessageEvents";
export {
  emitChannelProjectionChanged as dispatchChannelChanged,
  emitForwardMessageRequested as dispatchForwardMessage,
  emitInsertTextRequested as dispatchInsertText,
} from "@/features/chat/presentation/shared/windowMessageEvents";
