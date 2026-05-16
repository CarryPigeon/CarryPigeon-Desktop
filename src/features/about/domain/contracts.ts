/**
 * @fileoverview about/domain/contracts.ts
 * @description 关于页面所需的领域类型。
 */

export interface AppInfo {
  name: string;
  version: string;
  description: string;
  techStack: string[];
  license: string;
  credits: Array<{ name: string; url?: string }>;
}
