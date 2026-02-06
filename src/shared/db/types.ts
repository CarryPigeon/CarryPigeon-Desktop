/**
 * @fileoverview 数据库通用类型（前端与 Tauri DB commands 共享）。
 */

/**
 * DB 允许的基础值类型（用于 statement 参数与 query 返回值）。
 */
export type DbValue = null | boolean | number | string;

/**
 * 执行类语句（INSERT/UPDATE/DELETE）返回结果。
 */
export type DbExecResult = {
  rows_affected: number;
  last_insert_rowid?: number | null;
};

/**
 * 查询类语句（SELECT）返回结果。
 */
export type DbQueryResult = {
  columns: string[];
  rows: DbValue[][];
};

/**
 * DB 语句描述：SQL + 可选参数列表。
 */
export type DbStatement = {
  sql: string;
  params?: DbValue[];
};
