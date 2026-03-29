/**
 * @fileoverview repo catalog 数据层错误。
 * @description
 * 为 repo catalog 拉取适配器提供稳定错误语义，避免传播裸 `Error`。
 */

export type RepoCatalogErrorCode = "repo_catalog_http_error";

export class RepoCatalogError extends Error {
  readonly code: RepoCatalogErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: RepoCatalogErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "RepoCatalogError";
    this.code = code;
    this.details = details;
  }
}

export function createRepoCatalogError(
  code: RepoCatalogErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): RepoCatalogError {
  return new RepoCatalogError(code, message, details);
}
