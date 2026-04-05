/**
 * @fileoverview windowTypes.ts
 * @description platform｜领域类型：窗口命令参数类型。
 *
 * 说明：
 * - 定义窗口相关命令的参数数据结构；
 * - 供 domain/ports 中的接口定义使用，隔离参数定义与接口契约。
 */

/**
 * 打开 popover 窗口的参数。
 *
 * popover 是一种轻量级弹窗，通常用于展示上下文快速预览（如用户卡片、频道信息）。
 *
 * @param query - 弹窗内容查询标识符（用于路由定位内容）
 * @param x - 弹窗位置 X 坐标（屏幕坐标）
 * @param y - 弹窗位置 Y 坐标（屏幕坐标）
 * @param width - 弹窗宽度
 * @param height - 弹窗高度
 */
export type OpenPopoverWindowArgs = {
  query: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * 打开信息窗口的参数。
 *
 * 信息窗口是一种独立的顶层窗口，用于展示较长内容（如关于页面、帮助文档）。
 *
 * @param label - 窗口标签（用于窗口管理器标识）
 * @param title - 窗口标题（显示在标题栏）
 * @param query - 窗口内容查询标识符（用于路由定位内容）
 * @param width - 窗口宽度
 * @param height - 窗口高度
 */
export type OpenInfoWindowArgs = {
  label: string;
  title: string;
  query: string;
  width: number;
  height: number;
};
