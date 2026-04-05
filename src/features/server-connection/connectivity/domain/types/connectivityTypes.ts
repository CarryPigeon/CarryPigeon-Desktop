/**
 * @fileoverview connectivityTypes.ts
 * @description server-connection/connectivity｜领域类型：连接选项类型定义。
 *
 * 说明：
 * - 定义 TCP 连接相关的选项类型；
 * - 当前版本预留扩展位置，暂未使用额外选项。
 */

/**
 * TCP 连接选项。
 *
 * 当前为预留扩展位置，实际未使用额外选项，定义为空记录。
 */
export type TcpConnectOptions = Record<string, never>;
