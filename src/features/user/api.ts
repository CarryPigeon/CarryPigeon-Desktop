/**
 * @fileoverview user Feature 对外公共 API（跨 Feature 访问边界）。
 * @description
 * 对外仅暴露“当前用户展示态”读写能力，避免其他 Feature 直接耦合
 * `user/presentation/*` 内部目录结构。
 */

export { currentUser, setCurrentUser, type CurrentUser } from "./presentation/store/userData";
export {
  getGetCurrentUserUsecase,
  getUpdateUserEmailUsecase,
  getUpdateUserProfileUsecase,
} from "./di/user.di";
