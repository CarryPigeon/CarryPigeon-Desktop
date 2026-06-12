/**
 * @fileoverview Tauri 自动更新检查逻辑。
 */
import { check } from '@tauri-apps/plugin-updater';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('updater');

export type UpdateStatus =
  | { kind: 'up_to_date' }
  | { kind: 'update_available'; version: string; body: string }
  | { kind: 'error'; message: string };

/**
 * 检查是否有可用更新。
 * 调用 Tauri updater plugin 的 `check()` API。
 *
 * @returns UpdateStatus — 最新/有更新/错误
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const result = await check();
    if (!result) {
      return { kind: 'up_to_date' };
    }
    return {
      kind: 'update_available',
      version: result.version,
      body: result.body ?? '',
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn('Action: update_check_failed', { error: message });
    return { kind: 'error', message };
  }
}

/**
 * 静默检查更新（启动时调用，有更新才弹出提示）。
 *
 * @param onUpdateAvailable - 发现更新时的回调。
 */
export async function checkForUpdateSilently(
  onUpdateAvailable: (version: string, body: string) => void,
): Promise<void> {
  const status = await checkForUpdate();
  if (status.kind === 'update_available') {
    onUpdateAvailable(status.version, status.body);
  }
}
