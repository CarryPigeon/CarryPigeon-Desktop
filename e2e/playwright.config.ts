/**
 * @fileoverview Playwright E2E 测试配置
 * @description
 * 使用方式：
 * 1. pnpm add -D @playwright/test
 * 2. npx playwright install chromium
 * 3. pnpm exec playwright test
 *
 * 前提：需要先启动开发服务器 (pnpm run dev)，端口 1420。
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: "http://localhost:1420",
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10000,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
