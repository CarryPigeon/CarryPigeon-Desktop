// voice-call 后端能力已抽取为插件（plugins/voice-call），由插件经 host/bridge 自管理状态与事件。
// 此文件原 re-export 的 voice-call 运行期模块均已迁移到插件包，故此处不再导出任何内容；
// 保留文件占位，待 Task 11 统一清理。
export {};
