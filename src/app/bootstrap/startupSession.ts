/**
 * @fileoverview startupSession.ts
 * @description 向后兼容的启动会话桥接；真实实现已迁移到 `app/processes/session/api.ts`。
 */

export {
  ensureInitialServerSelection as ensureInitialServerSocket,
  restoreStartupSession as tryRestoreSession,
} from "@/app/processes/session/api";
