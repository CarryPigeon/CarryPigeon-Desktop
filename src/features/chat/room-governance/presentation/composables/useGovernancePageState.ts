/**
 * @fileoverview 治理页面共享状态协议。
 * @description chat/room-governance｜presentation composable helper：统一治理页的加载态、错误态与必需频道 id 守卫。
 */

import { ref, type ComputedRef, type Ref } from "vue";
import { requireGovernanceChannelId } from "./requireGovernanceChannelId";

type AsyncOrSync = void | Promise<void>;
type GovernanceCommandOutcomeLike = {
  ok: boolean;
  error?: {
    message: string;
  };
};

function formatGovernancePageError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type GovernancePageState = {
  /**
   * 页面级加载态。
   */
  isLoading: Ref<boolean>;
  /**
   * 页面级错误文案。
   */
  pageError: Ref<string>;
  /**
   * 执行一次“加载当前频道数据”的任务。
   */
  runPageLoad<Result>(
    load: (channelId: string) => Promise<Result>,
    applyResult: (result: Result) => void,
  ): Promise<void>;
  /**
   * 执行一次“作用于当前频道”的动作，并统一处理错误。
   */
  runChannelAction(
    action: (channelId: string) => Promise<GovernanceCommandOutcomeLike>,
    afterSuccess?: (outcome: GovernanceCommandOutcomeLike & { ok: true }) => AsyncOrSync,
  ): Promise<void>;
};

export type UseGovernancePageStateArgs = {
  /**
   * 当前页面绑定的频道 id。
   */
  channelId: ComputedRef<string>;
  /**
   * 当缺失频道 id 时用于清理页面数据。
   */
  onMissingChannel(): void;
};

/**
 * 创建治理子页面共享状态协议。
 *
 * @param args - 页面状态依赖。
 * @returns 页面级状态与统一任务执行器。
 */
export function useGovernancePageState(
  args: UseGovernancePageStateArgs,
): GovernancePageState {
  const isLoading = ref(true);
  const pageError = ref("");

  function setPageError(error: unknown): void {
    pageError.value = formatGovernancePageError(error);
  }

  function requireChannelId(): string | null {
    return requireGovernanceChannelId(args.channelId.value, {
      loading: isLoading,
      error: pageError,
      onMissingChannel: args.onMissingChannel,
    });
  }

  async function runPageLoad<Result>(
    load: (channelId: string) => Promise<Result>,
    applyResult: (result: Result) => void,
  ): Promise<void> {
    const channelId = requireChannelId();
    if (!channelId) return;

    isLoading.value = true;
    pageError.value = "";
    try {
      applyResult(await load(channelId));
    } catch (error) {
      setPageError(error);
    } finally {
      isLoading.value = false;
    }
  }

  async function runChannelAction(
    action: (channelId: string) => Promise<GovernanceCommandOutcomeLike>,
    afterSuccess?: (outcome: GovernanceCommandOutcomeLike & { ok: true }) => AsyncOrSync,
  ): Promise<void> {
    const channelId = requireChannelId();
    if (!channelId) return;

    try {
      const outcome = await action(channelId);
      if (!outcome.ok) {
        setPageError(outcome.error?.message ?? "Governance command rejected.");
        return;
      }
      await afterSuccess?.(outcome as GovernanceCommandOutcomeLike & { ok: true });
    } catch (error) {
      setPageError(error);
    }
  }

  return {
    isLoading,
    pageError,
    runPageLoad,
    runChannelAction,
  };
}
