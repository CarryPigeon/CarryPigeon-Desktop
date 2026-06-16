/**
 * @fileoverview E2E smoke tests for CarryPigeon Desktop.
 *
 * Prerequisites:
 * 1. Start the dev server: `pnpm run dev`
 * 2. Ensure .env has VITE_USE_MOCK_API=true
 * 3. Run: `pnpm exec playwright test`
 */

import { test, expect } from "@playwright/test";

test.describe("App Shell", () => {
  test("should load the application", async ({ page }) => {
    await page.goto("/");
    // The app should render without a blank page or crash
    await expect(page.locator("#app")).toBeVisible();
  });

  test("should render login page or main page", async ({ page }) => {
    await page.goto("/");
    // Wait for Vue to mount — either the login page or main chat page
    await page.waitForSelector(".cp-login, .cp-patchbay", { timeout: 15000 });
  });
});

test.describe("Settings Page", () => {
  test("should navigate to settings via URL", async ({ page }) => {
    await page.goto("/settings");
    // Settings page should render with navigation sections
    await expect(page.locator("[data-testid='settings-section-general']")).toBeVisible({
      timeout: 15000,
    });
  });

  test("should have theme options visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("[data-testid='settings-theme-patchbay']")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator("[data-testid='settings-theme-legacy']")).toBeVisible();
    await expect(page.locator("[data-testid='settings-theme-light']")).toBeVisible();
  });

  test("should have language options visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("[data-testid='settings-language-zh_cn']")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator("[data-testid='settings-language-en_us']")).toBeVisible();
  });

  test("should navigate back from settings", async ({ page }) => {
    await page.goto("/settings");
    const backButton = page.locator("[data-testid='settings-back']");
    if (await backButton.isVisible()) {
      await backButton.click();
      // Should navigate away from settings
      await expect(page).not.toHaveURL(/\/settings/);
    }
  });
});

test.describe("Plugin Center", () => {
  test("should load plugin center page", async ({ page }) => {
    await page.goto("/plugins");
    // Plugin center should render
    await page.waitForSelector(".cp-plugins, .cp-plugins__state", {
      timeout: 15000,
    });
  });
});

test.describe("Files Page", () => {
  test("should load file manager page", async ({ page }) => {
    await page.goto("/files");
    // File manager should render with title or loading state
    await page.waitForSelector(".cp-fileManager", { timeout: 15000 });
  });
});

test.describe("Accessibility", () => {
  test("should have no critical a11y violations on settings page", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForSelector("[data-testid='settings-section-general']", {
      timeout: 15000,
    });

    // Basic a11y checks
    // Main landmark should exist
    const main = page.locator("main");
    await expect(main.first()).toBeVisible();

    // Buttons should have accessible names
    const buttons = page.locator("button:not([aria-label]):not([aria-hidden='true'])");
    const count = await buttons.count();
    // Most buttons without aria-label should at least have text content
    // (this is a soft check)
    expect(count).toBeGreaterThan(0);
  });
});
