/**
 * @fileoverview Vite 类型增强声明。
 *
 * 说明：该文件用于为 Vite 的模块系统提供全局类型（如 `import.meta.env`、资源导入等）。
 */
/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
