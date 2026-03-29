/**
 * @fileoverview 语义化公共类型。
 * @description
 * 收敛跨 feature 共享的错误信息、命令结果与只读投影约束，避免各模块重复定义弱语义结果。
 */

/**
 * 稳定的可序列化错误信息。
 *
 * 约定：
 * - 该结构面向跨层/跨 feature 传递；
 * - 不携带 Error 实例、class、本地响应式对象或不可序列化句柄；
 * - `message` 用于展示，`code` 用于程序分支。
 */
export type SemanticErrorInfo<TCode extends string = string> = {
  /**
   * 机器可读错误码。
   */
  code: TCode;

  /**
   * 面向 UI / 日志的稳定错误文案。
   */
  message: string;

  /**
   * 当前错误是否适合用户重试。
   */
  retryable: boolean;

  /**
   * 附加 plain-data 细节。
   */
  details?: Readonly<Record<string, unknown>>;
};

/**
 * 语义化成功结果。
 */
export type SuccessOutcome<TKind extends string, TPayload extends Record<string, unknown> = Record<string, never>> = Readonly<
  { ok: true; kind: TKind } & TPayload
>;

/**
 * 语义化失败结果。
 */
export type FailureOutcome<TKind extends string, TCode extends string> = Readonly<{
  ok: false;
  kind: TKind;
  error: SemanticErrorInfo<TCode>;
}>;
