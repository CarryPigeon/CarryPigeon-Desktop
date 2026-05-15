import type { CallState, CallParticipant, CallSession } from "../contracts";

export type VoiceCallEventRouterDeps = {
  setIncomingCall: (session: CallSession) => void;
  updateCallState: (sessionId: string, state: CallState) => void;
  updateParticipants: (sessionId: string, participants: CallParticipant[]) => void;
  setCallSummary: (sessionId: string, duration: number, reason: string) => void;
};

export function createVoiceCallEventRouter(deps: VoiceCallEventRouterDeps) {
  return function routeVoiceCallEvent(eventType: string, payload: Record<string, unknown> | null): boolean {
    if (!eventType.startsWith("call:")) return false;

    switch (eventType) {
      case "call:invite": {
        if (!payload) return true;
        const session: CallSession = {
          sessionId: String(payload.sessionId ?? ""),
          kind: String(payload.callKind ?? "direct") as "direct" | "conference",
          state: "ringing",
          initiator: String((payload.from as Record<string, unknown> | undefined)?.userId ?? ""),
          participants: (payload.invitees as CallParticipant[] | undefined) ?? [],
          roomId: String(payload.roomId ?? ""),
          startedAt: null,
          endedAt: null,
          mediaSettings: {
            inputDeviceId: null,
            outputDeviceId: null,
            noiseSuppression: true,
            echoCancellation: true,
          },
        };
        deps.setIncomingCall(session);
        return true;
      }

      case "call:answer": {
        if (!payload) return true;
        const accepted = Boolean(payload.accepted);
        deps.updateCallState(
          String(payload.sessionId ?? ""),
          accepted ? "connecting" : "ended"
        );
        return true;
      }

      case "call:cancel":
      case "call:hangup": {
        if (!payload) return true;
        deps.updateCallState(String(payload.sessionId ?? ""), "ended");
        const duration = Number(payload.duration) || 0;
        const reason = eventType === "call:cancel" ? "cancelled" : "manual";
        deps.setCallSummary(String(payload.sessionId ?? ""), duration, reason);
        return true;
      }

      case "call:participant_update": {
        if (!payload) return true;
        deps.updateParticipants(
          String(payload.sessionId ?? ""),
          (payload.participants as CallParticipant[] | undefined) ?? []
        );
        return true;
      }

      case "call:mute_toggle": {
        return true;
      }

      default:
        return false;
    }
  };
}
