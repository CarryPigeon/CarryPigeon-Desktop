// 宿主侧 vendor 汇聚入口：把 vue 与 tdesign-vue-next 以 ESM 形式提供给 import map。
// 插件与宿主主程序都经 import map 解析这两个裸模块名，确保共享同一运行时实例。
export * from "vue";
export * from "tdesign-vue-next";
export { default as TDesign } from "tdesign-vue-next";

// vue 与 tdesign-vue-next 同时导出了 AppContext / Comment / Text，
// 两个 export * 会产生歧义（TS2308）。此处显式从 vue 重新导出以消除歧义。
// 运行期 export * 同名会被静默忽略，类型检查需显式声明。
export type { AppContext, Comment, Text } from "vue";
