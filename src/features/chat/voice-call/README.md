# voice-call

语音通话/语音会议子域，支持 1v1 P2P 通话和多人 SFU 语音会议。

## 子域边界

- 核心职责: 管理通话生命周期（发起/接听/挂断）、音频设备选择、通话 UI。
- 依赖: room-session（当前房间上下文）、message-flow（事件路由）。
- 提供: VoiceCallCapabilities 给 Chat 公开 API。
