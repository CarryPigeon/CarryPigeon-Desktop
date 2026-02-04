/**
 * @fileoverview 稳定 device id 工具（用于认证/会话创建）。
 * @description
 * 接口（HTTP API）包含 `client.device_id` 字段，用于 token 发放与会话追踪。
 * 本模块提供一个存储于 localStorage 的稳定 id。
 *
 * 设计目标：
 * - 将生成逻辑收敛到一处。
 * - 在应用重启后保持稳定。
 * - 避免引入额外依赖。
 */

const KEY_DEVICE_ID = "carrypigeon:deviceId";

/**
 * 生成适合作为本地 device id 的伪随机标识。
 *
 * 注意：这不是加密学意义的标识，仅用于会话追踪与 per-device refresh token 关联。
 *
 * @returns 新的 id 字符串。
 */
function generateDeviceId(): string {
  const now = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2);
  return `dev_${now}_${rand}`;
}

/**
 * 读取（或生成）稳定的 device id。
 *
 * @returns device id 字符串。
 */
export function getDeviceId(): string {
  const existing = localStorage.getItem(KEY_DEVICE_ID);
  if (existing && existing.trim()) return existing.trim();
  const next = generateDeviceId();
  localStorage.setItem(KEY_DEVICE_ID, next);
  return next;
}
