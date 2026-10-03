// 宿主侧 Cordis vendor 汇聚入口：把 @cordisjs/core 以 ESM 形式提供给 import map。
// 宿主主程序与插件都经同一模块实例访问 Cordis，确保服务注册表 / 隔离符号 / Service
// 基类 identity 完全一致（插件若自带 Cordis 副本会导致注入静默失效）。
//
// 单独的 cordis.mjs 与 vue/tdesign 的 vendor.mjs 分离，避免 `export *` 同名导出被浏览器
// 判为歧义而静默丢弃。
export * from "@cordisjs/core";
