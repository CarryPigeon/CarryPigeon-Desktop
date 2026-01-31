/**
 * @fileoverview Config.ts 文件职责说明。
 */
export type AppConfig = {
  username: string;
  email: string;

  auto_login: boolean;
  close_to_tray: boolean;
  check_for_updates: boolean;

  two_factor_auth: boolean;
  password_reset: boolean;

  private_messages: boolean;
  profile_visibility: boolean;

  email_notifications: boolean;
  desktop_notifications: boolean;

  show_file_extensions: boolean;
  auto_save_files: boolean;

  [key: string]: unknown;
};

/**
 * Exported constant.
 * @constant
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  username: "",
  email: "",
  auto_login: false,
  close_to_tray: false,
  check_for_updates: false,
  two_factor_auth: false,
  password_reset: false,
  private_messages: false,
  profile_visibility: false,
  email_notifications: false,
  desktop_notifications: false,
  show_file_extensions: false,
  auto_save_files: false,
};
