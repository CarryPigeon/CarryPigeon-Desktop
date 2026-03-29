/**
 * @fileoverview plugins repo sources application facade。
 * @description
 * 收敛 repo source 管理与只读列表视图，避免 internal 访问层直接依赖展示层 store。
 */

import { computed } from "vue";
import {
  addRepoSource,
  enabledRepoSources as enabledRepoSourcesState,
  removeRepoSource,
  repoSources as repoSourcesState,
  setRepoSourceEnabled,
} from "../presentation/store/repoSourcesStore";
import type { RepoSource } from "../contracts/repoSource";

type ReadonlyRepoSource = Readonly<RepoSource>;

function toReadonlyRepoSource(source: RepoSource): ReadonlyRepoSource {
  return Object.freeze({
    id: source.id,
    baseUrl: source.baseUrl,
    enabled: source.enabled,
    note: source.note,
    addedAtMs: source.addedAtMs,
  });
}

function toReadonlyRepoSourceList(sources: readonly RepoSource[]): readonly ReadonlyRepoSource[] {
  return Object.freeze(sources.map(toReadonlyRepoSource));
}

export { addRepoSource, removeRepoSource, setRepoSourceEnabled };

export function listRepoSources(): readonly ReadonlyRepoSource[] {
  return toReadonlyRepoSourceList(repoSourcesState.value);
}

export function listEnabledRepoSources(): readonly ReadonlyRepoSource[] {
  return toReadonlyRepoSourceList(enabledRepoSourcesState.value);
}

export const repoSources = computed<readonly ReadonlyRepoSource[]>(() => toReadonlyRepoSourceList(repoSourcesState.value));

export const enabledRepoSources = computed<readonly ReadonlyRepoSource[]>(() =>
  toReadonlyRepoSourceList(enabledRepoSourcesState.value),
);
