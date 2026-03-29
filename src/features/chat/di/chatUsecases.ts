/**
 * @fileoverview chat usecases factory
 * @description
 * 统一描述 chat 用例的构造方式。
 *
 * 设计原因：
 * - 用例是 application 层的显式能力面；
 * - 该文件只负责“如何创建”，不负责“何时缓存/复用”；
 * - 生命周期统一由 `chatRuntime.ts` 的 composition root 决定。
 */

import { AddChannelAdmin } from "@/features/chat/domain/usecases/AddChannelAdmin";
import { ApplyJoinChannel } from "@/features/chat/domain/usecases/ApplyJoinChannel";
import { ConnectChatEvents } from "@/features/chat/domain/usecases/ConnectChatEvents";
import { CreateChannel } from "@/features/chat/domain/usecases/CreateChannel";
import { DecideChannelApplication } from "@/features/chat/domain/usecases/DecideChannelApplication";
import { DeleteChannel } from "@/features/chat/domain/usecases/DeleteChannel";
import { DeleteChannelBan } from "@/features/chat/domain/usecases/DeleteChannelBan";
import { DeleteMessage } from "@/features/chat/domain/usecases/DeleteMessage";
import { GetUnreads } from "@/features/chat/domain/usecases/GetUnreads";
import { KickChannelMember } from "@/features/chat/domain/usecases/KickChannelMember";
import { ListChannelApplications } from "@/features/chat/domain/usecases/ListChannelApplications";
import { ListChannelBans } from "@/features/chat/domain/usecases/ListChannelBans";
import { ListChannelMessages } from "@/features/chat/domain/usecases/ListChannelMessages";
import { ListChannelMembers } from "@/features/chat/domain/usecases/ListChannelMembers";
import { ListChannels } from "@/features/chat/domain/usecases/ListChannels";
import { PatchChannel } from "@/features/chat/domain/usecases/PatchChannel";
import { PutChannelBan } from "@/features/chat/domain/usecases/PutChannelBan";
import { RemoveChannelAdmin } from "@/features/chat/domain/usecases/RemoveChannelAdmin";
import { SendMessage } from "@/features/chat/domain/usecases/SendMessage";
import { UpdateReadState } from "@/features/chat/domain/usecases/UpdateReadState";
import type { ChatPorts } from "./chatPorts";

export type ChatUsecases = {
  listChannels: ListChannels;
  getUnreads: GetUnreads;
  listChannelMessages: ListChannelMessages;
  sendMessage: SendMessage;
  deleteMessage: DeleteMessage;
  updateReadState: UpdateReadState;
  applyJoinChannel: ApplyJoinChannel;
  patchChannel: PatchChannel;
  listChannelMembers: ListChannelMembers;
  kickChannelMember: KickChannelMember;
  addChannelAdmin: AddChannelAdmin;
  removeChannelAdmin: RemoveChannelAdmin;
  listChannelApplications: ListChannelApplications;
  decideChannelApplication: DecideChannelApplication;
  listChannelBans: ListChannelBans;
  putChannelBan: PutChannelBan;
  deleteChannelBan: DeleteChannelBan;
  createChannel: CreateChannel;
  deleteChannel: DeleteChannel;
  connectChatEvents: ConnectChatEvents;
};

export function createChatUsecases(ports: ChatPorts): ChatUsecases {
  return {
    listChannels: new ListChannels(ports.api),
    getUnreads: new GetUnreads(ports.api),
    listChannelMessages: new ListChannelMessages(ports.api),
    sendMessage: new SendMessage(ports.api),
    deleteMessage: new DeleteMessage(ports.api),
    updateReadState: new UpdateReadState(ports.api),
    applyJoinChannel: new ApplyJoinChannel(ports.api),
    patchChannel: new PatchChannel(ports.api),
    listChannelMembers: new ListChannelMembers(ports.api),
    kickChannelMember: new KickChannelMember(ports.api),
    addChannelAdmin: new AddChannelAdmin(ports.api),
    removeChannelAdmin: new RemoveChannelAdmin(ports.api),
    listChannelApplications: new ListChannelApplications(ports.api),
    decideChannelApplication: new DecideChannelApplication(ports.api),
    listChannelBans: new ListChannelBans(ports.api),
    putChannelBan: new PutChannelBan(ports.api),
    deleteChannelBan: new DeleteChannelBan(ports.api),
    createChannel: new CreateChannel(ports.api),
    deleteChannel: new DeleteChannel(ports.api),
    connectChatEvents: new ConnectChatEvents(ports.events),
  };
}
