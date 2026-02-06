/**
 * @fileoverview requiredGate.ts
 * @description auth｜展示层状态（store）：requiredGate。
 */

import { ref } from "vue";

/**
 * 当前服务端要求但客户端缺失的插件 id 列表。
 *
 * 说明：
 * - 该 store 通常在登录失败后，由服务端 `required_plugin_missing` 错误映射而来；
 * - UI 可据此引导用户安装/启用必需插件，再重试登录。
 *
 * @constant
 */
export const missingRequiredPlugins = ref<string[]>([]);

/**
 * 替换缺失插件列表（归一化 + 去重）。
 *
 * 归一化规则：
 * - 强制转为 string
 * - trim 空白
 * - 丢弃空值
 * - 保持稳定顺序去重
 *
 * @param ids - 原始插件 id 列表。
 * @returns void。
 */
export function setMissingRequiredPlugins(ids: string[]): void {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw).trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  missingRequiredPlugins.value = out;
}
