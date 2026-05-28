/**
 * @fileoverview 项目全局类型声明（ambient types）。
 *
 * 用途：用于声明不属于任何特定 feature 模块的全局/环境类型。
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {}
  }
}

// @tauri-apps/plugin-dialog 可选插件声明
// 运行时可能不存在该包，代码中已通过 try/catch 处理回退逻辑
declare module "@tauri-apps/plugin-dialog" {
  export interface DialogFilter {
    name: string;
    extensions: string[];
  }

  export interface OpenDialogOptions {
    multiple?: boolean;
    filters?: DialogFilter[];
    defaultPath?: string;
    title?: string;
  }

  export function open(options?: OpenDialogOptions): Promise<string | string[] | null>;
}
