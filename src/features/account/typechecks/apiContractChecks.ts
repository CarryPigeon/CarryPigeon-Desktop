/**
 * @fileoverview account API 编译期契约检查。
 * @description
 * 该文件只用于 TypeScript 编译期检查 account capability-first 公共契约。
 */

import { createAccountCapabilities, getAccountCapabilities } from "@/features/account/api";
import { createCurrentUserCapabilities } from "@/features/account/current-user/api";
import type { AccountCapabilities, CurrentUser } from "@/features/account/api-types";
import type { ReadableCapability } from "@/shared/types/capabilities";

export const accountCapabilitiesContractCheck: AccountCapabilities = createAccountCapabilities();
export const accountCapabilitiesAccessorContractCheck: AccountCapabilities = getAccountCapabilities();
export const currentUserReadableContractCheck: ReadableCapability<CurrentUser> = createCurrentUserCapabilities();

void accountCapabilitiesContractCheck;
void accountCapabilitiesAccessorContractCheck;
