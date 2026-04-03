/**
 * @fileoverview UserProfilePopover.props.ts
 * @description UserProfilePopover 组件的 Props 类型定义
 */

import type { Placement } from "@popperjs/core";

/**
 * 用户信息悬浮卡 Props
 */
export interface UserProfilePopoverProps {
  /** 用户 ID，必填 */
  userId: string;
  /** 用户显示名称，可选（若不提供则从后端获取） */
  username?: string;
  /** 用户邮箱，可选（若不提供则从后端获取） */
  email?: string;
  /** 用户简介/签名，可选（若不提供则从后端获取） */
  bio?: string;
  /** 用户头像 URL，可选 */
  avatarUrl?: string;
  /** 背景图片 URL，可选 */
  backgroundUrl?: string;
  /** 触发方式：点击 | 悬停 | 两者都支持，默认两者都支持 */
  trigger?: "click" | "hover" | "both";
  /** 弹出位置，默认根据空间自动选择 */
  placement?: Placement;
  /** 卡片宽度，默认 320px */
  popoverWidth?: number;
}
