import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("ScreenShare");

export function useScreenShare(sessionId: string) {
  const isSharing = ref(false);
  let originalVideoTrack: MediaStreamTrack | null = null;
  let pcRef: RTCPeerConnection | null = null;

  function setPeerConnection(pc: RTCPeerConnection) {
    pcRef = pc;
  }

  async function startScreenShare() {
    if (!pcRef) return;
    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[VOICE_CALL] Screen share failed: ${msg}`);
      return;
    }
    const [displayTrack] = displayStream.getVideoTracks();

    const sender = pcRef
      .getSenders()
      .find((s) => s.track?.kind === "video");
    if (!sender) {
      displayTrack.stop();
      return;
    }

    originalVideoTrack = sender.track;
    await sender.replaceTrack(displayTrack);

    displayTrack.onended = () => stopScreenShare();

    isSharing.value = true;
    await invoke(TAURI_COMMANDS.sendVideoSignaling, {
      sessionId,
      signalType: "screen_share_on",
      payload: {},
    });
  }

  async function stopScreenShare() {
    if (!pcRef || !isSharing.value) return;
    const sender = pcRef
      .getSenders()
      .find((s) => s.track?.kind === "video");
    if (sender && originalVideoTrack) {
      await sender.replaceTrack(originalVideoTrack);
      originalVideoTrack = null;
    }
    isSharing.value = false;
    await invoke(TAURI_COMMANDS.sendVideoSignaling, {
      sessionId,
      signalType: "screen_share_off",
      payload: {},
    });
  }

  return { isSharing, setPeerConnection, startScreenShare, stopScreenShare };
}
