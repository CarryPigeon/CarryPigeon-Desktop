/**
 * @fileoverview chat gateway factory
 * @description
 * 抽离展示层 runtime gateway 组装逻辑，降低 `chat.di.ts` 的职责密度。
 */

import type { AddChannelAdmin } from "@/features/chat/domain/usecases/AddChannelAdmin";
import type { ApplyJoinChannel } from "@/features/chat/domain/usecases/ApplyJoinChannel";
import type { ConnectChatEvents } from "@/features/chat/domain/usecases/ConnectChatEvents";
import type { CreateChannel } from "@/features/chat/domain/usecases/CreateChannel";
import type { DecideChannelApplication } from "@/features/chat/domain/usecases/DecideChannelApplication";
import type { DeleteChannel } from "@/features/chat/domain/usecases/DeleteChannel";
import type { DeleteChannelBan } from "@/features/chat/domain/usecases/DeleteChannelBan";
import type { DeleteMessage } from "@/features/chat/domain/usecases/DeleteMessage";
import type { GetUnreads } from "@/features/chat/domain/usecases/GetUnreads";
import type { KickChannelMember } from "@/features/chat/domain/usecases/KickChannelMember";
import type { ListChannelApplications } from "@/features/chat/domain/usecases/ListChannelApplications";
import type { ListChannelBans } from "@/features/chat/domain/usecases/ListChannelBans";
import type { ListChannelMessages } from "@/features/chat/domain/usecases/ListChannelMessages";
import type { ListChannelMembers } from "@/features/chat/domain/usecases/ListChannelMembers";
import type { ListChannels } from "@/features/chat/domain/usecases/ListChannels";
import type { PatchChannel } from "@/features/chat/domain/usecases/PatchChannel";
import type { PutChannelBan } from "@/features/chat/domain/usecases/PutChannelBan";
import type { RemoveChannelAdmin } from "@/features/chat/domain/usecases/RemoveChannelAdmin";
import type { SendMessage } from "@/features/chat/domain/usecases/SendMessage";
import type { UpdateReadState } from "@/features/chat/domain/usecases/UpdateReadState";
import type {
  ChatApiGateway,
  ChatCoreApiGateway,
  ChatEventsGateway,
  ChatGovernanceApiGateway,
} from "@/features/chat/presentation/store/live/chatGateway";

export type CreateChatApiGatewayDeps = {
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
};

export function createChatCoreApiGateway(deps: CreateChatApiGatewayDeps): ChatCoreApiGateway {
  return {
    listChannels(serverSocket, accessToken) {
      return deps.listChannels.execute(serverSocket, accessToken);
    },
    getUnreads(serverSocket, accessToken) {
      return deps.getUnreads.execute(serverSocket, accessToken);
    },
    listChannelMessages(serverSocket, accessToken, channelId, cursor, limit) {
      return deps.listChannelMessages.execute(serverSocket, accessToken, channelId, cursor, limit);
    },
    sendChannelMessage(serverSocket, accessToken, channelId, req, idempotencyKey) {
      return deps.sendMessage.execute(serverSocket, accessToken, channelId, req, idempotencyKey);
    },
    deleteMessage(serverSocket, accessToken, messageId) {
      return deps.deleteMessage.execute(serverSocket, accessToken, messageId);
    },
    updateReadState(serverSocket, accessToken, channelId, readState) {
      return deps.updateReadState.execute(serverSocket, accessToken, channelId, readState);
    },
    applyJoinChannel(serverSocket, accessToken, channelId, reason) {
      return deps.applyJoinChannel.execute(serverSocket, accessToken, channelId, reason);
    },
    patchChannel(serverSocket, accessToken, channelId, patch) {
      return deps.patchChannel.execute(serverSocket, accessToken, channelId, patch);
    },
  };
}

export function createChatGovernanceApiGateway(deps: CreateChatApiGatewayDeps): ChatGovernanceApiGateway {
  return {
    listChannelMembers(serverSocket, accessToken, channelId) {
      return deps.listChannelMembers.execute(serverSocket, accessToken, channelId);
    },
    kickChannelMember(serverSocket, accessToken, channelId, uid) {
      return deps.kickChannelMember.execute(serverSocket, accessToken, channelId, uid);
    },
    addChannelAdmin(serverSocket, accessToken, channelId, uid) {
      return deps.addChannelAdmin.execute(serverSocket, accessToken, channelId, uid);
    },
    removeChannelAdmin(serverSocket, accessToken, channelId, uid) {
      return deps.removeChannelAdmin.execute(serverSocket, accessToken, channelId, uid);
    },
    listChannelApplications(serverSocket, accessToken, channelId) {
      return deps.listChannelApplications.execute(serverSocket, accessToken, channelId);
    },
    decideChannelApplication(serverSocket, accessToken, channelId, applicationId, decision) {
      return deps.decideChannelApplication.execute(serverSocket, accessToken, channelId, applicationId, decision);
    },
    listChannelBans(serverSocket, accessToken, channelId) {
      return deps.listChannelBans.execute(serverSocket, accessToken, channelId);
    },
    putChannelBan(serverSocket, accessToken, channelId, uid, until, reason) {
      return deps.putChannelBan.execute(serverSocket, accessToken, channelId, uid, until, reason);
    },
    deleteChannelBan(serverSocket, accessToken, channelId, uid) {
      return deps.deleteChannelBan.execute(serverSocket, accessToken, channelId, uid);
    },
    createChannel(serverSocket, accessToken, req) {
      return deps.createChannel.execute(serverSocket, accessToken, req);
    },
    deleteChannel(serverSocket, accessToken, channelId) {
      return deps.deleteChannel.execute(serverSocket, accessToken, channelId);
    },
  };
}

export function createChatApiGateway(deps: CreateChatApiGatewayDeps): ChatApiGateway {
  return {
    ...createChatCoreApiGateway(deps),
    ...createChatGovernanceApiGateway(deps),
  };
}

export function createChatEventsGateway(connectChatEvents: ConnectChatEvents): ChatEventsGateway {
  return {
    connect(serverSocket, accessToken, onEvent, options) {
      return connectChatEvents.execute(serverSocket, accessToken, onEvent, options);
    },
  };
}
