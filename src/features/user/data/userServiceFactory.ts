/**
 * @fileoverview userServiceFactory.ts
 * @description user｜数据层实现：userServiceFactory。
 *
 * @deprecated 请改用 domain/ports 与 di/（依赖注入入口）。
 *
 * API 对齐说明：
 * - 用户信息接口参见 `docs/api/*` → Users
 * - 用户资料变更接口尚未纳入当前 HTTP API（保留为历史/未来扩展点）
 */

/**
 * 向后兼容导出：重导出领域层用户类型。
 */
export type { UserMe, UserPublic } from "../domain/types/UserTypes";

/**
 * 向后兼容导出：将领域端口类型重命名为 service 类型别名。
 */
export type { UserServicePort as UserService } from "../domain/ports/UserServicePort";

/**
 * 向后兼容导出：重导出旧工厂函数名。
 */
export { createUserService } from "../di/user.di";
