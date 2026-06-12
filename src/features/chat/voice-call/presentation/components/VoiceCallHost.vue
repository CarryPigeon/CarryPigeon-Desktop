<template>
  <div class="voice-call-host">
    <VoiceCallBanner
      :caller-name="callerName"
      :visible="callState === 'ringing'"
      @accept="handleAccept"
      @reject="handleReject"
    />
    <VoiceCallPanel
      :state="callState"
      :duration="duration"
      :participants="participantsWithAvatars"
      :is-muted="isMuted"
      :is-noise-suppression-on="isNoiseSuppressionOn"
      :input-devices="inputDevices"
      :current-input-device-id="currentInputDeviceId"
      :output-devices="outputDevices"
      :current-output-device-id="currentOutputDeviceId"
      :is-conference="isConference"
      @toggle-mute="toggleMute"
      @toggle-noise-suppression="toggleNoiseSuppression"
      @select-input-device="selectInputDevice"
      @select-output-device="selectOutputDevice"
      @hangup="handleHangup"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { listen } from "@tauri-apps/api/event";
import { useVoiceCall } from "../composables/useVoiceCall";
import VoiceCallBanner from "./VoiceCallBanner.vue";
import VoiceCallPanel from "./VoiceCallPanel.vue";
import { createMockVoiceCallStatePort } from "../../mock";
import { createTauriVoiceCallApi } from "../../data/tauri/tauriVoiceCallApi";
import { currentChatUserId } from "../../../composition/chatAccountSession";
import { getRoomGovernanceCapabilities } from "../../../room-governance/api";
import { IS_STORE_MOCK } from "@/shared/config/runtime";
import {
  currentState as globalCallState,
  activeSession as globalActiveSession,
} from "../../presentation/store-access/voiceCallStoreAccess";
import type { CallParticipant, CallSession, CallState } from "../../domain/contracts";

const { t } = useI18n();

const props = defineProps<{
  roomId: string;
  roomName: string;
  targetUserId?: string;
}>();

const emit = defineEmits<{
  (e: "stateChange", state: CallState): void;
}>();

const isMock = IS_STORE_MOCK;
const statePort = isMock
  ? createMockVoiceCallStatePort()
  : createTauriVoiceCallApi();

const {
  callState,
  activeSession,
  participants,
  duration,
  isMuted,
  isNoiseSuppressionOn,
  inputDevices,
  outputDevices,
  startDirectCall,
  startConference,
  acceptCall,
  rejectCall,
  hangup,
  cancelCall,
  toggleMute,
  toggleNoiseSuppression,
  selectInputDevice,
  selectOutputDevice,
  initDevices,
  joinConference,
  leaveConference,
  beginListening,
  onIncomingCall,
  syncState,
} = useVoiceCall({
  statePort,
  roomId: () => props.roomId,
  userId: () => currentChatUserId.value,
});

const isConference = computed(() => activeSession.value?.kind === "conference");

const callerName = computed(() => {
  const session = activeSession.value;
  if (!session) return "";
  const selfId = currentChatUserId.value;
  return session.participants.find((p: CallParticipant) => p.userId !== selfId)?.displayName ?? t("voice_call_unknown_user");
});

const currentInputDeviceId = computed(() => {
  return activeSession.value?.mediaSettings.inputDeviceId ?? null;
});

const currentOutputDeviceId = computed(() => {
  return activeSession.value?.mediaSettings.outputDeviceId ?? null;
});

function handleAccept() {
  acceptCall();
}

function handleReject() {
  rejectCall("declined");
}

function handleHangup() {
  if (callState.value === "dialing") {
    cancelCall();
  } else if (isConference.value) {
    void leaveConference();
  } else {
    hangup();
  }
}

const memberAvatarMap = ref<Map<string, string>>(new Map());

watch(callState, (s, prev) => {
  if (s !== prev) emit("stateChange", s);
});

watch(callState, async (s) => {
  if (s === "active" || s === "connecting") {
    try {
      const governance = getRoomGovernanceCapabilities();
      const channelGov = governance.forChannel(props.roomId);
      const members = await channelGov.listMembers();
      const map = new Map<string, string>();
      for (const m of members) {
        if (m.avatar) map.set(m.uid, m.avatar);
      }
      memberAvatarMap.value = map;
    } catch {
      // 成员列表拉取失败时忽略，回退到 AvatarBadge 首字母。
    }
  }
});

const participantsWithAvatars = computed(() => {
  const avatars = memberAvatarMap.value;
  if (avatars.size === 0) return participants.value;
  return participants.value.map((p) => {
    const avatarUrl = avatars.get(p.userId);
    return avatarUrl ? { ...p, avatarUrl } : p;
  });
});

onMounted(() => {
  initDevices();
  beginListening();
  // 信令连接已由 assembleChatStoreRuntime 统一管理，此处不再重复连接。
});

// 监听 Rust 后端发射的 voice_call:incoming Tauri 事件
let unlistenIncoming: (() => void) | null = null;
let unlistenStateChange: (() => void) | null = null;

onMounted(async () => {
  if (isMock) return;
  try {
    unlistenIncoming = await listen<{
      session_id: string;
      call_kind: string;
      from_user_id: string;
      from_display_name: string;
      room_id: string;
      timestamp: number;
    }>("voice_call:incoming", (event) => {
      const w = event.payload;
      const session: CallSession = {
        sessionId: w.session_id,
        kind: (w.call_kind as CallSession["kind"]) || "direct",
        state: "ringing",
        initiator: w.from_user_id,
        participants: [],
        roomId: w.room_id,
        startedAt: w.timestamp,
        endedAt: null,
        mediaSettings: {
          inputDeviceId: null,
          outputDeviceId: null,
          noiseSuppression: false,
          echoCancellation: false,
        },
      };
      onIncomingCall(session);
    });
  } catch {
    // Tauri event listen 在非 Tauri 环境会失败，忽略。
  }

  try {
    unlistenStateChange = await listen<{
      session_id: string;
      new_state: string;
      reason?: string;
    }>("voice_call:state_change", (event) => {
      const s = event.payload;
      const session = activeSession.value;
      if (session && session.sessionId === s.session_id) {
        syncState(s.new_state as CallState, {
          ...session,
          state: s.new_state as CallSession["state"],
        });
      }
    });
  } catch {
    // 同上，非 Tauri 环境忽略。
  }
});

// 监听全局 voiceCallStoreAccess 状态（WS 事件路由更新此状态）
// 使用 getter 形式而非数组 ref 形式，避免对 CallSession 对象进行深度比较
watch(
  () => globalCallState.value,
  (gState) => {
    if (!gState || gState === "idle") return;
    const gSession = globalActiveSession.value;
    if (gState !== callState.value && gSession) {
      syncState(gState, gSession);
    }
  },
);

onUnmounted(() => {
  unlistenIncoming?.();
  unlistenStateChange?.();
});

function startCall(targetUserId?: string) {
  const uid = targetUserId || props.targetUserId || "";
  return startDirectCall(uid);
}

defineExpose({
  callState,
  startDirectCall: startCall,
  startConference,
  joinConference,
  leaveConference,
});
</script>
