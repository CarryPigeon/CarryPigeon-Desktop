/**
 * @fileoverview DB types shared between frontend and Tauri DB commands.
 */
export type DbValue = null | boolean | number | string;

export type DbExecResult = {
  rows_affected: number;
  last_insert_rowid?: number | null;
};

export type DbQueryResult = {
  columns: string[];
  rows: DbValue[][];
};

export type DbStatement = {
  sql: string;
  params?: DbValue[];
};
