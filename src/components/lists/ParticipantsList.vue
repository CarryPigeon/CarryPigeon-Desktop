<script setup lang="ts">
import { Member } from "../../value/memberValue";
import GroupMemberModel from "../items/GroupMemberModel.vue";

const props = defineProps<{
    length: number;
    online: number;
    member: Member[];
}>();

const emit = defineEmits<{
    (
        e: "avatar-click",
        payload: { screenX: number; screenY: number; member: Member },
    ): void;
    (
        e: "avatar-contextmenu",
        payload: {
            screenX: number;
            screenY: number;
            clientX: number;
            clientY: number;
            member: Member;
        },
    ): void;
}>();
</script>

<template>
    <div class="participants-list">
        <div class="participants-number">
            <p>{{ $t("participants") }} - {{ props.length }}</p>
        </div>
        <div class="list">
            <ul style="list-style-type: none; padding: 0">
                <li v-for="item in props.member" :key="item.id">
                    <GroupMemberModel
                        :avatar="item.avatarUrl"
                        :name="item.name"
                        @avatar-click="
                            (pos) =>
                                emit('avatar-click', { ...pos, member: item })
                        "
                        @avatar-contextmenu="
                            (pos) =>
                                emit('avatar-contextmenu', {
                                    ...pos,
                                    member: item,
                                })
                        "
                    />
                </li>
            </ul>
        </div>
    </div>
</template>

<style scoped lang="scss">
.list {
    position: fixed;
    display: grid;
    left: calc(100vw - 240px);
    padding: 0;
    top: 0;
    width: 240px;
    height: calc(100vh - 3px);
    opacity: 1;
    background: rgba(243, 244, 246, 1);
    border: 1px solid rgba(231, 232, 236, 1);
}

.participants-number {
    z-index: 1;
    position: fixed;
    left: calc(100vw - 240px);
    margin-left: 10px;
    top: 0;
    width: 240px;
    border: none;
    box-sizing: border-box;
    height: 50px;
    opacity: 1;
    background: rgba(243, 244, 246, 1);
    border-bottom: 1px solid rgba(227, 229, 233, 1);
}
</style>
