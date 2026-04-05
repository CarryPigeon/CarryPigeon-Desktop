/**
 * @fileoverview userWireMappers.ts
 * @description account/profile｜数据层 mapper：wire -> domain / domain -> wire。
 */

import type { UserMe, UserPublic } from "../domain/types/UserTypes";
import type { ApiUserMe, ApiUserPublic } from "./httpUserApi";
import { asTrimmedString, asOptionalString } from "@/shared/data/wireMapperUtils";

/**
 * 将用户 wire 模型（当前用户）映射为领域模型。
 */
export function mapUserMeWire(wire: ApiUserMe): UserMe {
  if (!wire) {
    return {
      uid: "",
    };
  }
  return {
    uid: asTrimmedString(wire.uid),
    email: asOptionalString(wire.email),
    nickname: asOptionalString(wire.nickname),
    avatar: asOptionalString(wire.avatar),
    backgroundUrl: asOptionalString(wire.backgroundUrl),
  };
}

/**
 * 将用户 wire 模型（公开用户）映射为领域模型。
 */
export function mapUserPublicWire(wire: ApiUserPublic): UserPublic {
  if (!wire) {
    return {
      uid: "",
      nickname: "",
    };
  }
  return {
    uid: asTrimmedString(wire.uid),
    nickname: asTrimmedString(wire.nickname),
    avatar: asOptionalString(wire.avatar),
    email: asOptionalString(wire.email),
    bio: asOptionalString(wire.bio),
    backgroundUrl: asOptionalString(wire.backgroundUrl),
  };
}
