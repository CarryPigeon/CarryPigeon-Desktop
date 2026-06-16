/**
 * @fileoverview pluginTypes 单元测试
 */

import { describe, expect, it } from "vitest";
import {
  comparePluginVersionDesc,
  normalizePluginCatalogVersionEntries,
  resolveLatestPluginCatalogVersion,
  resolveLatestPluginCatalogVersionEntry,
  type PluginCatalogEntryLike,
  type PluginCatalogVersionEntry,
} from "./pluginTypes";

describe("comparePluginVersionDesc", () => {
  it("should sort newer versions first", () => {
    expect(comparePluginVersionDesc("2.0.0", "1.0.0")).toBeLessThan(0);
    expect(comparePluginVersionDesc("1.0.0", "2.0.0")).toBeGreaterThan(0);
    expect(comparePluginVersionDesc("1.0.0", "1.0.0")).toBe(0);
  });

  it("should handle numeric segments correctly (1.10 > 1.2)", () => {
    // 1.10 should be greater than 1.2 in numeric comparison
    const sorted = ["1.2.0", "1.10.0", "1.1.0"].sort(comparePluginVersionDesc);
    expect(sorted[0]).toBe("1.10.0");
  });

  it("should handle empty strings", () => {
    expect(comparePluginVersionDesc("", "")).toBe(0);
    expect(comparePluginVersionDesc("1.0.0", "")).toBeLessThan(0);
    expect(comparePluginVersionDesc("", "1.0.0")).toBeGreaterThan(0);
  });
});

describe("normalizePluginCatalogVersionEntries", () => {
  it("should deduplicate by version, preferring server source", () => {
    const entries: readonly PluginCatalogVersionEntry[] = [
      { version: "1.0.0", source: "repo", sha256: "abc" },
      { version: "1.0.0", source: "server", sha256: "def" },
    ];
    const result = normalizePluginCatalogVersionEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("server");
    expect(result[0].sha256).toBe("def");
  });

  it("should sort by version descending", () => {
    const entries: readonly PluginCatalogVersionEntry[] = [
      { version: "1.0.0", source: "server", sha256: "a" },
      { version: "2.0.0", source: "server", sha256: "b" },
      { version: "1.5.0", source: "server", sha256: "c" },
    ];
    const result = normalizePluginCatalogVersionEntries(entries);
    expect(result).toHaveLength(3);
    expect(result[0].version).toBe("2.0.0");
    expect(result[1].version).toBe("1.5.0");
    expect(result[2].version).toBe("1.0.0");
  });

  it("should filter out entries with empty version", () => {
    const entries: readonly PluginCatalogVersionEntry[] = [
      { version: "", source: "server", sha256: "a" },
      { version: "1.0.0", source: "server", sha256: "b" },
    ];
    const result = normalizePluginCatalogVersionEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe("1.0.0");
  });

  it("should return empty array for empty input", () => {
    expect(normalizePluginCatalogVersionEntries([])).toEqual([]);
  });
});

describe("resolveLatestPluginCatalogVersionEntry", () => {
  const basePlugin: PluginCatalogEntryLike = {
    pluginId: "test.plugin",
    name: "Test",
    tagline: "",
    description: "",
    source: "server",
    sha256: "sha",
    required: false,
    versions: ["1.0.0", "2.0.0"],
    versionEntries: [
      { version: "2.0.0", source: "server" as const, sha256: "a" },
      { version: "1.0.0", source: "server" as const, sha256: "b" },
    ],
    providesDomains: [],
    permissions: [],
  };

  it("should return the latest version entry", () => {
    const entry = resolveLatestPluginCatalogVersionEntry(basePlugin);
    expect(entry?.version).toBe("2.0.0");
  });

  it("should return null for plugin with no version entries", () => {
    const plugin: PluginCatalogEntryLike = {
      ...basePlugin,
      versions: [],
      versionEntries: [],
    };
    expect(resolveLatestPluginCatalogVersionEntry(plugin)).toBeNull();
  });
});

describe("resolveLatestPluginCatalogVersion", () => {
  it("should return latest version string", () => {
    const plugin: PluginCatalogEntryLike = {
      pluginId: "test.plugin",
      name: "Test",
      tagline: "",
      description: "",
      source: "server",
      sha256: "sha",
      required: false,
      versions: [],
      versionEntries: [
        { version: "3.0.0", source: "server" as const, sha256: "a" },
        { version: "1.0.0", source: "server" as const, sha256: "b" },
      ],
      providesDomains: [],
      permissions: [],
    };
    expect(resolveLatestPluginCatalogVersion(plugin)).toBe("3.0.0");
  });

  it("should return empty string when no versions", () => {
    const plugin: PluginCatalogEntryLike = {
      pluginId: "empty",
      name: "Empty",
      tagline: "",
      description: "",
      source: "server",
      sha256: "",
      required: false,
      versions: [],
      versionEntries: [],
      providesDomains: [],
      permissions: [],
    };
    expect(resolveLatestPluginCatalogVersion(plugin)).toBe("");
  });
});
