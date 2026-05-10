/**
 * @fileoverview current-user snapshot compile-time contract checks.
 */

import { toCurrentUserSnapshot } from "@/features/account/application/currentUserSnapshot";
import { createCurrentUserCapabilities } from "@/features/account/current-user/api";
import {
  getCurrentUserSnapshot,
  replaceCurrentUserSnapshot,
} from "@/features/account/current-user/application/currentUserState";
import type { CurrentUser } from "@/features/account/current-user/application/currentUserContracts";

type CurrentUserWithProfileMedia = CurrentUser & {
  avatarUrl: string;
  backgroundUrl: string;
};

const snapshotCheck: CurrentUserWithProfileMedia = toCurrentUserSnapshot({
  uid: "1",
  email: "user@example.com",
  nickname: "Operator",
  brief: "bio",
  avatar: "https://example.com/avatar.png",
  backgroundUrl: "https://example.com/background.png",
});

void snapshotCheck.avatarUrl;
void snapshotCheck.backgroundUrl;

const storedSnapshotCheck: CurrentUserWithProfileMedia = replaceCurrentUserSnapshot(snapshotCheck);
const readBackSnapshotCheck: CurrentUserWithProfileMedia = getCurrentUserSnapshot();

void storedSnapshotCheck.avatarUrl;
void storedSnapshotCheck.backgroundUrl;
void readBackSnapshotCheck.avatarUrl;
void readBackSnapshotCheck.backgroundUrl;

const currentUserCapabilitiesCheck = createCurrentUserCapabilities();
const patchedSnapshotCheck: CurrentUserWithProfileMedia = currentUserCapabilitiesCheck.applyLocalProfilePatch({
  avatarUrl: "https://example.com/updated-avatar.png",
  backgroundUrl: "https://example.com/updated-background.png",
});

void patchedSnapshotCheck.avatarUrl;
void patchedSnapshotCheck.backgroundUrl;
