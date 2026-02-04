/**
 * @fileoverview repoSourcesStore.ts
 * @description Presentation store: user-managed plugin repo sources (localStorage).
 */

import { computed, ref, type Ref } from "vue";
import { readJson, writeJson } from "@/shared/utils/localStore";

export type RepoSource = {
  id: string;
  baseUrl: string;
  enabled: boolean;
  note?: string;
  addedAtMs: number;
};

const KEY_REPO_SOURCES = "carrypigeon:repoSources:v1";

type StoredRepoSources = {
  repos: RepoSource[];
};

const state = ref<StoredRepoSources>(readJson<StoredRepoSources>(KEY_REPO_SOURCES, { repos: [] }));

/**
 * Persist the repo sources state to localStorage.
 *
 * @returns void
 */
function persist(): void {
  writeJson(KEY_REPO_SOURCES, state.value);
}

/**
 * Normalize a repo base URL into a canonical https? string.
 *
 * @param raw - Raw user input.
 * @returns Canonical base URL or empty string when invalid.
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
 * Create a unique id for a repo source record.
 *
 * @param baseUrl - Normalized base URL.
 * @returns Unique repo source id.
 */
function createRepoId(baseUrl: string): string {
  return `repo_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}_${baseUrl.length}`;
}

/**
 * All repo sources (persisted).
 *
 * @constant
 */
export const repoSources: Readonly<Ref<RepoSource[]>> = computed(() => state.value.repos);

/**
 * Enabled repo sources (for catalog fetching).
 *
 * @constant
 */
export const enabledRepoSources: Readonly<Ref<RepoSource[]>> = computed(() => state.value.repos.filter((r) => r.enabled));

/**
 * Add a repo source (idempotent by baseUrl).
 *
 * @param baseUrl - Repo base URL like `https://repo.example.com`.
 * @param note - Optional note label.
 * @returns The created or existing RepoSource; `null` when invalid.
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
 * Remove a repo source by id.
 *
 * @param id - Repo source id.
 */
export function removeRepoSource(id: string): void {
  const rid = String(id ?? "").trim();
  if (!rid) return;
  state.value.repos = state.value.repos.filter((r) => r.id !== rid);
  persist();
}

/**
 * Toggle a repo source enabled state.
 *
 * @param id - Repo source id.
 * @param enabled - Next enabled state.
 */
export function setRepoSourceEnabled(id: string, enabled: boolean): void {
  const rid = String(id ?? "").trim();
  if (!rid) return;
  const repo = state.value.repos.find((r) => r.id === rid);
  if (!repo) return;
  repo.enabled = Boolean(enabled);
  persist();
}
