# Voice Call / Conference Design

> Status: approved | 2026-05-15

## 1. Background & Scope

Add voice call and conference to CarryPigeon-Desktop, allowing 1v1 calls and multi-party conferences from chat.

**MVP scope:** 1v1 voice call, multi-party conference (SFU), incoming call banner, mute/speaker/noise-suppression controls, call record bubble.

**Out of scope:** Video call, screen share, recording, transcription, mobile.

## 2. Architecture

Voice call lives as `chat/voice-call/` subdomain, peer to `message-flow` and `room-session`. Three-layer split:

- **Frontend (Vue 3):** Components (Banner, Panel, Button, CallRecordBubble), composables (useVoiceCall), state management
- **Backend (Rust):** Tauri commands (start/accept/reject/hangup/mute/toggle), cpal audio pipeline, webrtc-rs engine, LiveKit SFU client
- **Signaling:** Chat TCP for business events (invite/accept/hangup), dedicated WebSocket for SDP/ICE, WebRTC P2P for audio

## 3. Key Conventions

- Call state machine: `idle -> dialing/ringing -> connecting -> active -> ended`
- File structure matches existing subdomain pattern: `api-types/api/capability-source/domain/presentation`
- Rust follows feature convention: `domain/data/di/mock`
- Errors use `VOICE_CALL_*` prefixed codes

## 4. Implementation Phases

| Phase | Scope |
|-------|-------|
| P1 | Skeleton + capal audio device enumeration + mock |
| P2 | 1v1 call: WebRTC peer connection, SDP/ICE signaling, audio pipeline (PCM -> Opus -> WebRTC) |
| P3 | Controls: mute, noise suppression, device hot-swap, call record bubble |
| P4 | Multi-party conference: LiveKit SFU integration, participant management, VAD |
| P5 | Integration: chat header button, event routing, multi-window sync |

## 5. Key Dependencies

- Signaling WS relay (SDP/ICE forwarding)
- SFU server (LiveKit) for conferences with 3+ participants
- Chat TCP channel supporting `call:*` events
- Cargo deps: `webrtc`, `cpal`, `opus`, `tokio-tungstenite`

## 6. Changelog

- 2026-05-15: Initial design approved
