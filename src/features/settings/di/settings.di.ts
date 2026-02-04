/**
 * @fileoverview settings.di.ts
 * @description Composition root for settings feature.
 */

import { USE_MOCK_API, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import type { ConfigPort } from "../domain/ports/ConfigPort";
import { localStorageConfigPort } from "../data/localStorageConfigPort";
import { mockConfigPort } from "../mock/mockConfigPort";
import { GetConfig } from "../domain/usecases/GetConfig";
import { SetTheme } from "../domain/usecases/SetTheme";

let configPort: ConfigPort | null = null;

// ============================================================================
// Ports
// ============================================================================

/**
 * Get singleton ConfigPort.
 *
 * Note: Even in mock mode, we typically use localStorage for theme to avoid
 * visual flash. Override with mock if needed for testing.
 *
 * @returns ConfigPort.
 */
export function getConfigPort(): ConfigPort {
  if (configPort) return configPort;
  // Keep theme persistence stable in protocol mode as well (localStorage).
  configPort = USE_MOCK_TRANSPORT ? localStorageConfigPort : USE_MOCK_API ? mockConfigPort : localStorageConfigPort;
  return configPort;
}

// ============================================================================
// Usecases
// ============================================================================

/**
 * Get GetConfig usecase.
 *
 * @returns GetConfig usecase instance.
 */
export function getGetConfigUsecase(): GetConfig {
  return new GetConfig(getConfigPort());
}

/**
 * Get SetTheme usecase.
 *
 * @returns SetTheme usecase instance.
 */
export function getSetThemeUsecase(): SetTheme {
  return new SetTheme(getConfigPort());
}
