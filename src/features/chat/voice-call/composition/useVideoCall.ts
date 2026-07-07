import { ref, onUnmounted } from "vue";
import { type UnlistenFn } from "@tauri-apps/api/event";
import { safeListen } from "@/shared/tauri/events";
import { invokeTauri } from "@/shared/tauri/invokeClient";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { createLogger } from "@/shared/utils/logger";

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

const logger = createLogger("VideoCall");

export function useVideoCall(initialSessionId: string) {
  const sessionId = ref(initialSessionId);
  const localStream = ref<MediaStream>();
  const remoteStream = ref<MediaStream>();
  const cameraEnabled = ref(true);
  const connected = ref(false);

  let pc: RTCPeerConnection | null = null;
  let unlisten: UnlistenFn | null = null;

  function setSessionId(sid: string) {
    sessionId.value = sid;
  }

  async function ensurePC(): Promise<RTCPeerConnection> {
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void invokeTauri(TAURI_COMMANDS.sendVideoSignaling, {
          sessionId: sessionId.value,
          signalType: "ice_candidate",
          payload: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      remoteStream.value = e.streams[0];
    };

    pc.onconnectionstatechange = () => {
      connected.value = pc?.connectionState === "connected";
    };

    return pc;
  }

  async function startCall() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      localStream.value = stream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Action: chat_voice_call_start_failed", { error: msg });
      return;
    }
    const p = await ensurePC();
    stream.getTracks().forEach((t) => p.addTrack(t, stream));

    const offer = await p.createOffer();
    await p.setLocalDescription(offer);

    await invokeTauri(TAURI_COMMANDS.sendVideoSignaling, {
      sessionId: sessionId.value,
      signalType: "offer",
      payload: {
        sdp: offer.sdp,
        type: offer.type,
        candidates: [],
      },
    });
  }

  async function acceptCall(remoteOffer: any) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      localStream.value = stream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Action: chat_voice_call_accept_failed", { error: msg });
      return;
    }
    const p = await ensurePC();
    stream.getTracks().forEach((t) => p.addTrack(t, stream));

    await p.setRemoteDescription(
      new RTCSessionDescription({ type: "offer", sdp: remoteOffer.sdp })
    );

    const answer = await p.createAnswer();
    await p.setLocalDescription(answer);

    await invokeTauri(TAURI_COMMANDS.sendVideoSignaling, {
      sessionId: sessionId.value,
      signalType: "answer",
      payload: {
        sdp: answer.sdp,
        type: answer.type,
        candidates: [],
      },
    });
  }

  async function toggleCamera() {
    if (!localStream.value) return;
    const tracks = localStream.value.getVideoTracks();
    tracks.forEach((t) => {
      t.enabled = !t.enabled;
    });
    cameraEnabled.value = tracks.some((t) => t.enabled);
    await invokeTauri(TAURI_COMMANDS.sendVideoSignaling, {
      sessionId: sessionId.value,
      signalType: "video_mute",
      payload: { muted: !cameraEnabled.value },
    });
  }

  function setupListener() {
    if (unlisten) return;
    safeListen<{
      sessionId: string;
      signalType: string;
      payload: any;
    }>("voice_call:video_signaling", async (event) => {
      if (event.payload.sessionId !== sessionId.value) return;
      if (!pc) return;

      switch (event.payload.signalType) {
        case "offer": {
          if (pc.signalingState !== "stable") break;
          await pc.setRemoteDescription(
            new RTCSessionDescription(event.payload.payload)
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await invokeTauri(TAURI_COMMANDS.sendVideoSignaling, {
            sessionId: sessionId.value,
            signalType: "answer",
            payload: { sdp: answer.sdp, type: answer.type, candidates: [] },
          });
          break;
        }
        case "answer": {
          if (pc.currentRemoteDescription) break;
          await pc.setRemoteDescription(
            new RTCSessionDescription(event.payload.payload)
          );
          break;
        }
        case "ice_candidate": {
          await pc.addIceCandidate(event.payload.payload);
          break;
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });
  }

  setupListener();

  async function hangup() {
    localStream.value?.getTracks().forEach((t) => t.stop());
    pc?.close();
    pc = null;
    unlisten?.();
    connected.value = false;
  }

  function cleanup() {
    localStream.value?.getTracks().forEach((t) => t.stop());
    pc?.close();
    unlisten?.();
  }

  onUnmounted(cleanup);

  function getPeerConnection(): RTCPeerConnection | null {
    return pc;
  }

  return {
    localStream,
    remoteStream,
    cameraEnabled,
    connected,
    startCall,
    acceptCall,
    toggleCamera,
    hangup,
    getPeerConnection,
    setSessionId,
  };
}
