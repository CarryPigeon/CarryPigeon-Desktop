/**
 * @fileoverview UserInfoPage edit-flow compile-time contract checks.
 */

import type { AccountCapabilities, CurrentUserProfilePatch } from "@/features/account/api-types";
import type { ServerConnectionCapabilities } from "@/features/server-connection/api-types";

type ProfileDraft = {
  username: string;
  email: string;
  emailCode: string;
  brief: string;
  avatarUrl: string;
  backgroundUrl: string;
};

type UserInfoEditFlowContract = {
  draft: ProfileDraft;
  applyLocalPatch(patch: CurrentUserProfilePatch): unknown;
  getServer(socket: string): ReturnType<AccountCapabilities["forServer"]>;
  readSocket(capabilities: ServerConnectionCapabilities): string;
};

const editFlowCheck: UserInfoEditFlowContract = {
  draft: {
    username: "Operator",
    email: "operator@example.com",
    emailCode: "123456",
    brief: "bio",
    avatarUrl: "https://example.com/avatar.png",
    backgroundUrl: "https://example.com/background.png",
  },
  applyLocalPatch(patch) {
    return patch;
  },
  getServer(socket) {
    const capabilities = {} as AccountCapabilities;
    return capabilities.forServer(socket);
  },
  readSocket(capabilities) {
    return capabilities.workspace.readSocket().trim();
  },
};

void editFlowCheck;
