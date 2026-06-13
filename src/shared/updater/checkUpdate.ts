/**
 * @fileoverview 版本检测：通过 GitHub Releases API 检查新版本。
 *
 * 说明：
 * - 不依赖 tauri-plugin-updater，仅做版本比对；
 * - 检测到新版本时提示用户跳转到 GitHub Releases 页手动下载。
 */
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('updater');

/** 当前应用版本。 */
const CURRENT_VERSION = import.meta.env.PACKAGE_VERSION as string;

/**
 * GitHub 仓库信息。
 * 发布页 URL: https://github.com/{owner}/{repo}/releases/latest
 */
const GITHUB_OWNER = 'ShirasawaTopaz';
const GITHUB_REPO = 'carrypigeon-desktop';

/**
 * 更新检查结果的类型。
 */
export type UpdateStatus =
  | { kind: 'up_to_date' }
  | { kind: 'update_available'; version: string; releaseUrl: string }
  | { kind: 'error'; message: string };

/**
 * 通过 GitHub API 检查是否有新版本。
 *
 * @returns UpdateStatus — 最新/有更新/错误
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!res.ok) {
      // GitHub API 限流时降级为静默跳过
      logger.warn('Action: http_update_check_failed', {
        status: res.status,
        statusText: res.statusText,
      });
      return { kind: 'error', message: `GitHub API returned ${res.status}` };
    }

    const data = (await res.json()) as { tag_name: string; html_url: string };
    const latestVersion = data.tag_name.replace(/^v/, ''); // strip "v" prefix
    const current = CURRENT_VERSION;

    if (compareVersions(latestVersion, current) > 0) {
      return {
        kind: 'update_available',
        version: latestVersion,
        releaseUrl: data.html_url,
      };
    }

    return { kind: 'up_to_date' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn('Action: http_update_check_failed', { error: message });
    return { kind: 'error', message };
  }
}

/**
 * 静默检查更新（启动时调用，有更新才弹出提示）。
 *
 * @param onUpdateAvailable - 发现更新时的回调。
 */
export async function checkForUpdateSilently(
  onUpdateAvailable: (version: string, releaseUrl: string) => void,
): Promise<void> {
  const status = await checkForUpdate();
  if (status.kind === 'update_available') {
    onUpdateAvailable(status.version, status.releaseUrl);
  }
}

/**
 * 比较两个 semver 版本号。
 * @returns >0 表示 a > b, 0 表示相等, <0 表示 a < b
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
