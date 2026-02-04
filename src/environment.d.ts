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
