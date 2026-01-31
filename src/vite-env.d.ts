/**
 * @fileoverview vite-env.d.ts 文件职责说明。
 */
/// <reference types="vite/client" />

declare module "*.vue" {
    import type {DefineComponent} from "vue";
    const component: DefineComponent<{}, {}, any>;
  export default component;
}
