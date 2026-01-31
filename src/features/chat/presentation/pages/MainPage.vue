<script setup lang="ts">
/**
 * @fileoverview MainPage.vue 文件职责说明。
 */

import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import ServerList from "@/features/servers/presentation/components/lists/ServerList.vue";
import ChannelList from "@/features/channels/presentation/components/lists/ChannelList.vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import UserComponent from "@/features/user/presentation/components/UserComponent.vue";
import SearchBar from "@/features/chat/presentation/components/inputs/SearchBar.vue";
import TextArea from "@/features/chat/presentation/components/inputs/TextArea.vue";
import type { Member } from "@/features/user/domain/entities/Member";
import ChatBox from "@/features/chat/presentation/components/messages/ChatBox.vue";
import MemberContextMenu, {
    type MemberMenuAction,
} from "@/features/chat/presentation/components/items/MemberContextMenu.vue";
import { useI18n } from "vue-i18n";
import { MessagePlugin } from "tdesign-vue-next";
import { copyTextToClipboard } from "@/shared/utils/clipboard";
import { dispatchInsertText } from "@/shared/utils/messageEvents";
import { isIgnoredUser, toggleIgnoreUser } from "@/features/chat/presentation/store/ignoreStore";
import ParticipantsList from "@/features/channels/presentation/components/lists/ParticipantsList.vue";
import { getOpenInfoWindowUsecase, getResizeChatWindowUsecase } from "@/features/windows/di/windows.di";
import {
    createChannelBasicService,
    createChannelMemberService,
    createChannelMessageService,
} from "@/features/channels/data/channelServiceFactory";
import { importChannels, useChannelStore } from "@/features/channels/presentation/store/channelStore";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { currentUser } from "@/features/user/presentation/store/userData";
import { createLogger } from "@/shared/utils/logger";
import { setChannelId } from "@/features/chat/presentation/store/chatContext";
import { getLatestMessageTime } from "@/features/chat/presentation/store/messageList";
import Avatar from "/test_avatar.jpg?url";
import { setActiveMessageContext } from "@/features/chat/presentation/store/messageList";
import { createUserService } from "@/features/user/data/userServiceFactory";
import { TCP_SERVICE } from "@/features/network/data/tcp";
import ConnectionPill, { type ConnectionState } from "@/shared/ui/ConnectionPill.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import { useServerListStore } from "@/features/servers/presentation/store/serverListStore";

const logger = createLogger("MainPage");

const { t } = useI18n();
const router = useRouter();

// 获取当前选中的频道ID
const { activeChannelId, channels } = useChannelStore();
const { servers } = useServerListStore();

const currentUserMember = computed<Member>(() => ({
    id: currentUser.id,
    name: currentUser.username,
    avatarUrl: currentUser.avatarUrl,
    description: currentUser.description,
    email: currentUser.email,
}));

const currentServerName = computed(() => {
    const socket = currentServerSocket.value;
    if (!socket) return t("server_not_connected");
    return servers.find((s) => s.socket === socket)?.name || socket;
});

const activeChannelName = computed(() => {
    const id = activeChannelId.value;
    if (!id) return "";
    return channels.find((c) => c.cid === id)?.channelName || "";
});

const connection = computed((): { state: ConnectionState; label: string; detail: string } => {
    const socket = currentServerSocket.value;
    if (!socket) {
        return { state: "offline", label: "OFFLINE", detail: t("server_not_connected") };
    }
    const service = TCP_SERVICE.get(socket);
    if (!service) {
        return { state: "offline", label: "OFFLINE", detail: socket };
    }
    if (!service.encrypter.isHandshakeComplete()) {
        return { state: "reconnecting", label: "HANDSHAKE", detail: socket };
    }
    return { state: "connected", label: "OK", detail: socket };
});

/**
 * openPluginCenter 方法说明。
 * @returns 返回值说明。
 */
function openPluginCenter() {
    void router.push("/plugins");
}

/**
 * openSettings 方法说明。
 * @returns 返回值说明。
 */
function openSettings() {
    void router.push("/settings");
}

const channelMessageService = ref<ReturnType<typeof createChannelMessageService> | null>(null);

const profileWindowSize = {
    width: 560,
    height: 680,
};

onMounted(() => {
    void getResizeChatWindowUsecase()
        .execute()
        .then(() => getCurrentWindow().center())
        .catch((e) => logger.warn("Resize chat window failed", { error: String(e) }));
});

watch(
    currentServerSocket,
    (socket) => {
        if (!socket) {
            channelMessageService.value = null;
            logger.warn("Missing current server socket");
            return;
        }

        setChannelId(0);
        setActiveMessageContext(socket, 0);
        channelMessageService.value = createChannelMessageService(socket);

        void createChannelBasicService(socket)
            .getAllChannels()
            .then((channels) => {
                const mapped = channels.map((channel) => ({
                    cid: channel.cid,
                    channelName: channel.name,
                    latestMsg: channel.brief ?? "",
                    imgUrl: `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(channel.name)}`,
                    bio: channel.brief ?? "",
                    owner: channel.owner,
                }));
                importChannels(mapped);
            })
            .catch((e) => logger.error("Load channels failed", { error: String(e) }));

        void channelMessageService.value
            .getAllUnreceivedMessages()
            .catch((e) => logger.error("Load unreceived messages failed", { error: String(e) }));
    },
    { immediate: true },
);

/**
 * openMemberProfile 方法说明。
 * @param member - 参数说明。
 * @param editable - 参数说明。
 * @returns 返回值说明。
 */
async function openMemberProfile(member: Member, editable: boolean) {
    const socket = currentServerSocket.value;
    let profile: Record<string, unknown> | null = null;
    if (socket) {
        try {
            profile = await createUserService(socket).getUserProfile(member.id);
        } catch (e) {
            logger.warn("Load user profile failed", { error: String(e) });
        }
    }

    const query = new URLSearchParams({
        window: "user-profile",
        uid: String(member.id),
        avatar: String(member.avatarUrl ?? ""),
        name: String((profile?.username as string) ?? member.name ?? ""),
        email: String((profile?.email as string) ?? member.email ?? ""),
        bio: String((profile?.brief as string) ?? member.description ?? ""),
        sex: String((profile?.sex as number) ?? 0),
        birthday: String((profile?.birthday as number) ?? 0),
        avatar_id: String((profile?.avatar as number) ?? -1),
        editable: editable ? "1" : "0",
    }).toString();

    void getOpenInfoWindowUsecase().execute({
        label: "user-profile",
        title: member.name || t("user_info"),
        query,
        width: profileWindowSize.width,
        height: profileWindowSize.height,
    });
}

/**
 * openUserPopover 方法说明。
 * @returns 返回值说明。
 */
function openUserPopover() {
    void openMemberProfile(currentUserMember.value, true);
}

/**
 * openMemberProfileFromList 方法说明。
 * @param payload - 参数说明。
 * @returns 返回值说明。
 */
function openMemberProfileFromList(payload: { member: Member }) {
    const isSelf = payload.member.id === currentUserMember.value.id;
    void openMemberProfile(payload.member, isSelf);
}

const memberMenuOpen = ref(false);
const memberMenuClient = ref({ x: 0, y: 0 });
const memberMenuScreen = ref({ x: 0, y: 0 });
const selectedMember = ref<Member | null>(null);

const selectedMemberMuted = computed(() => {
    const member = selectedMember.value;
    return member ? isIgnoredUser(member.id) : false;
});

const participantsList = ref<Member[]>([]);

/**
 * updateParticipantsList 方法说明。
 * @param cid - 参数说明。
 * @returns 返回值说明。
 */
async function updateParticipantsList(cid: number) {
    setChannelId(cid);
    const socket = currentServerSocket.value;
    setActiveMessageContext(socket, cid);
    if (!socket) {
        participantsList.value = [];
        return;
    }
    try {
        const memberService = createChannelMemberService(socket);
        const data = await memberService.getAllMembers(cid);
        type RawChannelMember = { uid?: number | string | null; name?: string | null };
        const members = Array.isArray((data as { members?: unknown })?.members)
            ? (((data as { members: unknown }).members) as RawChannelMember[])
            : [];
        participantsList.value = members.map((member) => ({
            id: Number(member.uid ?? 0),
            name: String(member.name ?? `User ${member.uid ?? ""}`),
            avatarUrl: Avatar,
            description: "",
            status: "online",
        }));

        const latest = getLatestMessageTime(socket, cid);
        if (latest > 0 && channelMessageService.value) {
            await channelMessageService.value.updateReadState(cid, latest);
        }
    } catch (e) {
        logger.error("Load members failed", { error: String(e) });
        participantsList.value = [];
    }
}

/**
 * openMemberContextMenuFromChat function.
 * @param payload - TODO.
 */
function openMemberContextMenuFromChat(payload: {
    screenX: number;
    screenY: number;
    clientX: number;
    clientY: number;
    userId: number;
    name: string;
    avatar: string;
}) {
    const member: Member = {
        id: payload.userId,
        name: payload.name,
        avatarUrl: payload.avatar,
        description: "",
        email: "",
    };
    openMemberContextMenu({
        screenX: payload.screenX,
        screenY: payload.screenY,
        clientX: payload.clientX,
        clientY: payload.clientY,
        member,
    });
}

/**
 * openMemberContextMenu function.
 * @param payload - TODO.
 */
function openMemberContextMenu(payload: {
    screenX: number;
    screenY: number;
    clientX: number;
    clientY: number;
    member: Member;
}) {
    memberMenuClient.value = { x: payload.clientX, y: payload.clientY };
    memberMenuScreen.value = { x: payload.screenX, y: payload.screenY };
    selectedMember.value = payload.member;
    memberMenuOpen.value = true;
}

/**
 * handleMemberMenuAction 方法说明。
 * @param action - 参数说明。
 * @returns 返回值说明。
 */
async function handleMemberMenuAction(action: MemberMenuAction) {
    const member = selectedMember.value;
    if (!member) return;

    switch (action) {
        case "sendMessage":
            dispatchInsertText(`/msg ${member.name} `);
            return;
        case "mention":
            dispatchInsertText(`@${member.name} `);
            return;
        case "viewProfile":
            void openMemberProfile(member, false);
            return;
        case "report": {
            const payload = `uid: ${member.id}\nname: ${member.name}\nemail: ${member.email ?? ""}`;
            const ok = await copyTextToClipboard(payload);
            if (ok) MessagePlugin.success(t("member_report_copied"), 2000);
            else MessagePlugin.error(t("copy_failed"), 2000);
            return;
        }
        case "toggleMute": {
            const wasMuted = isIgnoredUser(member.id);
            toggleIgnoreUser(member.id);
            MessagePlugin.success(
                wasMuted ? t("member_unmuted_toast") : t("member_muted_toast"),
                2000,
            );
            return;
        }
    }
}
</script>

<template>
    <!-- 页面：聊天主界面｜职责：服务器/频道/成员/消息/输入框组合与交互编排 -->
    <!-- 区块：<div> .app-shell -->
    <div class="app-shell">
        <!-- 区块：<aside> -->
        <aside class="server-rail">
            <ServerList />
        </aside>

        <!-- 区块：<aside> -->
        <aside class="channel-rail">
            <ChannelList @channel-click="updateParticipantsList" />
            <UserComponent
                :avatar="currentUserMember.avatarUrl"
                :name="currentUserMember.name"
                :description="currentUserMember.description"
                :id="currentUserMember.id"
                @profile-click="openUserPopover"
            />
        </aside>

        <!-- 区块：<header> -->
        <header class="top-bar">
            <div class="top-console">
                <div class="top-console-left">
                    <div class="top-console-kicker">
                        <LabelBadge variant="domain" label="RACK" />
                        <div class="top-console-title" :title="currentServerName">{{ currentServerName }}</div>
                    </div>
                    <div class="top-console-meta">
                        <MonoTag
                            :value="currentServerSocket || ''"
                            :title="$t('server_socket')"
                            :copyable="Boolean(currentServerSocket)"
                        />
                        <button class="top-console-btn" type="button" @click="openPluginCenter">
                            {{ $t("menu_manager_plugins") }}
                        </button>
                        <button class="top-console-btn" type="button" @click="openSettings">
                            {{ $t("settings") }}
                        </button>
                    </div>
                </div>

                <div class="top-console-right">
                    <SearchBar />
                    <ConnectionPill :state="connection.state" :label="connection.label" :detail="connection.detail" />
                </div>
            </div>
        </header>

        <!-- 有选中频道时显示聊天区域 -->
        <template v-if="activeChannelId">
            <!-- 区块：<section> -->
            <section class="chat-pane">
                <ChatBox
                    :user_id="currentUserMember.id"
                    @avatar-contextmenu="openMemberContextMenuFromChat"
                />
            </section>

            <!-- 区块：<section> -->
            <section class="input-pane">
                <TextArea />
            </section>

            <!-- 区块：<aside> -->
            <aside class="members-rail">
                <ParticipantsList
                    :length="participantsList.length"
                    :online="
                        participantsList.filter((member) => member.status === 'online')
                            .length
                    "
                    :member="participantsList"
                    @avatar-click="openMemberProfileFromList"
                    @avatar-contextmenu="openMemberContextMenu"
                />
            </aside>
        </template>

        <!-- 未选中频道时显示空状态 -->
        <template v-else>
            <!-- 区块：<section> -->
            <section class="empty-state">
                <!-- 区块：<div> .empty-content -->
                <div class="empty-content">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" class="empty-icon">
                        <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p class="empty-title">选择一个端口开始收发信号</p>
                    <p class="empty-desc">
                        {{ activeChannelName ? `当前：${activeChannelName}` : "从 Patch Panel 选择频道，即可开始发送消息。" }}
                    </p>
                </div>
            </section>
        </template>
    </div>

    <MemberContextMenu
        v-model:open="memberMenuOpen"
        :x="memberMenuClient.x"
        :y="memberMenuClient.y"
        :muted="selectedMemberMuted"
        @action="handleMemberMenuAction"
    />
</template>

<style scoped lang="scss">
/* 样式：主界面布局网格化 - 暖纸 + 玻璃卡片 */
.app-shell {
    display: grid;
    grid-template-columns:
        var(--server-rail-width, 64px)
        var(--channel-list-width, 260px)
        minmax(0, 1fr)
        var(--participants-list-width, 240px);
    grid-template-rows: 54px minmax(0, 1fr) auto;
    grid-template-areas:
        "server channel header members"
        "server channel chat members"
        "server channel input members";
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: transparent;
    padding: 12px;
    gap: 12px;
    box-sizing: border-box;
    animation: cp-fade-up 420ms var(--cp-ease, ease) both;
}

/* Shared panel baseline */
:is(.server-rail, .channel-rail, .top-bar, .chat-pane, .input-pane, .members-rail, .empty-state) {
    border-radius: var(--cp-radius-lg, 18px);
    overflow: hidden;
    border: 1px solid var(--cp-border);
    background: var(--cp-panel);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: var(--cp-shadow-soft);
}

/* 样式：.server-rail */
.server-rail {
    grid-area: server;
    height: 100%;
    position: relative;
    background:
        linear-gradient(180deg, var(--cp-glow-a), transparent 46%),
        linear-gradient(180deg, var(--cp-glow-b), transparent 62%),
        var(--cp-panel);
}

/* Patchbay: rail markings + accent spine */
.server-rail::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
        repeating-linear-gradient(
            180deg,
            rgba(148, 163, 184, 0.0),
            rgba(148, 163, 184, 0.0) 10px,
            rgba(148, 163, 184, 0.08) 10px,
            rgba(148, 163, 184, 0.08) 11px
        );
    opacity: 0.55;
    mix-blend-mode: normal;
}

.server-rail::after {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 1px;
    pointer-events: none;
    background: linear-gradient(180deg, rgba(56, 189, 248, 0.0), rgba(56, 189, 248, 0.28), rgba(34, 197, 94, 0.22), rgba(34, 197, 94, 0.0));
    opacity: 0.9;
}

/* 样式：.channel-rail */
.channel-rail {
    grid-area: channel;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
}

/* 样式：.top-bar */
.top-bar {
    grid-area: header;
    height: 100%;
    position: relative;
}

.top-bar::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        linear-gradient(180deg, rgba(148, 163, 184, 0.10), transparent 36%),
        linear-gradient(90deg, rgba(148, 163, 184, 0.10), transparent 22%, transparent 78%, rgba(148, 163, 184, 0.10));
    opacity: 0.35;
}

.top-console {
    height: 100%;
    width: 100%;
    display: grid;
    grid-template-columns: minmax(220px, 1.05fr) minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    box-sizing: border-box;
    position: relative;
    z-index: 1;
}

.top-console-left {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.top-console-kicker {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.top-console-title {
    font-family: var(--cp-font-display);
    font-size: 14px;
    letter-spacing: 0.01em;
    color: var(--cp-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.top-console-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.top-console-btn {
    border: 1px solid var(--cp-border);
    background: var(--cp-panel-muted);
    color: var(--cp-text);
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    transition:
        transform var(--cp-fast) var(--cp-ease),
        background-color var(--cp-fast) var(--cp-ease),
        border-color var(--cp-fast) var(--cp-ease);

    &:hover {
        transform: translateY(-1px);
        background: var(--cp-hover-bg);
        border-color: rgba(56, 189, 248, 0.30);
    }
}

.top-console-right {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
}

/* 样式：.chat-pane */
.chat-pane {
    grid-area: chat;
    min-height: 0;
    position: relative;
}

/* 样式：.input-pane */
.input-pane {
    grid-area: input;
    position: relative;
}

/* 样式：.members-rail */
.members-rail {
    grid-area: members;
    height: 100%;
    display: flex;
    min-height: 0;
    position: relative;
}

/* Empty state should match the “paper” center pane */
.empty-state {
    grid-area: chat;
    min-height: 0;
    display: grid;
    place-items: center;
}

.empty-content {
    max-width: 420px;
    padding: 28px;
    text-align: center;
}

.empty-icon {
    color: var(--cp-info);
    opacity: 0.85;
    filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.18));
}

.empty-title {
    margin: 14px 0 6px;
    font-family: var(--cp-font-display);
    font-size: 18px;
    letter-spacing: -0.02em;
}

.empty-desc {
    margin: 0;
    color: var(--cp-text-muted);
    font-size: 13px;
    line-height: 1.5;
}
</style>
