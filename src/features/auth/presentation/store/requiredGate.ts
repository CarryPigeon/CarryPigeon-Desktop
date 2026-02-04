/**
 * @fileoverview requiredGate.ts
 * @description Presentation store: required plugin missing info (for /required-setup).
 */

import { ref } from "vue";

/**
 * Plugin ids that are missing/enforced by the current server.
 *
 * This store is typically populated after a failed sign-in attempt or by a
 * server-side "required_plugin_missing" response mapping.
 *
 * @constant
 */
export const missingRequiredPlugins = ref<string[]>([]);

/**
 * Replace the missing required plugin list (normalized + deduplicated).
 *
 * Normalization:
 * - Coerces to string
 * - Trims whitespace
 * - Drops empty values
 * - Deduplicates while keeping stable ordering
 *
 * @param ids - Raw plugin id list.
 * @returns void
 */
export function setMissingRequiredPlugins(ids: string[]): void {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw).trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  missingRequiredPlugins.value = out;
}
