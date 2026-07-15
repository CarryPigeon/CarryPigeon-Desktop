import { Fragment, Icon, Transition, computed, createBlock, createCommentVNode, createElementBlock, createElementVNode, createTextVNode, createVNode, defineComponent, normalizeClass, normalizeStyle, onMounted, onScopeDispose, onUnmounted, openBlock, readonly, ref, renderList, toDisplayString, unref, watch, withCtx, withModifiers } from "/vendor/vendor.mjs";
var manifest_default = {
	pluginId: "voice-call",
	version: "0.1.0",
	entry: "index.js",
	permissions: [
		"invoke",
		"events",
		"ui",
		"storage"
	],
	providesDomains: ["call_record"]
};
//#endregion
//#region plugins/voice-call/src/manifest.ts
var voiceCallManifest = manifest_default;
manifest_default.pluginId;
manifest_default.version;
//#endregion
//#region plugins/voice-call/src/host/bridge.ts
var ctx = null;
function bindContext(c) {
	ctx = c;
}
function getContext() {
	if (!ctx) throw new Error("voice-call plugin context not bound");
	return ctx;
}
/** 调宿主原生 voice_call 后端命令（host.invoke 已按 voice_call:* 白名单校验）。 */
function invokeVoiceCall(command, args) {
	if (!ctx?.host.invoke) throw new Error("host.invoke not available");
	return ctx.host.invoke(command, args);
}
/** 订阅 voice_call:* 后端事件。 */
function onVoiceCallEvent(event, handler) {
	if (!ctx?.host.onEvent) throw new Error("host.onEvent not available");
	return ctx.host.onEvent(event, handler);
}
//#endregion
//#region plugins/voice-call/src/i18n/messages.ts
var voiceCallMessages = {
	zh_cn: {
		"voice_call": "语音通话",
		"voice_call_start": "发起语音通话",
		"voice_call_conference": "发起多人会议",
		"voice_call_dialing": "正在拨号...",
		"voice_call_connecting": "正在连接...",
		"voice_call_in_call": "通话中",
		"voice_call_participants": "{count} 人",
		"voice_call_participants_title": "参与者",
		"voice_call_hangup": "挂断",
		"voice_call_cancel": "取消",
		"voice_call_mute": "静音",
		"voice_call_unmute": "取消静音",
		"voice_call_noise_off": "关闭降噪",
		"voice_call_noise_on": "开启降噪",
		"voice_call_answer": "接听",
		"voice_call_reject": "拒接",
		"voice_call_caller_invite": "{name} 邀请你语音通话",
		"voice_call_ring_countdown": "响铃中 · 剩余 {secs} 秒",
		"voice_call_initiator": "发起人",
		"voice_call_duration": "时长",
		"voice_call_status": "状态",
		"voice_call_callback": "回拨",
		"voice_call_duration_format": "{min} 分 {sec} 秒",
		"voice_call_duration_seconds": "{sec} 秒",
		"voice_call_status_missed": "未接听",
		"voice_call_status_declined": "已拒绝",
		"voice_call_status_cancelled": "已取消",
		"voice_call_status_ended": "已结束",
		"voice_call_unknown_user": "未知用户",
		"voice_call_default_device": "默认设备",
		"voice_call_input_device": "输入设备",
		"voice_call_output_device": "输出设备",
		"video_call": "视频通话",
		"voice_call_camera_on": "开启摄像头",
		"voice_call_camera_off": "关闭摄像头",
		"voice_call_screen_share_start": "共享屏幕",
		"voice_call_screen_share_stop": "停止共享",
		"voiceCall.start": "发起通话"
	},
	en_us: {
		"voice_call": "Voice Call",
		"voice_call_start": "Start Voice Call",
		"voice_call_conference": "Start Conference",
		"voice_call_dialing": "Dialing...",
		"voice_call_connecting": "Connecting...",
		"voice_call_in_call": "In Call",
		"voice_call_participants": "{count} participants",
		"voice_call_participants_title": "Participants",
		"voice_call_hangup": "Hang Up",
		"voice_call_cancel": "Cancel",
		"voice_call_mute": "Mute",
		"voice_call_unmute": "Unmute",
		"voice_call_noise_off": "Disable Noise Suppression",
		"voice_call_noise_on": "Enable Noise Suppression",
		"voice_call_answer": "Accept",
		"voice_call_reject": "Reject",
		"voice_call_caller_invite": "{name} invites you to a voice call",
		"voice_call_ring_countdown": "Ringing · {secs}s",
		"voice_call_initiator": "Initiator",
		"voice_call_duration": "Duration",
		"voice_call_status": "Status",
		"voice_call_callback": "Call Back",
		"voice_call_duration_format": "{min}m {sec}s",
		"voice_call_duration_seconds": "{sec}s",
		"voice_call_status_missed": "Missed",
		"voice_call_status_declined": "Declined",
		"voice_call_status_cancelled": "Cancelled",
		"voice_call_status_ended": "Ended",
		"voice_call_unknown_user": "Unknown User",
		"voice_call_default_device": "Default Device",
		"voice_call_input_device": "Input device",
		"voice_call_output_device": "Output device",
		"video_call": "Video Call",
		"voice_call_camera_on": "Camera On",
		"voice_call_camera_off": "Camera Off",
		"voice_call_screen_share_start": "Share Screen",
		"voice_call_screen_share_stop": "Stop Sharing",
		"voiceCall.start": "Start Call"
	}
};
//#endregion
//#region plugins/voice-call/src/shared/logger.ts
function createLogger(name) {
	const prefix = `[voice-call:${name}]`;
	return {
		debug: (message, payload) => console.debug(prefix, message, payload ?? ""),
		info: (message, payload) => console.info(prefix, message, payload ?? ""),
		warn: (message, payload) => console.warn(prefix, message, payload ?? ""),
		error: (message, payload) => console.error(prefix, message, payload ?? "")
	};
}
//#endregion
//#region plugins/voice-call/src/composables/useRingtone.ts
/**
* @fileoverview useRingtone.ts
* @description 语音通话来电/拨号铃声：使用 WebAudio 合成短促「铃—铃—铃」循环，
*              避免依赖外部音频资源。如需替换为自定义音频，调用 `setAudioElement`。
*/
var DEFAULT_PATTERN_MS = [
	0,
	600,
	800,
	1400
];
function useRingtone() {
	const playing = ref(false);
	let audioCtx = null;
	let schedulerTimer = null;
	let audioEl = null;
	let cycleStart = 0;
	let gainNode = null;
	function ensureContext() {
		if (typeof window === "undefined") return null;
		if (audioCtx) return audioCtx;
		const Ctor = window.AudioContext ?? window.webkitAudioContext;
		if (!Ctor) return null;
		try {
			audioCtx = new Ctor();
			gainNode = audioCtx.createGain();
			gainNode.gain.value = .18;
			gainNode.connect(audioCtx.destination);
		} catch {
			audioCtx = null;
			gainNode = null;
		}
		return audioCtx;
	}
	function beep(durationMs) {
		const ctx = audioCtx;
		if (!ctx || !gainNode) return;
		const osc = ctx.createOscillator();
		const env = ctx.createGain();
		osc.type = "sine";
		osc.frequency.value = 660;
		osc.connect(env);
		env.connect(gainNode);
		const now = ctx.currentTime;
		env.gain.setValueAtTime(0, now);
		env.gain.linearRampToValueAtTime(1, now + .02);
		env.gain.linearRampToValueAtTime(1, now + durationMs / 1e3 - .04);
		env.gain.linearRampToValueAtTime(0, now + durationMs / 1e3);
		osc.start(now);
		osc.stop(now + durationMs / 1e3 + .02);
	}
	function scheduleNextCycle(now) {
		if (!audioCtx || !playing.value) return;
		const elapsed = now - cycleStart;
		const delayMs = (DEFAULT_PATTERN_MS.find((ms) => ms > elapsed) ?? DEFAULT_PATTERN_MS[0] + 2e3) - elapsed;
		schedulerTimer = setTimeout(() => {
			const stamp = Date.now();
			beep(280);
			if (elapsed >= 2e3) cycleStart = stamp;
			scheduleNextCycle(stamp);
		}, Math.max(delayMs, 60));
	}
	function playAudioElement() {
		if (!audioEl) return;
		audioEl.currentTime = 0;
		const p = audioEl.play();
		if (p && typeof p.then === "function") p.catch(() => {});
	}
	function startElementLoop() {
		if (!audioEl) return;
		if (schedulerTimer) clearTimeout(schedulerTimer);
		cycleStart = Date.now();
		playAudioElement();
		schedulerTimer = setInterval(() => {
			if (!playing.value || !audioEl) return;
			playAudioElement();
		}, 2400);
	}
	function play() {
		if (playing.value) return;
		playing.value = true;
		if (audioEl) {
			startElementLoop();
			return;
		}
		const ctx = ensureContext();
		if (!ctx) return;
		if (ctx.state === "suspended") ctx.resume().catch(() => {});
		cycleStart = Date.now();
		beep(280);
		scheduleNextCycle(cycleStart);
	}
	function stop() {
		if (!playing.value) {
			if (schedulerTimer) {
				clearTimeout(schedulerTimer);
				schedulerTimer = null;
			}
			return;
		}
		playing.value = false;
		if (schedulerTimer) {
			clearTimeout(schedulerTimer);
			schedulerTimer = null;
		}
		if (audioEl) {
			audioEl.pause();
			audioEl.currentTime = 0;
		}
	}
	function setAudioElement(el) {
		const wasPlaying = playing.value;
		if (wasPlaying) stop();
		audioEl = el;
		if (el) el.loop = true;
		if (wasPlaying) play();
	}
	onScopeDispose(() => {
		stop();
		if (audioCtx) {
			audioCtx.close().catch(() => {});
			audioCtx = null;
		}
	});
	return {
		play,
		stop,
		isPlaying: () => playing.value,
		setAudioElement
	};
}
//#endregion
//#region plugins/voice-call/src/composables/useVoiceCall.ts
function useVoiceCall(options) {
	const { statePort, roomId, userId } = options;
	const callState = ref("idle");
	const activeSession = ref(null);
	const participants = ref([]);
	const inputDevices = ref([]);
	const outputDevices = ref([]);
	const activeSummary = ref(null);
	const duration = ref(0);
	const isMuted = ref(false);
	const isNoiseSuppressionOn = ref(true);
	const ringtone = useRingtone();
	const ringStartedAt = ref(0);
	const ringTimeoutMs = 6e4;
	const ringRemainingSecs = ref(ringTimeoutMs / 1e3);
	let ringCountdownTimer = null;
	function startRingCountdown() {
		if (ringCountdownTimer) return;
		ringStartedAt.value = Date.now();
		ringRemainingSecs.value = ringTimeoutMs / 1e3;
		ringCountdownTimer = setInterval(() => {
			const elapsed = Date.now() - ringStartedAt.value;
			const remaining = Math.max(0, Math.ceil((ringTimeoutMs - elapsed) / 1e3));
			ringRemainingSecs.value = remaining;
			if (remaining <= 0 && ringCountdownTimer) {
				clearInterval(ringCountdownTimer);
				ringCountdownTimer = null;
			}
		}, 500);
	}
	function stopRingCountdown() {
		if (ringCountdownTimer) {
			clearInterval(ringCountdownTimer);
			ringCountdownTimer = null;
		}
		ringRemainingSecs.value = ringTimeoutMs / 1e3;
		ringStartedAt.value = 0;
	}
	let timerHandle = null;
	let pollHandle = null;
	function startTimer() {
		timerHandle = setInterval(() => {
			duration.value += 1e3;
		}, 1e3);
	}
	function stopTimer() {
		if (timerHandle) {
			clearInterval(timerHandle);
			timerHandle = null;
		}
	}
	function startPoll() {
		if (pollHandle) return;
		pollHandle = setInterval(() => {
			const session = statePort.getActiveSession();
			if (session) {
				callState.value = session.state;
				activeSession.value = session;
				participants.value = session.participants;
			}
		}, 500);
	}
	function stopPoll() {
		if (pollHandle) {
			clearInterval(pollHandle);
			pollHandle = null;
		}
	}
	function beginListening() {
		startPoll();
	}
	/** 处理来电：外部事件驱动更新本地状态 */
	function onIncomingCall(session) {
		callState.value = "ringing";
		activeSession.value = session;
		participants.value = session.participants;
		startPoll();
		ringtone.play();
		startRingCountdown();
	}
	/** 外部状态变更同步（被动更新本地状态） */
	function syncState(state, session) {
		if (state === "ringing" && session) onIncomingCall(session);
		else if (state === "ended" && session) {
			callState.value = "ended";
			activeSession.value = session;
			stopTimer();
			stopPoll();
			ringtone.stop();
			stopRingCountdown();
			activeSummary.value = {
				sessionId: session.sessionId,
				kind: session.kind,
				duration: duration.value,
				disconnectReason: "remotely_ended"
			};
			setTimeout(() => {
				callState.value = "idle";
				activeSession.value = null;
			}, 500);
		} else if (session) {
			callState.value = state;
			activeSession.value = session;
			participants.value = session.participants;
			isMuted.value = session.participants.find((p) => p.userId === userId())?.isMuted ?? false;
			if (state === "active" || state === "idle" || state === "connecting") {
				ringtone.stop();
				stopRingCountdown();
			}
		}
	}
	async function startDirectCall(targetUserId) {
		callState.value = "dialing";
		const session = await statePort.startCall("direct", roomId(), targetUserId);
		activeSession.value = session;
		startPoll();
		ringtone.play();
		startRingCountdown();
		return session;
	}
	async function startConference() {
		callState.value = "dialing";
		const session = await statePort.startCall("conference", roomId());
		activeSession.value = session;
		startPoll();
		ringtone.play();
		startRingCountdown();
		return session;
	}
	async function acceptCall() {
		const session = activeSession.value;
		if (!session) return;
		callState.value = "connecting";
		await statePort.acceptCall(session.sessionId);
		startPoll();
		ringtone.stop();
		stopRingCountdown();
	}
	async function rejectCall(reason) {
		const session = activeSession.value;
		if (!session) return;
		callState.value = "ended";
		await statePort.rejectCall(session.sessionId, reason);
		stopTimer();
		stopPoll();
		ringtone.stop();
		stopRingCountdown();
		activeSummary.value = {
			sessionId: session.sessionId,
			kind: session.kind,
			duration: duration.value,
			disconnectReason: reason ?? "declined"
		};
		setTimeout(() => {
			callState.value = "idle";
			activeSession.value = null;
		}, 500);
	}
	async function hangup() {
		await rejectCall("manual");
	}
	async function cancelCall() {
		const session = activeSession.value;
		if (!session) return;
		callState.value = "ended";
		await statePort.cancelCall(session.sessionId);
		stopTimer();
		stopPoll();
		ringtone.stop();
		stopRingCountdown();
		activeSummary.value = {
			sessionId: session.sessionId,
			kind: session.kind,
			duration: duration.value,
			disconnectReason: "cancelled"
		};
		setTimeout(() => {
			callState.value = "idle";
			activeSession.value = null;
		}, 500);
	}
	async function toggleMute() {
		const session = activeSession.value;
		if (!session) return false;
		const muted = await statePort.toggleMute(session.sessionId);
		isMuted.value = muted;
		if (activeSession.value) activeSession.value = {
			...activeSession.value,
			participants: activeSession.value.participants.map((p) => p.userId === userId() ? {
				...p,
				isMuted: muted
			} : p)
		};
		return muted;
	}
	async function toggleNoiseSuppression() {
		const session = activeSession.value;
		if (!session) return false;
		const ns = await statePort.toggleNoiseSuppression(session.sessionId);
		isNoiseSuppressionOn.value = ns;
		if (activeSession.value) activeSession.value = {
			...activeSession.value,
			mediaSettings: {
				...activeSession.value.mediaSettings,
				noiseSuppression: ns
			}
		};
		return ns;
	}
	async function selectInputDevice(deviceId) {
		const sessionId = activeSession.value?.sessionId;
		if (!sessionId) return;
		await statePort.updateMediaSettings(sessionId, { inputDeviceId: deviceId });
		if (activeSession.value) activeSession.value = {
			...activeSession.value,
			mediaSettings: {
				...activeSession.value.mediaSettings,
				inputDeviceId: deviceId
			}
		};
	}
	async function selectOutputDevice(deviceId) {
		const sessionId = activeSession.value?.sessionId;
		if (!sessionId) return;
		await statePort.updateMediaSettings(sessionId, { outputDeviceId: deviceId });
		if (activeSession.value) activeSession.value = {
			...activeSession.value,
			mediaSettings: {
				...activeSession.value.mediaSettings,
				outputDeviceId: deviceId
			}
		};
	}
	async function connectSignaling(wsUrl, accessToken, userId, displayName) {
		await statePort.connectSignaling(wsUrl, accessToken, userId, displayName);
	}
	async function initDevices() {
		try {
			const devices = await statePort.enumerateDevices();
			inputDevices.value = devices.input;
			outputDevices.value = devices.output;
			const defaultInput = devices.input.find((d) => d.isDefault);
			if (defaultInput) await statePort.updateMediaSettings("", { inputDeviceId: defaultInput.deviceId });
			const defaultOutput = devices.output.find((d) => d.isDefault);
			if (defaultOutput) await statePort.updateMediaSettings("", { outputDeviceId: defaultOutput.deviceId });
		} catch (_e) {}
	}
	/**
	* 重新枚举音频设备并检测变化。
	* 当设备列表发生变化时（如热插拔 USB 设备），自动更新状态。
	* @returns 设备列表是否发生了变化。
	*/
	async function refreshDevices() {
		try {
			const devices = await statePort.enumerateDevices();
			const prevInputIds = inputDevices.value.map((d) => d.deviceId).sort().join(",");
			const prevOutputIds = outputDevices.value.map((d) => d.deviceId).sort().join(",");
			const newInputIds = devices.input.map((d) => d.deviceId).sort().join(",");
			const newOutputIds = devices.output.map((d) => d.deviceId).sort().join(",");
			const changed = prevInputIds !== newInputIds || prevOutputIds !== newOutputIds;
			if (changed) {
				inputDevices.value = devices.input;
				outputDevices.value = devices.output;
			}
			return changed;
		} catch {
			return false;
		}
	}
	async function joinConference(sessionId, initiatorId) {
		if (!statePort.joinConference) return;
		const session = await statePort.joinConference(sessionId, initiatorId);
		callState.value = session.state;
		activeSession.value = session;
		startPoll();
		ringtone.stop();
		stopRingCountdown();
		return session;
	}
	async function leaveConference() {
		const session = activeSession.value;
		if (!session || !statePort.leaveConference) return;
		callState.value = "ended";
		await statePort.leaveConference(session.sessionId);
		stopTimer();
		stopPoll();
		ringtone.stop();
		stopRingCountdown();
		activeSummary.value = {
			sessionId: session.sessionId,
			kind: session.kind,
			duration: duration.value,
			disconnectReason: "left"
		};
		setTimeout(() => {
			callState.value = "idle";
			activeSession.value = null;
		}, 500);
	}
	const isConferenceHost = computed(() => activeSession.value?.kind === "conference" && activeSession.value?.initiator !== "");
	watch(callState, (newVal) => {
		if (newVal === "active") {
			duration.value = 0;
			startTimer();
		}
		if (newVal === "ended") stopTimer();
	});
	onUnmounted(() => {
		stopTimer();
		stopPoll();
		stopRingCountdown();
		ringtone.stop();
	});
	return {
		callState: readonly(callState),
		activeSession: readonly(activeSession),
		participants: readonly(participants),
		duration: readonly(duration),
		isMuted: readonly(isMuted),
		isNoiseSuppressionOn: readonly(isNoiseSuppressionOn),
		inputDevices: readonly(inputDevices),
		outputDevices: readonly(outputDevices),
		activeSummary: readonly(activeSummary),
		ringRemainingSecs: readonly(ringRemainingSecs),
		ringTimeoutMs,
		connectSignaling,
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
		refreshDevices,
		joinConference,
		leaveConference,
		beginListening,
		isConferenceHost,
		onIncomingCall,
		syncState,
		setRingtoneAudio: ringtone.setAudioElement
	};
}
//#endregion
//#region plugins/voice-call/src/composables/useVideoCall.ts
var STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
var logger$1 = createLogger("VideoCall");
function useVideoCall(initialSessionId) {
	const sessionId = ref(initialSessionId);
	const localStream = ref();
	const remoteStream = ref();
	const cameraEnabled = ref(true);
	const connected = ref(false);
	let pc = null;
	let unlisten = null;
	function setSessionId(sid) {
		sessionId.value = sid;
	}
	async function ensurePC() {
		if (pc) return pc;
		pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
		pc.onicecandidate = (e) => {
			if (e.candidate) invokeVoiceCall("voice_call:send_video_signaling", {
				sessionId: sessionId.value,
				signalType: "ice_candidate",
				payload: e.candidate.toJSON()
			});
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
		let stream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: false
			});
			localStream.value = stream;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger$1.error("Action: chat_voice_call_start_failed", { error: msg });
			return;
		}
		const p = await ensurePC();
		stream.getTracks().forEach((t) => p.addTrack(t, stream));
		const offer = await p.createOffer();
		await p.setLocalDescription(offer);
		await invokeVoiceCall("voice_call:send_video_signaling", {
			sessionId: sessionId.value,
			signalType: "offer",
			payload: {
				sdp: offer.sdp,
				type: offer.type,
				candidates: []
			}
		});
	}
	async function acceptCall(remoteOffer) {
		let stream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: false
			});
			localStream.value = stream;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger$1.error("Action: chat_voice_call_accept_failed", { error: msg });
			return;
		}
		const p = await ensurePC();
		stream.getTracks().forEach((t) => p.addTrack(t, stream));
		await p.setRemoteDescription(new RTCSessionDescription({
			type: "offer",
			sdp: remoteOffer.sdp
		}));
		const answer = await p.createAnswer();
		await p.setLocalDescription(answer);
		await invokeVoiceCall("voice_call:send_video_signaling", {
			sessionId: sessionId.value,
			signalType: "answer",
			payload: {
				sdp: answer.sdp,
				type: answer.type,
				candidates: []
			}
		});
	}
	async function toggleCamera() {
		if (!localStream.value) return;
		const tracks = localStream.value.getVideoTracks();
		tracks.forEach((t) => {
			t.enabled = !t.enabled;
		});
		cameraEnabled.value = tracks.some((t) => t.enabled);
		await invokeVoiceCall("voice_call:send_video_signaling", {
			sessionId: sessionId.value,
			signalType: "video_mute",
			payload: { muted: !cameraEnabled.value }
		});
	}
	function setupListener() {
		if (unlisten) return;
		unlisten = onVoiceCallEvent("voice_call:video_signaling", async (event) => {
			if (event.sessionId !== sessionId.value) return;
			if (!pc) return;
			switch (event.signalType) {
				case "offer": {
					if (pc.signalingState !== "stable") break;
					await pc.setRemoteDescription(new RTCSessionDescription(event.payload));
					const answer = await pc.createAnswer();
					await pc.setLocalDescription(answer);
					await invokeVoiceCall("voice_call:send_video_signaling", {
						sessionId: sessionId.value,
						signalType: "answer",
						payload: {
							sdp: answer.sdp,
							type: answer.type,
							candidates: []
						}
					});
					break;
				}
				case "answer":
					if (pc.currentRemoteDescription) break;
					await pc.setRemoteDescription(new RTCSessionDescription(event.payload));
					break;
				case "ice_candidate":
					await pc.addIceCandidate(event.payload);
					break;
			}
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
	function getPeerConnection() {
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
		setSessionId
	};
}
//#endregion
//#region plugins/voice-call/src/composables/useScreenShare.ts
var logger = createLogger("ScreenShare");
function useScreenShare(sessionId) {
	const isSharing = ref(false);
	let originalVideoTrack = null;
	let pcRef = null;
	function setPeerConnection(pc) {
		pcRef = pc;
	}
	async function startScreenShare() {
		if (!pcRef) return;
		let displayStream;
		try {
			displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Action: chat_voice_call_screen_share_failed", { error: msg });
			return;
		}
		const [displayTrack] = displayStream.getVideoTracks();
		const sender = pcRef.getSenders().find((s) => s.track?.kind === "video");
		if (!sender) {
			displayTrack.stop();
			return;
		}
		originalVideoTrack = sender.track;
		await sender.replaceTrack(displayTrack);
		displayTrack.onended = () => stopScreenShare();
		isSharing.value = true;
		await invokeVoiceCall("voice_call:send_video_signaling", {
			sessionId,
			signalType: "screen_share_on",
			payload: {}
		});
	}
	async function stopScreenShare() {
		if (!pcRef || !isSharing.value) return;
		const sender = pcRef.getSenders().find((s) => s.track?.kind === "video");
		if (sender && originalVideoTrack) {
			await sender.replaceTrack(originalVideoTrack);
			originalVideoTrack = null;
		}
		isSharing.value = false;
		await invokeVoiceCall("voice_call:send_video_signaling", {
			sessionId,
			signalType: "screen_share_off",
			payload: {}
		});
	}
	return {
		isSharing,
		setPeerConnection,
		startScreenShare,
		stopScreenShare
	};
}
//#endregion
//#region plugins/voice-call/src/i18n/index.ts
/**
* 轻量 i18n 读取：根据已绑定宿主上下文的 lang 取对应字典。
* 支持 {name} 形式的具名插值（与 vue-i18n 调用方式保持一致）。
*/
function t$1(key, params) {
	let lang = "zh_cn";
	try {
		lang = getContext().lang || "zh_cn";
	} catch {}
	const messages = voiceCallMessages;
	let str = (messages[lang] ?? messages.zh_cn)[key] ?? key;
	if (params) for (const [k, v] of Object.entries(params)) str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
	return str;
}
//#endregion
//#region plugins/voice-call/src/components/VoiceCallBanner.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1$7 = {
	key: 0,
	class: "voice-call-banner"
};
var _hoisted_2$5 = { class: "voice-call-banner__content" };
var _hoisted_3$5 = { class: "voice-call-banner__info" };
var _hoisted_4$2 = { class: "voice-call-banner__title" };
var _hoisted_5$2 = {
	key: 0,
	class: "voice-call-banner__countdown"
};
var _hoisted_6$2 = { class: "voice-call-banner__actions" };
var VoiceCallBanner_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "VoiceCallBanner",
	props: {
		callerName: {},
		visible: { type: Boolean },
		ringRemainingSecs: {}
	},
	emits: ["accept", "reject"],
	setup(__props) {
		return (_ctx, _cache) => {
			const _component_t_icon = Icon;
			return openBlock(), createBlock(Transition, { name: "voice-banner-slide" }, {
				default: withCtx(() => [__props.visible ? (openBlock(), createElementBlock("div", _hoisted_1$7, [createElementVNode("div", _hoisted_2$5, [
					createVNode(_component_t_icon, {
						name: "call",
						class: "voice-call-banner__icon"
					}),
					createElementVNode("div", _hoisted_3$5, [createElementVNode("span", _hoisted_4$2, toDisplayString(unref(t$1)("voice_call_caller_invite", { name: __props.callerName })), 1), __props.ringRemainingSecs > 0 ? (openBlock(), createElementBlock("span", _hoisted_5$2, toDisplayString(unref(t$1)("voice_call_ring_countdown", { secs: __props.ringRemainingSecs })), 1)) : createCommentVNode("", true)]),
					createElementVNode("div", _hoisted_6$2, [createElementVNode("button", {
						class: "voice-call-banner__btn voice-call-banner__btn--accept",
						onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("accept"))
					}, toDisplayString(unref(t$1)("voice_call_answer")), 1), createElementVNode("button", {
						class: "voice-call-banner__btn voice-call-banner__btn--reject",
						onClick: _cache[1] || (_cache[1] = ($event) => _ctx.$emit("reject"))
					}, toDisplayString(unref(t$1)("voice_call_reject")), 1)])
				])])) : createCommentVNode("", true)]),
				_: 1
			});
		};
	}
});
//#endregion
//#region \0plugin-vue:export-helper
var _plugin_vue_export_helper_default = (sfc, props) => {
	const target = sfc.__vccOpts || sfc;
	for (const [key, val] of props) target[key] = val;
	return target;
};
//#endregion
//#region plugins/voice-call/src/components/VoiceCallBanner.vue
var VoiceCallBanner_default = /*#__PURE__*/ _plugin_vue_export_helper_default(VoiceCallBanner_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-cde189a0"]]);
//#endregion
//#region plugins/voice-call/src/components/AvatarBadge.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1$6 = ["title"];
var _hoisted_2$4 = ["src", "alt"];
var _hoisted_3$4 = {
	key: 1,
	class: "cp-avatar__inner"
};
//#endregion
//#region plugins/voice-call/src/components/AvatarBadge.vue
var AvatarBadge_default = /*#__PURE__*/ _plugin_vue_export_helper_default(/* @__PURE__ */ defineComponent({
	__name: "AvatarBadge",
	props: {
		name: {},
		avatarUrl: { default: "" },
		size: { default: 30 }
	},
	setup(__props) {
		/**
		* @fileoverview 头像徽章组件（AvatarBadge.vue，插件本地副本）。
		* @description 统一头像组件：有图片时显示图片，无图片时显示首字母 + 确定性颜色。
		*              仅依赖 vue，无宿主运行期依赖，保证插件自包含。
		*/
		const props = __props;
		const hasAvatarImage = computed(() => (props.avatarUrl ?? "").trim().length > 0);
		function hashToHue(input) {
			let h = 0;
			for (let i = 0; i < input.length; i++) h = h * 31 + input.charCodeAt(i) >>> 0;
			return h % 360;
		}
		function clampAvatarSize(size) {
			return Math.max(22, Math.min(96, Math.trunc(size ?? 30)));
		}
		function computeInitial(name) {
			const raw = name.trim();
			if (!raw) return "—";
			const parts = raw.split(/\s+/g);
			return ((parts[0]?.[0] ?? raw[0] ?? "—") + (parts.length > 1 ? parts[parts.length - 1]?.[0] : "")).toUpperCase().slice(0, 2);
		}
		const initial = computed(() => computeInitial(props.name));
		function computeHue() {
			return hashToHue(props.name.trim().toLowerCase());
		}
		const hue = computed(computeHue);
		function computeStyleVars() {
			const size = clampAvatarSize(props.size);
			return {
				width: `${size}px`,
				height: `${size}px`,
				"--cp-avatar-size": `${size}px`,
				"--cp-avatar-hue": String(hue.value)
			};
		}
		const styleVars = computed(computeStyleVars);
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("span", {
				class: normalizeClass(["cp-avatar", { "cp-avatar--image": hasAvatarImage.value }]),
				style: normalizeStyle(styleVars.value),
				title: props.name,
				"aria-hidden": "true"
			}, [hasAvatarImage.value ? (openBlock(), createElementBlock("img", {
				key: 0,
				class: "cp-avatar__img",
				src: props.avatarUrl,
				alt: props.name
			}, null, 8, _hoisted_2$4)) : (openBlock(), createElementBlock("span", _hoisted_3$4, toDisplayString(initial.value), 1))], 14, _hoisted_1$6);
		};
	}
}), [["__scopeId", "data-v-93701517"]]);
//#endregion
//#region plugins/voice-call/src/components/SelfPreviewTile.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1$5 = { class: "cp-self-preview" };
var _hoisted_2$3 = ["srcObject"];
var _hoisted_3$3 = {
	key: 1,
	class: "cp-self-preview__placeholder"
};
//#endregion
//#region plugins/voice-call/src/components/SelfPreviewTile.vue
var SelfPreviewTile_default = /*#__PURE__*/ _plugin_vue_export_helper_default(/* @__PURE__ */ defineComponent({
	__name: "SelfPreviewTile",
	props: {
		stream: {},
		muted: { type: Boolean }
	},
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", _hoisted_1$5, [__props.stream ? (openBlock(), createElementBlock("video", {
				key: 0,
				srcObject: __props.stream,
				autoplay: "",
				muted: "",
				playsinline: ""
			}, null, 8, _hoisted_2$3)) : (openBlock(), createElementBlock("div", _hoisted_3$3, "Camera off"))]);
		};
	}
}), [["__scopeId", "data-v-24e87e4b"]]);
//#endregion
//#region plugins/voice-call/src/components/RemoteVideoTile.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1$4 = { class: "cp-remote-tile" };
var _hoisted_2$2 = ["srcObject"];
var _hoisted_3$2 = {
	key: 1,
	class: "cp-remote-tile__placeholder"
};
//#endregion
//#region plugins/voice-call/src/components/RemoteVideoTile.vue
var RemoteVideoTile_default = /*#__PURE__*/ _plugin_vue_export_helper_default(/* @__PURE__ */ defineComponent({
	__name: "RemoteVideoTile",
	props: { stream: {} },
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", _hoisted_1$4, [__props.stream ? (openBlock(), createElementBlock("video", {
				key: 0,
				srcObject: __props.stream,
				autoplay: "",
				playsinline: ""
			}, null, 8, _hoisted_2$2)) : (openBlock(), createElementBlock("div", _hoisted_3$2, "Waiting for video..."))]);
		};
	}
}), [["__scopeId", "data-v-342ebbaa"]]);
//#endregion
//#region plugins/voice-call/src/components/VideoGrid.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1$3 = { class: "cp-video-grid" };
//#endregion
//#region plugins/voice-call/src/components/VideoGrid.vue
var VideoGrid_default = /*#__PURE__*/ _plugin_vue_export_helper_default(/* @__PURE__ */ defineComponent({
	__name: "VideoGrid",
	props: {
		localStream: {},
		remoteStream: {}
	},
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", _hoisted_1$3, [createVNode(RemoteVideoTile_default, { stream: __props.remoteStream }, null, 8, ["stream"]), createVNode(SelfPreviewTile_default, {
				stream: __props.localStream,
				muted: true
			}, null, 8, ["stream"])]);
		};
	}
}), [["__scopeId", "data-v-92301184"]]);
//#endregion
//#region plugins/voice-call/src/components/VoiceCallPanel.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1$2 = { class: "voice-call-panel__status" };
var _hoisted_2$1 = {
	key: 0,
	class: "voice-call-panel__participant-count"
};
var _hoisted_3$1 = ["title", "aria-label"];
var _hoisted_4$1 = { class: "voice-call-panel__toggle" };
var _hoisted_5$1 = {
	key: 0,
	class: "voice-call-panel__roster"
};
var _hoisted_6$1 = { class: "voice-call-panel__roster-title" };
var _hoisted_7$1 = ["src"];
var _hoisted_8$1 = { class: "voice-call-panel__participant-name" };
var _hoisted_9$1 = {
	key: 2,
	class: "voice-call-panel__participant-icon"
};
var _hoisted_10$1 = {
	key: 3,
	class: "voice-call-panel__participant-icon"
};
var _hoisted_11$1 = { class: "voice-call-panel__participant-level" };
var _hoisted_12$1 = {
	key: 1,
	class: "voice-call-panel__video"
};
var _hoisted_13$1 = {
	key: 2,
	class: "voice-call-panel__controls"
};
var _hoisted_14$1 = ["title", "aria-label"];
var _hoisted_15 = ["title", "aria-label"];
var _hoisted_16 = ["title", "aria-label"];
var _hoisted_17 = ["title", "aria-label"];
var _hoisted_18 = ["aria-label", "value"];
var _hoisted_19 = { value: "" };
var _hoisted_20 = ["value"];
var _hoisted_21 = ["aria-label", "value"];
var _hoisted_22 = { value: "" };
var _hoisted_23 = ["value"];
var _hoisted_24 = ["title", "aria-label"];
//#endregion
//#region plugins/voice-call/src/components/VoiceCallPanel.vue
var VoiceCallPanel_default = /*#__PURE__*/ _plugin_vue_export_helper_default(/* @__PURE__ */ defineComponent({
	__name: "VoiceCallPanel",
	props: {
		state: {},
		duration: {},
		participants: {},
		isMuted: { type: Boolean },
		isNoiseSuppressionOn: { type: Boolean },
		inputDevices: {},
		currentInputDeviceId: {},
		outputDevices: {},
		currentOutputDeviceId: {},
		isConference: { type: Boolean },
		hasVideo: { type: Boolean },
		localStream: {},
		remoteStream: {},
		cameraEnabled: { type: Boolean },
		isSharing: { type: Boolean }
	},
	emits: [
		"toggleMute",
		"toggleNoiseSuppression",
		"selectInputDevice",
		"selectOutputDevice",
		"hangup",
		"toggleCamera",
		"toggleScreenShare"
	],
	setup(__props) {
		const props = __props;
		const minimized = ref(false);
		const visible = computed(() => props.state === "dialing" || props.state === "connecting" || props.state === "active");
		const hangupLabel = computed(() => props.state === "dialing" || props.state === "connecting" ? t$1("voice_call_cancel") : t$1("voice_call_hangup"));
		const formattedDuration = computed(() => {
			const totalSec = Math.floor(props.duration / 1e3);
			const min = Math.floor(totalSec / 60);
			const sec = totalSec % 60;
			return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
		});
		return (_ctx, _cache) => {
			const _component_t_icon = Icon;
			return openBlock(), createBlock(Transition, { name: "voice-panel-slide" }, {
				default: withCtx(() => [visible.value ? (openBlock(), createElementBlock("div", {
					key: 0,
					class: normalizeClass(["voice-call-panel", { "is-minimized": minimized.value }])
				}, [
					createElementVNode("div", {
						class: "voice-call-panel__bar",
						onClick: _cache[1] || (_cache[1] = ($event) => minimized.value = !minimized.value)
					}, [
						createElementVNode("span", _hoisted_1$2, [createElementVNode("span", { class: normalizeClass(["voice-call-panel__dot", {
							"is-active": __props.state === "active",
							"is-connecting": __props.state === "connecting" || __props.state === "dialing"
						}]) }, null, 2), createTextVNode(" " + toDisplayString(__props.state === "dialing" ? unref(t$1)("voice_call_dialing") : __props.state === "connecting" ? unref(t$1)("voice_call_connecting") : __props.state === "active" ? `${unref(t$1)("voice_call_in_call")} · ${formattedDuration.value}` : __props.state), 1)]),
						__props.state === "active" ? (openBlock(), createElementBlock("span", _hoisted_2$1, toDisplayString(unref(t$1)("voice_call_participants", { count: __props.participants.length })), 1)) : createCommentVNode("", true),
						createElementVNode("button", {
							type: "button",
							class: "voice-call-panel__bar-hangup",
							title: hangupLabel.value,
							"aria-label": hangupLabel.value,
							onClick: _cache[0] || (_cache[0] = withModifiers(($event) => _ctx.$emit("hangup"), ["stop"]))
						}, [createVNode(_component_t_icon, { name: "close" })], 8, _hoisted_3$1),
						createElementVNode("span", _hoisted_4$1, [createVNode(_component_t_icon, { name: minimized.value ? "chevron-up" : "chevron-down" }, null, 8, ["name"])])
					]),
					!minimized.value && __props.isConference && __props.participants.length > 0 ? (openBlock(), createElementBlock("div", _hoisted_5$1, [createElementVNode("div", _hoisted_6$1, toDisplayString(unref(t$1)("voice_call_participants_title")) + " (" + toDisplayString(__props.participants.length) + ")", 1), (openBlock(true), createElementBlock(Fragment, null, renderList(__props.participants, (p) => {
						return openBlock(), createElementBlock("div", {
							key: p.userId,
							class: "voice-call-panel__participant"
						}, [
							p.avatarUrl ? (openBlock(), createElementBlock("img", {
								key: 0,
								class: "voice-call-panel__participant-avatar",
								src: p.avatarUrl,
								alt: ""
							}, null, 8, _hoisted_7$1)) : (openBlock(), createBlock(AvatarBadge_default, {
								key: 1,
								name: p.displayName || p.userId,
								size: 26
							}, null, 8, ["name"])),
							createElementVNode("span", _hoisted_8$1, toDisplayString(p.displayName || p.userId), 1),
							p.isMuted ? (openBlock(), createElementBlock("span", _hoisted_9$1, [createVNode(_component_t_icon, { name: "microphone-1" })])) : createCommentVNode("", true),
							p.isSpeaking ? (openBlock(), createElementBlock("span", _hoisted_10$1, [createVNode(_component_t_icon, { name: "sound" })])) : createCommentVNode("", true),
							createElementVNode("span", _hoisted_11$1, [createElementVNode("span", {
								class: "voice-call-panel__level-bar",
								style: normalizeStyle({ width: p.audioLevel * 100 + "%" })
							}, null, 4)])
						]);
					}), 128))])) : createCommentVNode("", true),
					!minimized.value && __props.hasVideo ? (openBlock(), createElementBlock("div", _hoisted_12$1, [createVNode(VideoGrid_default, {
						"local-stream": __props.localStream,
						"remote-stream": __props.remoteStream
					}, null, 8, ["local-stream", "remote-stream"])])) : createCommentVNode("", true),
					!minimized.value ? (openBlock(), createElementBlock("div", _hoisted_13$1, [
						createElementVNode("button", {
							type: "button",
							class: normalizeClass(["voice-call-panel__ctrl-btn", { "is-muted": __props.isMuted }]),
							title: __props.isMuted ? unref(t$1)("voice_call_unmute") : unref(t$1)("voice_call_mute"),
							"aria-label": __props.isMuted ? unref(t$1)("voice_call_unmute") : unref(t$1)("voice_call_mute"),
							onClick: _cache[2] || (_cache[2] = ($event) => _ctx.$emit("toggleMute"))
						}, [createVNode(_component_t_icon, { name: "microphone" })], 10, _hoisted_14$1),
						createElementVNode("button", {
							type: "button",
							class: normalizeClass(["voice-call-panel__ctrl-btn", { "is-off": !__props.isNoiseSuppressionOn }]),
							title: __props.isNoiseSuppressionOn ? unref(t$1)("voice_call_noise_off") : unref(t$1)("voice_call_noise_on"),
							"aria-label": __props.isNoiseSuppressionOn ? unref(t$1)("voice_call_noise_off") : unref(t$1)("voice_call_noise_on"),
							onClick: _cache[3] || (_cache[3] = ($event) => _ctx.$emit("toggleNoiseSuppression"))
						}, [createVNode(_component_t_icon, { name: "sound-mute" })], 10, _hoisted_15),
						createElementVNode("button", {
							type: "button",
							class: normalizeClass(["voice-call-panel__ctrl-btn", { "is-muted": !__props.cameraEnabled }]),
							title: __props.cameraEnabled ? unref(t$1)("voice_call_camera_off") : unref(t$1)("voice_call_camera_on"),
							"aria-label": __props.cameraEnabled ? unref(t$1)("voice_call_camera_off") : unref(t$1)("voice_call_camera_on"),
							onClick: _cache[4] || (_cache[4] = ($event) => _ctx.$emit("toggleCamera"))
						}, [createVNode(_component_t_icon, { name: "camera" })], 10, _hoisted_16),
						createElementVNode("button", {
							type: "button",
							class: normalizeClass(["voice-call-panel__ctrl-btn", { "is-active": __props.isSharing }]),
							title: __props.isSharing ? unref(t$1)("voice_call_screen_share_stop") : unref(t$1)("voice_call_screen_share_start"),
							"aria-label": __props.isSharing ? unref(t$1)("voice_call_screen_share_stop") : unref(t$1)("voice_call_screen_share_start"),
							onClick: _cache[5] || (_cache[5] = ($event) => _ctx.$emit("toggleScreenShare"))
						}, [createVNode(_component_t_icon, { name: "share" })], 10, _hoisted_17),
						createElementVNode("select", {
							class: "voice-call-panel__device-select",
							"aria-label": unref(t$1)("voice_call_input_device"),
							value: __props.currentInputDeviceId ?? "",
							onChange: _cache[6] || (_cache[6] = ($event) => _ctx.$emit("selectInputDevice", $event.target.value))
						}, [createElementVNode("option", _hoisted_19, toDisplayString(unref(t$1)("voice_call_default_device")), 1), (openBlock(true), createElementBlock(Fragment, null, renderList(__props.inputDevices, (device) => {
							return openBlock(), createElementBlock("option", {
								key: device.deviceId,
								value: device.deviceId
							}, toDisplayString(device.name), 9, _hoisted_20);
						}), 128))], 40, _hoisted_18),
						createElementVNode("select", {
							class: "voice-call-panel__device-select",
							"aria-label": unref(t$1)("voice_call_output_device"),
							value: __props.currentOutputDeviceId ?? "",
							onChange: _cache[7] || (_cache[7] = ($event) => _ctx.$emit("selectOutputDevice", $event.target.value))
						}, [createElementVNode("option", _hoisted_22, toDisplayString(unref(t$1)("voice_call_default_device")), 1), (openBlock(true), createElementBlock(Fragment, null, renderList(__props.outputDevices, (device) => {
							return openBlock(), createElementBlock("option", {
								key: device.deviceId,
								value: device.deviceId
							}, toDisplayString(device.name), 9, _hoisted_23);
						}), 128))], 40, _hoisted_21),
						createElementVNode("button", {
							type: "button",
							class: "voice-call-panel__ctrl-btn voice-call-panel__ctrl-btn--hangup",
							title: hangupLabel.value,
							"aria-label": hangupLabel.value,
							onClick: _cache[8] || (_cache[8] = ($event) => _ctx.$emit("hangup"))
						}, [createVNode(_component_t_icon, { name: "close" })], 8, _hoisted_24)
					])) : createCommentVNode("", true)
				], 2)) : createCommentVNode("", true)]),
				_: 1
			});
		};
	}
}), [["__scopeId", "data-v-3857b46f"]]);
//#endregion
//#region plugins/voice-call/src/runtime/voiceCallStoreAccess.ts
/**
* 默认空状态，确保 resolveState() 在任何时候都可安全访问。
* 当 setVoiceCallState() 被调用时，这些 ref 会被替换为真正运行时状态。
*/
function createDefaultState() {
	return {
		currentState: ref("idle"),
		activeSession: ref(null),
		participants: ref([]),
		inputDevices: ref([]),
		outputDevices: ref([]),
		activeSummary: ref(null)
	};
}
var voiceCallState = createDefaultState();
function resolveState() {
	return voiceCallState;
}
computed(() => resolveState().currentState.value);
var activeSession = computed(() => resolveState().activeSession.value);
var participants = computed(() => resolveState().participants.value);
computed(() => resolveState().inputDevices.value);
computed(() => resolveState().outputDevices.value);
computed(() => resolveState().activeSummary.value);
//#endregion
//#region plugins/voice-call/src/composables/createVoiceCallStatePort.ts
function createVoiceCallStatePort() {
	return {
		async connectSignaling(wsUrl, accessToken, userId, displayName) {
			await invokeVoiceCall("voice_call:connect_signaling", {
				wsUrl,
				accessToken,
				userId,
				displayName
			});
		},
		async startCall(kind, roomId, targetUserId) {
			if (kind === "direct" && targetUserId) return invokeVoiceCall("voice_call:start_direct_call", {
				sessionId: `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				targetUserId,
				roomId
			});
			return invokeVoiceCall("voice_call:start_conference", {
				sessionId: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				roomId
			});
		},
		async acceptCall(sessionId) {
			await invokeVoiceCall("voice_call:accept_call", { sessionId });
		},
		async rejectCall(sessionId, reason) {
			await invokeVoiceCall("voice_call:reject_call", {
				sessionId,
				reason: reason ?? null
			});
		},
		async cancelCall(sessionId) {
			await invokeVoiceCall("voice_call:hangup_call", { sessionId });
		},
		async toggleMute(sessionId) {
			return invokeVoiceCall("voice_call:toggle_mute", { sessionId });
		},
		async toggleNoiseSuppression(sessionId) {
			return invokeVoiceCall("voice_call:toggle_noise_suppression", { sessionId });
		},
		async updateMediaSettings(sessionId, settings) {
			if (settings.inputDeviceId) await invokeVoiceCall("voice_call:select_input_device", {
				sessionId,
				deviceId: settings.inputDeviceId
			});
			if (settings.outputDeviceId) await invokeVoiceCall("voice_call:select_output_device", {
				sessionId,
				deviceId: settings.outputDeviceId
			});
		},
		getActiveSession() {
			return activeSession.value;
		},
		getParticipants(_sessionId) {
			return participants.value;
		},
		async enumerateDevices() {
			try {
				return await invokeVoiceCall("voice_call:enumerate_audio_devices");
			} catch {
				return {
					input: await invokeVoiceCall("voice_call:enumerate_input_devices"),
					output: await invokeVoiceCall("voice_call:enumerate_output_devices")
				};
			}
		},
		async joinConference(sessionId, initiatorId) {
			return invokeVoiceCall("voice_call:join_conference", {
				sessionId,
				initiatorId: initiatorId ?? null
			});
		},
		async leaveConference(sessionId) {
			await invokeVoiceCall("voice_call:leave_conference", { sessionId });
		}
	};
}
//#endregion
//#region plugins/voice-call/src/runtime/governance.ts
function getRoomGovernanceCapabilities() {
	return { forChannel(_roomId) {
		return { async listMembers() {
			return [];
		} };
	} };
}
//#endregion
//#region plugins/voice-call/src/components/VoiceCallHost.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1$1 = { class: "voice-call-host" };
var DEVICE_POLL_INTERVAL_MS = 3e3;
//#endregion
//#region plugins/voice-call/src/components/VoiceCallHost.vue
var VoiceCallHost_default = /* @__PURE__ */ defineComponent({
	__name: "VoiceCallHost",
	props: {
		roomId: {},
		roomName: {},
		targetUserId: {}
	},
	emits: ["stateChange"],
	setup(__props, { expose: __expose, emit: __emit }) {
		const logger = createLogger("VoiceCallHost");
		function getCurrentUserId() {
			try {
				return getContext().uid ?? "";
			} catch {
				return "";
			}
		}
		const props = __props;
		const emit = __emit;
		const { callState, activeSession, participants, duration, isMuted, isNoiseSuppressionOn, inputDevices, outputDevices, ringRemainingSecs, startDirectCall, startConference, acceptCall, rejectCall, hangup, cancelCall, toggleMute, toggleNoiseSuppression, selectInputDevice, selectOutputDevice, initDevices, refreshDevices, joinConference, leaveConference, beginListening, onIncomingCall, syncState } = useVoiceCall({
			statePort: createVoiceCallStatePort(),
			roomId: () => props.roomId,
			userId: () => getCurrentUserId()
		});
		const videoCall = useVideoCall("");
		const screenShare = useScreenShare("");
		watch(() => activeSession.value?.sessionId, (sid) => {
			if (sid) videoCall.setSessionId(sid);
		});
		const isConference = computed(() => activeSession.value?.kind === "conference");
		const callerName = computed(() => {
			const session = activeSession.value;
			if (!session) return "";
			const selfId = getCurrentUserId();
			return session.participants.find((p) => p.userId !== selfId)?.displayName ?? t$1("voice_call_unknown_user");
		});
		const currentInputDeviceId = computed(() => {
			const sessionDevice = activeSession.value?.mediaSettings.inputDeviceId;
			if (sessionDevice && inputDevices.value.some((d) => d.deviceId === sessionDevice)) return sessionDevice;
			return inputDevices.value.find((d) => d.isDefault)?.deviceId ?? inputDevices.value[0]?.deviceId ?? null;
		});
		const currentOutputDeviceId = computed(() => {
			const sessionDevice = activeSession.value?.mediaSettings.outputDeviceId;
			if (sessionDevice && outputDevices.value.some((d) => d.deviceId === sessionDevice)) return sessionDevice;
			return outputDevices.value.find((d) => d.isDefault)?.deviceId ?? outputDevices.value[0]?.deviceId ?? null;
		});
		function handleAccept() {
			acceptCall();
		}
		function handleReject() {
			rejectCall("declined");
		}
		function handleHangup() {
			if (callState.value === "dialing" || callState.value === "connecting") cancelCall();
			else if (isConference.value) leaveConference();
			else hangup();
		}
		function handleToggleCamera() {
			videoCall.toggleCamera();
		}
		function handleToggleScreenShare() {
			if (screenShare.isSharing.value) screenShare.stopScreenShare();
			else {
				const pc = videoCall.getPeerConnection();
				if (pc) {
					screenShare.setPeerConnection(pc);
					screenShare.startScreenShare();
				} else logger.warn("Action: chat_voice_call_screen_share_blocked", { reason: "no_peer_connection" });
			}
		}
		const memberAvatarMap = ref(/* @__PURE__ */ new Map());
		watch(callState, (s, prev) => {
			if (s !== prev) emit("stateChange", s);
		});
		watch(callState, async (s) => {
			if (s === "active" || s === "connecting") try {
				const members = await getRoomGovernanceCapabilities().forChannel(props.roomId).listMembers();
				const map = /* @__PURE__ */ new Map();
				for (const m of members) if (m.avatar) map.set(m.uid, m.avatar);
				memberAvatarMap.value = map;
			} catch {}
		});
		const participantsWithAvatars = computed(() => {
			const avatars = memberAvatarMap.value;
			if (avatars.size === 0) return participants.value;
			return participants.value.map((p) => {
				const avatarUrl = avatars.get(p.userId);
				return avatarUrl ? {
					...p,
					avatarUrl
				} : p;
			});
		});
		let devicePollHandle = null;
		function startDevicePoll() {
			if (devicePollHandle) return;
			devicePollHandle = setInterval(() => {
				refreshDevices();
			}, DEVICE_POLL_INTERVAL_MS);
		}
		function stopDevicePoll() {
			if (devicePollHandle) {
				clearInterval(devicePollHandle);
				devicePollHandle = null;
			}
		}
		watch(callState, (s) => {
			if (s === "dialing" || s === "connecting" || s === "active" || s === "ringing") startDevicePoll();
			else stopDevicePoll();
		});
		onMounted(() => {
			initDevices();
			beginListening();
		});
		let unlistenIncoming = null;
		let unlistenStateChange = null;
		onMounted(() => {
			try {
				unlistenIncoming = onVoiceCallEvent("voice_call:incoming", (w) => {
					onIncomingCall({
						sessionId: w.session_id,
						kind: w.call_kind || "direct",
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
							echoCancellation: false
						}
					});
				});
			} catch {}
			try {
				unlistenStateChange = onVoiceCallEvent("voice_call:state_change", (s) => {
					const session = activeSession.value;
					if (session && session.sessionId === s.session_id) syncState(s.new_state, {
						...session,
						state: s.new_state
					});
				});
			} catch {}
		});
		onUnmounted(() => {
			unlistenIncoming?.();
			unlistenStateChange?.();
			stopDevicePoll();
			if (screenShare.isSharing.value) screenShare.stopScreenShare();
			videoCall.hangup();
		});
		function startCall(targetUserId) {
			return startDirectCall(targetUserId || props.targetUserId || "");
		}
		async function startVideoCall(targetUserId) {
			await startDirectCall(targetUserId || props.targetUserId || "");
			setTimeout(() => {
				videoCall.startCall();
			}, 1e3);
		}
		__expose({
			callState,
			startDirectCall: startCall,
			startVideoCall,
			startConference,
			joinConference,
			leaveConference
		});
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", _hoisted_1$1, [createVNode(VoiceCallBanner_default, {
				"caller-name": callerName.value,
				visible: unref(callState) === "ringing",
				"ring-remaining-secs": unref(ringRemainingSecs),
				onAccept: handleAccept,
				onReject: handleReject
			}, null, 8, [
				"caller-name",
				"visible",
				"ring-remaining-secs"
			]), createVNode(VoiceCallPanel_default, {
				state: unref(callState),
				duration: unref(duration),
				participants: participantsWithAvatars.value,
				"is-muted": unref(isMuted),
				"is-noise-suppression-on": unref(isNoiseSuppressionOn),
				"input-devices": unref(inputDevices),
				"current-input-device-id": currentInputDeviceId.value,
				"output-devices": unref(outputDevices),
				"current-output-device-id": currentOutputDeviceId.value,
				"is-conference": isConference.value,
				"has-video": unref(callState) === "active" && unref(activeSession)?.kind === "direct",
				"local-stream": unref(videoCall).localStream.value,
				"remote-stream": unref(videoCall).remoteStream.value,
				"camera-enabled": unref(videoCall).cameraEnabled.value,
				"is-sharing": unref(screenShare).isSharing.value,
				onToggleMute: unref(toggleMute),
				onToggleNoiseSuppression: unref(toggleNoiseSuppression),
				onSelectInputDevice: unref(selectInputDevice),
				onSelectOutputDevice: unref(selectOutputDevice),
				onToggleCamera: handleToggleCamera,
				onToggleScreenShare: handleToggleScreenShare,
				onHangup: handleHangup
			}, null, 8, [
				"state",
				"duration",
				"participants",
				"is-muted",
				"is-noise-suppression-on",
				"input-devices",
				"current-input-device-id",
				"output-devices",
				"current-output-device-id",
				"is-conference",
				"has-video",
				"local-stream",
				"remote-stream",
				"camera-enabled",
				"is-sharing",
				"onToggleMute",
				"onToggleNoiseSuppression",
				"onSelectInputDevice",
				"onSelectOutputDevice"
			])]);
		};
	}
});
//#endregion
//#region plugins/voice-call/src/components/CallRecordBubble.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = { class: "call-record-bubble" };
var _hoisted_2 = { class: "call-record-bubble__header" };
var _hoisted_3 = { class: "call-record-bubble__title" };
var _hoisted_4 = { class: "call-record-bubble__body" };
var _hoisted_5 = { class: "call-record-bubble__row" };
var _hoisted_6 = { class: "call-record-bubble__label" };
var _hoisted_7 = { class: "call-record-bubble__value" };
var _hoisted_8 = {
	key: 0,
	class: "call-record-bubble__row"
};
var _hoisted_9 = { class: "call-record-bubble__label" };
var _hoisted_10 = { class: "call-record-bubble__value" };
var _hoisted_11 = { class: "call-record-bubble__row" };
var _hoisted_12 = { class: "call-record-bubble__label" };
var _hoisted_13 = { class: "call-record-bubble__value call-record-bubble__value--status" };
var _hoisted_14 = { class: "call-record-bubble__footer" };
//#endregion
//#region plugins/voice-call/src/components/CallRecordBubble.vue
var CallRecordBubble_default = /*#__PURE__*/ _plugin_vue_export_helper_default(/* @__PURE__ */ defineComponent({
	__name: "CallRecordBubble",
	props: {
		data: {},
		context: {},
		preview: {},
		domain: {},
		domainVersion: {},
		mid: {},
		from: {},
		timeMs: {},
		replyToMid: {}
	},
	emits: ["callback"],
	setup(__props) {
		const props = __props;
		/** 从消息 data 提取通话摘要，缺失字段以安全默认值兜底。 */
		const summary = computed(() => {
			const d = props.data ?? {};
			return {
				sessionId: String(d.sessionId ?? ""),
				kind: d.kind ?? "direct",
				duration: Number(d.duration ?? 0),
				disconnectReason: String(d.disconnectReason ?? "")
			};
		});
		/** 发起方名称：优先取 data.initiatorName，其次回落到消息发送者。 */
		const initiatorName = computed(() => {
			const d = props.data ?? {};
			return String(d.initiatorName ?? props.from?.name ?? "");
		});
		const formattedDuration = computed(() => {
			if (summary.value.duration <= 0) return "";
			const totalSec = Math.floor(summary.value.duration / 1e3);
			const min = Math.floor(totalSec / 60);
			const sec = totalSec % 60;
			if (min > 0) return t$1("voice_call_duration_format", {
				min,
				sec
			});
			return t$1("voice_call_duration_seconds", { sec });
		});
		const statusText = computed(() => {
			if (summary.value.disconnectReason === "timeout") return t$1("voice_call_status_missed");
			if (summary.value.disconnectReason === "declined") return t$1("voice_call_status_declined");
			if (summary.value.disconnectReason === "cancelled") return t$1("voice_call_status_cancelled");
			return t$1("voice_call_status_ended");
		});
		return (_ctx, _cache) => {
			const _component_t_icon = Icon;
			return openBlock(), createElementBlock("div", _hoisted_1, [
				createElementVNode("div", _hoisted_2, [createVNode(_component_t_icon, {
					name: "call",
					class: "call-record-bubble__icon"
				}), createElementVNode("span", _hoisted_3, toDisplayString(unref(t$1)("voice_call")), 1)]),
				createElementVNode("div", _hoisted_4, [
					createElementVNode("div", _hoisted_5, [createElementVNode("span", _hoisted_6, toDisplayString(unref(t$1)("voice_call_initiator")), 1), createElementVNode("span", _hoisted_7, toDisplayString(initiatorName.value), 1)]),
					summary.value.duration > 0 ? (openBlock(), createElementBlock("div", _hoisted_8, [createElementVNode("span", _hoisted_9, toDisplayString(unref(t$1)("voice_call_duration")), 1), createElementVNode("span", _hoisted_10, toDisplayString(formattedDuration.value), 1)])) : createCommentVNode("", true),
					createElementVNode("div", _hoisted_11, [createElementVNode("span", _hoisted_12, toDisplayString(unref(t$1)("voice_call_status")), 1), createElementVNode("span", _hoisted_13, toDisplayString(statusText.value), 1)])
				]),
				createElementVNode("div", _hoisted_14, [createElementVNode("button", {
					class: "call-record-bubble__btn",
					onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("callback"))
				}, [createVNode(_component_t_icon, { name: "call" }), createTextVNode(" " + toDisplayString(unref(t$1)("voice_call_callback")), 1)])])
			]);
		};
	}
}), [["__scopeId", "data-v-4db1606a"]]);
//#endregion
//#region plugins/voice-call/src/index.ts
var manifest = voiceCallManifest;
var renderers = { call_record: CallRecordBubble_default };
var cleanup = null;
function t(lang, key) {
	return (voiceCallMessages[lang] ?? voiceCallMessages.zh_cn)[key] ?? key;
}
function activate(ctx) {
	bindContext(ctx);
	const lang = ctx.lang || "zh_cn";
	const detach = ctx.host.registerToolbarAction?.({
		id: "voice-call.start",
		label: t(lang, "voiceCall.start"),
		order: 50,
		onClick: () => {
			ctx.host.invoke?.("voice_call:start_direct_call", {
				sessionId: `local-${Date.now()}`,
				targetUserId: "",
				roomId: ""
			});
		}
	}) ?? (() => {});
	const unmount = ctx.host.mountOverlay?.(VoiceCallHost_default) ?? (() => {});
	const offIncoming = onVoiceCallEvent("voice_call:incoming", (p) => {});
	const offState = onVoiceCallEvent("voice_call:state_change", () => {});
	const offVideo = onVoiceCallEvent("voice_call:video_signaling", () => {});
	cleanup = () => {
		detach();
		unmount();
		offIncoming();
		offState();
		offVideo();
	};
}
function deactivate() {
	cleanup?.();
	cleanup = null;
}
//#endregion
export { activate, deactivate, manifest, renderers };
