<script setup lang="ts">
import { computed, ref } from "vue";
import ServerList from "../components/lists/ServerList.vue";
import ServerNameModel from "../components/modals/ServerNameModel.vue";
import ChannelList from "../components/lists/ChannelList.vue";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import UserComponent from "../components/users/UserComponent.vue";
import SearchBar from "../components/inputs/SearchBar.vue";
import TextArea from "../components/inputs/TextArea.vue";
import { Member } from "../value/memberValue.ts";
import ChatBox from "../components/messages/ChatBox.vue";
import MemberContextMenu, {
    type MemberMenuAction,
} from "../components/items/MemberContextMenu.vue";
import Avatar from "/test_avatar.jpg?url";
import { getServerSocket } from "../script/store/serverStore";
import ChannelMessageService from "../api/channel/Channel.ts";
import { useI18n } from "vue-i18n";
import { MessagePlugin } from "tdesign-vue-next";
import { copyTextToClipboard } from "../script/utils/clipboard";
import { dispatchInsertText } from "../script/utils/messageEvents";
import { isIgnoredUser, toggleIgnoreUser } from "../script/store/ignoreStore";
import ParticipantsList from "../components/lists/ParticipantsList.vue";

void invoke("to_chat_window_size")
    .then(() => getCurrentWindow().center())
    .catch(() => {});

const { t } = useI18n();

const channelMessageService = new ChannelMessageService(getServerSocket());
const a: Member = {
    id: 1,
    name: "张三",
    avatarUrl: Avatar,
    description: "热爱 Rust 与前端工程化，喜欢构建好用的桌面应用。",
    email: "zhangsan@example.com",
};

const popoverSize = {
    width: 320,
    height: 140,
};

channelMessageService.getAllUnreceivedMessages();

function openMemberPopover(payload: {
    screenX: number;
    screenY: number;
    member: Member;
}) {
    const query = new URLSearchParams({
        window: "user-info-popover",
        avatar: payload.member.avatarUrl,
        name: payload.member.name,
        email: payload.member.email ?? "",
        bio: payload.member.description,
    }).toString();

    invoke("open_popover_window", {
        query,
        x: payload.screenX,
        y: payload.screenY,
        width: popoverSize.width,
        height: popoverSize.height,
    });
}

function openUserPopover(pos: { screenX: number; screenY: number }) {
    openMemberPopover({ ...pos, member: a });
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

import { getParticipants } from "../script/store/channelStore.ts";

async function updateParticipantsList(cid: number) {
    //participantsList.value = await invoke("get_participants_list", cid); stable
    //test code

    participantsList.value = await getParticipants(cid);
}

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
            openMemberPopover({
                screenX: memberMenuScreen.value.x,
                screenY: memberMenuScreen.value.y,
                member,
            });
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
    <ServerList />
    <ServerNameModel />
    <ChannelList @channel-click="updateParticipantsList" />
    <UserComponent
        :avatar="a.avatarUrl"
        :name="a.name"
        :description="a.description"
        :id="a.id"
        @avatar-click="openUserPopover"
    />
    <SearchBar />

    <TextArea />
    <ParticipantsList
        :length="participantsList.length"
        :online="
            participantsList.filter((member) => member.status === 'online')
                .length
        "
        :member="participantsList"
        @avatar-click="openMemberPopover"
        @avatar-contextmenu="openMemberContextMenu"
    />
    <ChatBox
        :user_id="a.id"
        @avatar-contextmenu="openMemberContextMenuFromChat"
    />

    <MemberContextMenu
        v-model:open="memberMenuOpen"
        :x="memberMenuClient.x"
        :y="memberMenuClient.y"
        :muted="selectedMemberMuted"
        @action="handleMemberMenuAction"
    />
</template>

<style scoped lang="scss"></style>
