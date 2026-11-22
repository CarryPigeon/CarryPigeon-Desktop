/**
 * @fileoverview userWireMappers.ts
 * @description account/profile｜数据层 mapper：wire -> domain / domain -> wire。
 */

import type { UserMe, UserPublic } from "../domain/types/UserTypes";
import type { ApiUserMe, ApiUserPublic } from "./httpUserApi";
import { asTrimmedString, asOptionalString } from "@/shared/data/wireMapperUtils";

/**
 * 将用户 wire 模型（当前用户）映射为领域模型。
 *
 * 将服务端用户名和个人简介映射为客户端资料字段。
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
    nickname: asOptionalString(wire.username ?? wire.nickname),
    avatar: asOptionalString(wire.avatar),
    brief: asOptionalString(wire.bio),
    sex: wire.sex,
    birthday: wire.birthday,
  };
}

/**
 * 将用户 wire 模型（公开用户）映射为领域模型。
 *
 * 说明：`GET /users/{uid}` / batch 仅保证 `uid/nickname/avatar`；
 * `bio` / `background_url` 服务端不返回，缺失时 UI 显示为空。
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
    nickname: asTrimmedString(wire.username ?? wire.nickname),
    avatar: asOptionalString(wire.avatar),
    email: asOptionalString(wire.email),
    bio: asOptionalString(wire.bio),
    sex: wire.sex,
    birthday: wire.birthday,
  };
}
