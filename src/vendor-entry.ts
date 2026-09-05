// 宿主侧 vendor 汇聚入口：把 vue 与 tdesign-vue-next 以 ESM 形式提供给 import map。
// 插件与宿主主程序都经 import map 解析这两个裸模块名，确保共享同一运行时实例。
export * from "vue";
export * from "tdesign-vue-next";
export { default as TDesign } from "tdesign-vue-next";

// vue 与 tdesign-vue-next 同时导出了 AppContext / Comment / Text，
// 两个 export * 会产生歧义（TS2308）。此处显式从 vue 重新导出以消除歧义。
//
// 注意：AppContext 只是 TS 类型，必须用 `export type`；而 Comment / Text 是 vue 的
// 运行时导出（VNode 类型符号）。若这里也用 `export type`，构建产物 vendor.mjs 将
// 不包含这两个名字的运行时导出——而 bundle 内的依赖（如 vue-i18n）会在运行期
// `import { Text } from "vue"`，经 import map 解析到本文件后直接 SyntaxError，
// 导致 release 构建白屏卡死（dev 下宿主走 node_modules 预构建，不经 import map，
// 因此只在 release 暴露）。故 Comment / Text 必须按值重新导出。
export { Comment, Text } from "vue";
export type { AppContext } from "vue";
