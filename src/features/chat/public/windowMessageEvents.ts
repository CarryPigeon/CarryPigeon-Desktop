/**
 * @fileoverview chat 窗口事件公共兼容出口。
 * @description 仅为历史 shared 兼容层提供稳定边界，事件实现仍由 chat feature 持有。
 */

export type {
  ChannelProjectionChangedEvent,
  ChatChannelProjection,
  ForwardMessageRequestedEvent,
  InsertTextMode,
  InsertTextRequestedEvent,
} from "../presentation/shared/windowMessageEvents";
export {
  emitChannelProjectionChanged,
  emitForwardMessageRequested,
  emitInsertTextRequested,
  observeChannelProjectionChanged,
} from "../presentation/shared/windowMessageEvents";
