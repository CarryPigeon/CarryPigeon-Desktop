/**
 * @fileoverview chat 读标记展示层桥接。
 * @description
 * 展示层继续从该路径读取读标记规则，实际实现已下沉到 domain/utils。
 */

export {
  compareMessageIdForReadOrder,
  isMessageAfterReadMarker,
  shouldAdvanceReadMarker,
} from "@/features/chat/domain/utils/readMarker";
