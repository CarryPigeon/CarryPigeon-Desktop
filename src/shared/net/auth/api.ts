/**
 * @fileoverview shared auth 对外公共入口。
 * @description
 * 显式暴露 shared auth 会话生命周期能力，避免调用方深路径依赖
 * `authSessionManager` 实现文件。
 */

export {
  ensureValidAccessToken,
  ensureValidAuthSession,
  onAuthSessionChanged,
  revokeAndClearSession,
  startAuthSessionAutoRefresh,
} from "./authSessionManager";
