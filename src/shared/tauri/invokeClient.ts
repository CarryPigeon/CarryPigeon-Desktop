/**
 * @fileoverview Tauri invoke 统一封装（前端 -> Rust）。
 */
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { isTauriRuntimeAvailable } from "./runtime";

/**
 * Tauri invoke 的参数对象类型（可选）。
 */
export type TauriInvokeArgs = Record<string, unknown> | undefined;

/**
 * 在非 Tauri 环境下统一抛出的错误（silent fallback 的实现细节）。
 */
const TAURI_UNAVAILABLE_MESSAGE = "Tauri runtime unavailable";

/**
 * 调用 Rust 侧命令（Tauri invoke）。
 *
 * 在浏览器 dev 预览下（无 Tauri bridge）会以 `Error(TAURI_UNAVAILABLE_MESSAGE)` reject，
 * 调用方通常使用 `safeInvokeTauri` 静默吞掉错误。
 *
 * @param command - 命令名（建议使用 `TAURI_COMMANDS`）
 * @param args - 参数对象（可选）
 * @returns Rust 返回值（由泛型参数决定）。
 */
export async function invokeTauri<T = unknown>(
  command: string,
  args?: TauriInvokeArgs,
): Promise<T> {
  if (!isTauriRuntimeAvailable()) {
    throw new Error(TAURI_UNAVAILABLE_MESSAGE);
  }
  return tauriInvoke<T>(command, args);
}

/**
 * 尽力而为（best-effort）地调用 Rust 侧命令。
 *
 * 在浏览器预览环境（无 Tauri bridge）下静默返回 `undefined`，不会抛错到调用方。
 * 适用于：UI 探针、日志、可选能力开关等不应导致页面崩溃的调用。
 *
 * @param command - Tauri command 名。
 * @param args - command 参数。
 * @returns Rust 返回值；若 Tauri 不可用则返回 `undefined`。
 */
export async function safeInvokeTauri<T = unknown>(
  command: string,
  args?: TauriInvokeArgs,
): Promise<T | undefined> {
  try {
    return await invokeTauri<T>(command, args);
  } catch {
    return undefined;
  }
}
