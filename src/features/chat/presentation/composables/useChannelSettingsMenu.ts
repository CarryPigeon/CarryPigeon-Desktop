/**
 * @fileoverview 频道设置菜单编排：菜单显隐与锚点坐标。
 * @description chat｜presentation composable：维护频道菜单定位与开关状态。
 */

import { ref } from "vue";

/**
 * 主页面频道设置菜单状态编排。
 */
export function useChannelSettingsMenu() {
  const showChannelMenu = ref(false);
  const channelMenuX = ref(0);
  const channelMenuY = ref(0);

  function setMenuAnchorFromMouseEvent(e: MouseEvent): void {
    channelMenuX.value = e.clientX;
    channelMenuY.value = e.clientY;
  }

  function openChannelSettingsMenu(e: MouseEvent): void {
    e.preventDefault();
    setMenuAnchorFromMouseEvent(e);
    showChannelMenu.value = true;
  }

  function closeChannelMenu(): void {
    showChannelMenu.value = false;
  }

  return {
    showChannelMenu,
    channelMenuX,
    channelMenuY,
    openChannelSettingsMenu,
    closeChannelMenu,
  };
}
