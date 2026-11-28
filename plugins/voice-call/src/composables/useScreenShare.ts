import { ref } from "vue";
import { invokeVoiceCall } from "../host/bridge";

export function useScreenShare(getSessionId: () => string) {
  const isSharing = ref(false);
  let originalVideoTrack: MediaStreamTrack | null = null;
  let pcRef: RTCPeerConnection | null = null;

  function setPeerConnection(pc: RTCPeerConnection) {
    pcRef = pc;
  }

  let sharedTrack: MediaStreamTrack | undefined;
  let starting = false;

  function cleanup() {
    sharedTrack?.stop();
    sharedTrack = undefined;
    originalVideoTrack = null;
    pcRef = null;
    isSharing.value = false;
  }

  async function startScreenShare() {
    const pc = pcRef;
    const sessionId = getSessionId();
    if (!pc || !sessionId || starting || isSharing.value) return;
    starting = true;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const [displayTrack] = displayStream.getVideoTracks();
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (getSessionId() !== sessionId || pcRef !== pc || !sender || !displayTrack || pc.connectionState === "closed") {
        displayStream.getTracks().forEach((track) => track.stop());
        if (pcRef !== pc || getSessionId() !== sessionId) return;
        throw new Error("Screen sharing requires an active video sender");
      }
      originalVideoTrack = sender.track;
      sharedTrack = displayTrack;
      try {
        await sender.replaceTrack(displayTrack);
        if (pcRef !== pc || getSessionId() !== sessionId) return;
        await invokeVoiceCall("voice_call:send_video_signaling", { sessionId, signalType: "screen_share_on", payload: {} });
        if (pcRef !== pc || getSessionId() !== sessionId) return;
        isSharing.value = true;
        displayTrack.onended = () => { void stopScreenShare().catch(() => {}); };
      } catch (error) {
        displayTrack.stop();
        if (pcRef !== pc || getSessionId() !== sessionId) return;
        await sender.replaceTrack(originalVideoTrack).catch(() => {});
        sharedTrack = undefined;
        originalVideoTrack = null;
        throw error;
      }
    } finally {
      starting = false;
    }
  }

  async function stopScreenShare() {
    const sessionId = getSessionId();
    if (!pcRef || !isSharing.value) return;
    const sender = pcRef.getSenders().find((s) => s.track === sharedTrack);
    isSharing.value = false;
    try {
      if (sender) await sender.replaceTrack(originalVideoTrack);
    } finally {
      sharedTrack?.stop();
      sharedTrack = undefined;
      originalVideoTrack = null;
    }
    if (sessionId && sessionId === getSessionId()) {
      await invokeVoiceCall("voice_call:send_video_signaling", { sessionId, signalType: "screen_share_off", payload: {} });
    }
  }

  return { isSharing, setPeerConnection, startScreenShare, stopScreenShare, cleanup };
}
