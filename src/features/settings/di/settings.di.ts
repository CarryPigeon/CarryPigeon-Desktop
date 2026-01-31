/**
 * @fileoverview settings.di.ts 文件职责说明。
 */
import { tauriConfigAdapter } from "../data/tauriConfigAdapter";
import { GetConfig } from "../domain/usecases/GetConfig";
import { UpdateConfig } from "../domain/usecases/UpdateConfig";

let getConfig: GetConfig | null = null;
let updateConfig: UpdateConfig | null = null;

/**
 * getGetConfigUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getGetConfigUsecase(): GetConfig {
  if (getConfig) return getConfig;
  getConfig = new GetConfig(tauriConfigAdapter);
  return getConfig;
}

/**
 * getUpdateConfigUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getUpdateConfigUsecase(): UpdateConfig {
  if (updateConfig) return updateConfig;
  updateConfig = new UpdateConfig(tauriConfigAdapter);
  return updateConfig;
}

