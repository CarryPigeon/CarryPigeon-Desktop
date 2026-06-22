import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";

export function useScreenShare(sessionId: string) {
  const isSharing = ref(false);
  let originalVideoTrack: MediaStreamTrack | null = null;
  let pcRef: RTCPeerConnection | null = null;

  function setPeerConnection(pc: RTCPeerConnection) {
    pcRef = pc;
  }

  async function startScreenShare() {
    if (!pcRef) return;
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });
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
    await invoke("send_video_signaling", {
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
    await invoke("send_video_signaling", {
      sessionId,
      signalType: "screen_share_off",
      payload: {},
    });
  }

  return { isSharing, setPeerConnection, startScreenShare, stopScreenShare };
}
