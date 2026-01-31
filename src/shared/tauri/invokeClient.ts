/**
 * @fileoverview Tauri invoke 统一封装（前端 -> Rust）。
 */
import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export type TauriInvokeArgs = Record<string, unknown> | undefined;

/**
 * 调用 Rust 侧命令（Tauri invoke）。
 * @param command - 命令名（建议使用 `TAURI_COMMANDS`）
 * @param args - 参数对象（可选）
 * @returns Rust 返回值
 */
export async function invokeTauri<T = unknown>(
  command: string,
  args?: TauriInvokeArgs,
): Promise<T> {
  return tauriInvoke<T>(command, args);
}
