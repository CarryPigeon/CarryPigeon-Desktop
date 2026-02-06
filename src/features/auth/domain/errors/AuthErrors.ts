/**
 * @fileoverview AuthErrors.ts
 * @description auth｜模块：AuthErrors。
 */

/**
 * 必需插件缺失错误的载荷结构（与服务端 reason 对齐）。
 */
export type RequiredPluginMissingPayload = {
  reason: "required_plugin_missing";
  missing_plugins: string[];
};

/**
 * 必需插件缺失错误。
 *
 * 说明：
 * - 用于 required gate 阶段：当服务端声明“必须插件”但客户端未安装/未启用时抛出；
 * - `payload.missing_plugins` 用于 UI 给出明确的安装指引。
 */
export class AuthRequiredPluginMissingError extends Error {
  constructor(public readonly payload: RequiredPluginMissingPayload) {
    super("required_plugin_missing");
    this.name = "AuthRequiredPluginMissingError";
  }
}

/**
 * 类型守卫：判断未知错误是否为 `AuthRequiredPluginMissingError`。
 *
 * @param e - 捕获到的未知错误对象。
 * @returns 当 `e` 是 `AuthRequiredPluginMissingError` 实例时返回 `true`。
 */
export function isAuthRequiredPluginMissingError(e: unknown): e is AuthRequiredPluginMissingError {
  return e instanceof AuthRequiredPluginMissingError;
}
