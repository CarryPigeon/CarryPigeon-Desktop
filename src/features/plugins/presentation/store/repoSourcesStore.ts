/**
 * @fileoverview repoSourcesStore.ts
 * @description plugins｜展示层状态（store）：repoSourcesStore。
 */

import { computed, ref, type Ref } from "vue";
import { readJson, writeJson } from "@/shared/utils/localStore";
import { KEY_REPO_SOURCES } from "@/shared/utils/storageKeys";

/**
 * Repo 源定义（用于拉取 repo 插件目录）。
 */
export type RepoSource = {
  id: string;
  baseUrl: string;
  enabled: boolean;
  note?: string;
  addedAtMs: number;
};

type StoredRepoSources = {
  repos: RepoSource[];
};

const state = ref<StoredRepoSources>(readJson<StoredRepoSources>(KEY_REPO_SOURCES, { repos: [] }));

/**
 * 将 repo sources 状态持久化到 localStorage。
 *
 * @returns 无返回值。
 */
function persist(): void {
  writeJson(KEY_REPO_SOURCES, state.value);
}

/**
 * 将 repo base URL 归一化为稳定的 http(s) URL（去尾随 `/`）。
 *
 * @param raw - 用户输入的原始字符串。
 * @returns 归一化后的 base URL；非法时返回空字符串。
 */
function normalizeRepoBaseUrl(raw: string): string {
  const base = String(raw ?? "").trim().replace(/\/+$/u, "");
  if (!base) return "";
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString().replace(/\/+$/u, "");
  } catch {
    return "";
  }
}

/**
 * 为 repo source 记录创建本地唯一 id。
 *
 * @param baseUrl - 已归一化的 base URL。
 * @returns 唯一本地 id。
 */
function createRepoId(baseUrl: string): string {
  return `repo_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}_${baseUrl.length}`;
}

/**
 * 所有 repo sources（已持久化）。
 *
 * @constant
 */
export const repoSources: Readonly<Ref<RepoSource[]>> = computed(() => state.value.repos);

/**
 * 已启用的 repo sources（用于拉取目录）。
 *
 * @constant
 */
export const enabledRepoSources: Readonly<Ref<RepoSource[]>> = computed(() => state.value.repos.filter((r) => r.enabled));

/**
 * 添加 repo source（按 baseUrl 幂等）。
 *
 * @param baseUrl - Repo base URL，例如 `https://repo.example.com`。
 * @param note - 可选备注。
 * @returns 创建或已存在的 RepoSource；非法输入时返回 `null`。
 */
export function addRepoSource(baseUrl: string, note?: string): RepoSource | null {
  const normalized = normalizeRepoBaseUrl(baseUrl);
  if (!normalized) return null;

  const existing = state.value.repos.find((r) => r.baseUrl === normalized) ?? null;
  if (existing) {
    if (!existing.enabled) {
      existing.enabled = true;
      persist();
    }
    return existing;
  }

  const repo: RepoSource = {
    id: createRepoId(normalized),
    baseUrl: normalized,
    enabled: true,
    note: typeof note === "string" && note.trim() ? note.trim() : undefined,
    addedAtMs: Date.now(),
  };
  state.value.repos = [...state.value.repos, repo];
  persist();
  return repo;
}

/**
 * 按 id 删除 repo source。
 *
 * @param id - Repo source id。
 */
export function removeRepoSource(id: string): void {
  const rid = String(id ?? "").trim();
  if (!rid) return;
  state.value.repos = state.value.repos.filter((r) => r.id !== rid);
  persist();
}

/**
 * 切换 repo source 启用态。
 *
 * @param id - Repo source id。
 * @param enabled - 目标启用态。
 */
export function setRepoSourceEnabled(id: string, enabled: boolean): void {
  const rid = String(id ?? "").trim();
  if (!rid) return;
  const repo = state.value.repos.find((r) => r.id === rid);
  if (!repo) return;
  repo.enabled = Boolean(enabled);
  persist();
}
