/**
 * @fileoverview network Feature 对外公共 API（跨 Feature 访问边界）。
 * @description
 * 对外暴露连接状态与连接动作，供登录页/聊天页等上层 feature 复用。
 */

export {
  connectNow,
  connectWithRetry,
  connectionDetail,
  connectionPhase,
  connectionPillState,
  connectionReason,
  retryLast,
  type ConnectionPhase,
  type ConnectionReason,
} from "./presentation/store/connectionStore";
