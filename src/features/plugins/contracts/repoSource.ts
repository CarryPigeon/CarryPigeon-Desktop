/**
 * @fileoverview plugins repo source contract
 * @description
 * 定义插件仓库源的稳定契约，供公共 API、内部访问层与展示组件共享。
 */

/**
 * Repo 源定义（用于拉取 repo 插件目录）。
 */
export type RepoSource = {
  id: string;
  baseUrl: string;
  enabled: boolean;
  note?: string;
  addedAtMs: number;
};
