import { ref, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export function useVideoCall(sessionId: string) {
  const localStream = ref<MediaStream>();
  const remoteStream = ref<MediaStream>();
  const cameraEnabled = ref(true);
  const connected = ref(false);

  let pc: RTCPeerConnection | null = null;
  let unlisten: UnlistenFn | null = null;

  async function ensurePC(): Promise<RTCPeerConnection> {
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        invoke("send_video_signaling", {
          sessionId,
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
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    localStream.value = stream;
    const p = await ensurePC();
    stream.getTracks().forEach((t) => p.addTrack(t, stream));

    const offer = await p.createOffer();
    await p.setLocalDescription(offer);

    await invoke("send_video_signaling", {
      sessionId,
      signalType: "offer",
      payload: {
        sdp: offer.sdp,
        type: offer.type,
        candidates: [],
      },
    });

    setupListener();
  }

  async function acceptCall(remoteOffer: any) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    localStream.value = stream;
    const p = await ensurePC();
    stream.getTracks().forEach((t) => p.addTrack(t, stream));

    await p.setRemoteDescription(
      new RTCSessionDescription({ type: "offer", sdp: remoteOffer.sdp })
    );

    const answer = await p.createAnswer();
    await p.setLocalDescription(answer);

    await invoke("send_video_signaling", {
      sessionId,
      signalType: "answer",
      payload: {
        sdp: answer.sdp,
        type: answer.type,
        candidates: [],
      },
    });

    setupListener();
  }

  async function toggleCamera() {
    if (!localStream.value) return;
    const tracks = localStream.value.getVideoTracks();
    tracks.forEach((t) => {
      t.enabled = !t.enabled;
    });
    cameraEnabled.value = tracks.some((t) => t.enabled);
    await invoke("send_video_signaling", {
      sessionId,
      signalType: "video_mute",
      payload: { muted: !cameraEnabled.value },
    });
  }

  function setupListener() {
    listen<{
      sessionId: string;
      signalType: string;
      payload: any;
    }>("voice_call:video_signaling", async (event) => {
      if (event.payload.sessionId !== sessionId) return;
      if (!pc) return;

      switch (event.payload.signalType) {
        case "offer": {
          await pc.setRemoteDescription(
            new RTCSessionDescription(event.payload.payload)
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await invoke("send_video_signaling", {
            sessionId,
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

  return {
    localStream,
    remoteStream,
    cameraEnabled,
    connected,
    startCall,
    acceptCall,
    toggleCamera,
    hangup,
  };
}
