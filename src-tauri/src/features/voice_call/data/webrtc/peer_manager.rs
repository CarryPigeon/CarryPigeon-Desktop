use anyhow::Context;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;
use tracing::{info, warn};

use crate::features::voice_call::domain::model::{AnswerData, OfferData};

/// RTP 音频时钟步进：48kHz 下每 20ms 帧 +960 采样（RFC 3550）。
const RTP_TIMESTAMP_STEP: u64 = 960;

#[derive(Clone)]
pub struct PeerConnectionHandle {
    pub session_id: String,
    pub connection: Arc<webrtc::peer_connection::RTCPeerConnection>,
    pub local_track: Arc<webrtc::track::track_local::track_local_static_rtp::TrackLocalStaticRTP>,
    pub ice_state_tx: tokio::sync::watch::Sender<String>,
    pub seq: Arc<AtomicU64>,
    /// RTP 时间戳时钟：按 48kHz 采样数单调递增（修复墙钟毫秒截断）。
    pub timestamp: Arc<AtomicU64>,
    /// 每连接唯一的随机 SSRC（RFC 3550 禁止 0，且多路场景需可区分源）。
    pub ssrc: u32,
}

/// 生成随机 SSRC；失败时以时间熵兜底，保证非 0。
fn random_ssrc() -> u32 {
    let mut bytes = [0u8; 4];
    if getrandom::fill(&mut bytes).is_err() {
        bytes.copy_from_slice(
            &SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos()
                .to_be_bytes(),
        );
    }
    let value = u32::from_be_bytes(bytes);
    if value == 0 { 1 } else { value }
}

/// 安装 ICE 候选回调，返回接收端供调用方收集候选 JSON。
fn install_candidate_collector(
    pc: &webrtc::peer_connection::RTCPeerConnection,
) -> tokio::sync::mpsc::Receiver<String> {
    let (candidate_tx, candidate_rx) = tokio::sync::mpsc::channel::<String>(128);
    pc.on_ice_candidate(Box::new(move |candidate| {
        if let Some(c) = candidate
            && let Ok(json) = serde_json::to_string(&c)
        {
            let _ = candidate_tx.try_send(json);
        }
        Box::pin(async {})
    }));
    candidate_rx
}

/// 收集初始 ICE 候选。
///
/// 说明：不再使用固定 500ms 截断——以 1.5s 无新候选为空闲判据，
/// 且必须等到 gathering complete 或触及 5s 硬上限才返回，
/// 避免弱网下候选被静默丢弃导致呼叫建立失败。
async fn gather_initial_candidates(
    pc: &webrtc::peer_connection::RTCPeerConnection,
    mut candidate_rx: tokio::sync::mpsc::Receiver<String>,
) -> Vec<String> {
    const IDLE_WINDOW: Duration = Duration::from_millis(1500);
    const HARD_DEADLINE: Duration = Duration::from_secs(5);
    let started = Instant::now();

    let mut candidates = Vec::new();
    loop {
        match tokio::time::timeout(IDLE_WINDOW, candidate_rx.recv()).await {
            Ok(Some(candidate)) => {
                candidates.push(candidate);
                continue;
            }
            Ok(None) => break, // 通道关闭
            Err(_) => {}       // 本轮空闲窗口到期，进入状态判定
        }

        if pc.ice_gathering_state()
            == webrtc::ice_transport::ice_gathering_state::RTCIceGatheringState::Complete
        {
            // 排空残余候选后结束
            while let Ok(candidate) = candidate_rx.try_recv() {
                candidates.push(candidate);
            }
            break;
        }
        if started.elapsed() >= HARD_DEADLINE {
            warn!(action = "app_voice_call_ice_gathering_deadline_reached");
            break;
        }
    }
    candidates
}

pub struct WebRtcPeerManager {
    connections: Mutex<HashMap<String, PeerConnectionHandle>>,
    stun_server: String,
    turn_server: Option<String>,
}

impl Default for WebRtcPeerManager {
    fn default() -> Self {
        Self::new()
    }
}

impl WebRtcPeerManager {
    pub fn new() -> Self {
        Self {
            connections: Mutex::new(HashMap::new()),
            stun_server: "stun:stun.l.google.com:19302".to_string(),
            turn_server: None,
        }
    }

    fn build_api() -> anyhow::Result<webrtc::api::API> {
        let mut media = webrtc::api::media_engine::MediaEngine::default();

        let codec = webrtc::rtp_transceiver::rtp_codec::RTCRtpCodecParameters {
            capability: webrtc::rtp_transceiver::rtp_codec::RTCRtpCodecCapability {
                mime_type: webrtc::api::media_engine::MIME_TYPE_OPUS.to_string(),
                clock_rate: 48000,
                channels: 2,
                sdp_fmtp_line: "minptime=20;useinbandfec=1".to_string(),
                ..Default::default()
            },
            payload_type: 111,
            ..Default::default()
        };

        media.register_codec(
            codec,
            webrtc::rtp_transceiver::rtp_codec::RTPCodecType::Audio,
        )?;

        Ok(webrtc::api::APIBuilder::new()
            .with_media_engine(media)
            .build())
    }

    fn ice_servers(&self) -> Vec<webrtc::ice_transport::ice_server::RTCIceServer> {
        let mut servers = vec![webrtc::ice_transport::ice_server::RTCIceServer {
            urls: vec![self.stun_server.clone()],
            ..Default::default()
        }];

        if let Some(ref turn) = self.turn_server {
            servers.push(webrtc::ice_transport::ice_server::RTCIceServer {
                urls: vec![turn.clone()],
                ..Default::default()
            });
        }

        servers
    }

    fn opus_capability() -> webrtc::rtp_transceiver::rtp_codec::RTCRtpCodecCapability {
        webrtc::rtp_transceiver::rtp_codec::RTCRtpCodecCapability {
            mime_type: webrtc::api::media_engine::MIME_TYPE_OPUS.to_string(),
            clock_rate: 48000,
            channels: 2,
            sdp_fmtp_line: "minptime=20;useinbandfec=1".to_string(),
            ..Default::default()
        }
    }

    fn build_track() -> webrtc::track::track_local::track_local_static_rtp::TrackLocalStaticRTP {
        webrtc::track::track_local::track_local_static_rtp::TrackLocalStaticRTP::new(
            Self::opus_capability(),
            "audio".to_string(),
            "pigeon-audio".to_string(),
        )
    }

    /// Create a peer connection and generate an SDP offer (caller side)
    pub async fn create_offer(&self, session_id: &str) -> anyhow::Result<OfferData> {
        let api = Self::build_api()?;

        let config = webrtc::peer_connection::configuration::RTCConfiguration {
            ice_servers: self.ice_servers(),
            ..Default::default()
        };

        let pc = api
            .new_peer_connection(config)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED")?;

        let track = Arc::new(Self::build_track());

        pc.add_track(track.clone())
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: add track")?;

        // Collect ICE candidates
        let mut candidate_rx = install_candidate_collector(&pc);

        // ICE connection state watcher
        let (ice_state_tx, _) = tokio::sync::watch::channel("new".to_string());
        let ice_tx_clone = ice_state_tx.clone();
        pc.on_ice_connection_state_change(Box::new(move |state| {
            let s = format!("{:?}", state).to_lowercase();
            let _ = ice_tx_clone.send(s);
            Box::pin(async {})
        }));

        // Create SDP offer
        let offer = pc
            .create_offer(None)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: create_offer")?;

        pc.set_local_description(offer.clone())
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: set_local_description")?;

        // Gather initial ICE candidates（持续到 complete / 空闲超时）
        let candidates = gather_initial_candidates(&pc, candidate_rx).await;

        let handle = PeerConnectionHandle {
            session_id: session_id.to_string(),
            connection: Arc::new(pc),
            local_track: track,
            ice_state_tx,
            seq: Arc::new(AtomicU64::new(0)),
            timestamp: Arc::new(AtomicU64::new(random_ssrc() as u64)),
            ssrc: random_ssrc(),
        };

        self.connections
            .lock()
            .await
            .insert(session_id.to_string(), handle);

        Ok(OfferData {
            sdp: offer.sdp,
            candidates,
        })
    }

    /// Create a peer connection and generate an SDP answer (callee side)
    pub async fn create_answer(
        &self,
        session_id: &str,
        offer_sdp: &str,
    ) -> anyhow::Result<AnswerData> {
        let api = Self::build_api()?;

        let config = webrtc::peer_connection::configuration::RTCConfiguration {
            ice_servers: self.ice_servers(),
            ..Default::default()
        };

        let pc = api
            .new_peer_connection(config)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED")?;

        let track = Arc::new(Self::build_track());

        pc.add_track(track.clone())
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: add track")?;

        // Collect ICE candidates
        let mut candidate_rx = install_candidate_collector(&pc);

        let (ice_state_tx, _) = tokio::sync::watch::channel("new".to_string());
        let ice_tx_clone = ice_state_tx.clone();
        pc.on_ice_connection_state_change(Box::new(move |state| {
            let s = format!("{:?}", state).to_lowercase();
            let _ = ice_tx_clone.send(s);
            Box::pin(async {})
        }));

        // Set remote description
        let offer_desc =
            webrtc::peer_connection::sdp::session_description::RTCSessionDescription::offer(
                offer_sdp.to_string(),
            )
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: invalid offer SDP")?;

        pc.set_remote_description(offer_desc)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: set_remote_description")?;

        // Create answer
        let answer = pc
            .create_answer(None)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: create_answer")?;

        pc.set_local_description(answer.clone())
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: set_local_description")?;

        // Gather initial candidates（持续到 complete / 空闲超时）
        let candidates = gather_initial_candidates(&pc, candidate_rx).await;

        let handle = PeerConnectionHandle {
            session_id: session_id.to_string(),
            connection: Arc::new(pc),
            local_track: track,
            ice_state_tx,
            seq: Arc::new(AtomicU64::new(0)),
            timestamp: Arc::new(AtomicU64::new(random_ssrc() as u64)),
            ssrc: random_ssrc(),
        };

        self.connections
            .lock()
            .await
            .insert(session_id.to_string(), handle);

        Ok(AnswerData {
            sdp: answer.sdp,
            candidates,
        })
    }

    /// Set the remote answer SDP on the caller's peer connection
    pub async fn set_remote_answer(
        &self,
        session_id: &str,
        answer_sdp: &str,
    ) -> anyhow::Result<()> {
        // 先取出句柄并释放 map 锁，避免跨 await 持锁阻塞其他会话操作。
        let handle = {
            let conns = self.connections.lock().await;
            conns.get(session_id).context("VOICE_CALL_SESSION_NOT_FOUND")?.clone()
        };

        let desc =
            webrtc::peer_connection::sdp::session_description::RTCSessionDescription::answer(
                answer_sdp.to_string(),
            )
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: invalid answer SDP")?;

        handle
            .connection
            .set_remote_description(desc)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: set_remote_description (answer)")?;

        Ok(())
    }

    /// Add ICE candidates received from the remote peer via signaling
    pub async fn add_remote_candidate(
        &self,
        session_id: &str,
        candidate_json: &str,
    ) -> anyhow::Result<()> {
        let handle = {
            let conns = self.connections.lock().await;
            conns.get(session_id).context("VOICE_CALL_SESSION_NOT_FOUND")?.clone()
        };

        let candidate: webrtc::ice_transport::ice_candidate::RTCIceCandidateInit =
            serde_json::from_str(candidate_json)
                .context("VOICE_CALL_ICE_FAILED: invalid candidate JSON")?;

        handle
            .connection
            .add_ice_candidate(candidate)
            .await
            .context("VOICE_CALL_ICE_FAILED: add_ice_candidate")?;

        Ok(())
    }

    /// Register callback for received audio data
    pub async fn on_track(
        &self,
        session_id: &str,
        callback: Arc<dyn Fn(Vec<u8>) + Send + Sync>,
    ) -> anyhow::Result<()> {
        let conns = self.connections.lock().await;
        let handle = conns
            .get(session_id)
            .context("VOICE_CALL_SESSION_NOT_FOUND")?;

        let pc = handle.connection.clone();

        pc.on_track(Box::new(
            move |track: Arc<webrtc::track::track_remote::TrackRemote>, _receiver, _transceiver| {
                let cb = callback.clone();
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 1500];
                    while let Ok((pkt, _attributes)) = track.read(&mut buf).await {
                        cb(pkt.payload.to_vec());
                    }
                });
                Box::pin(async {})
            },
        ));

        Ok(())
    }

    /// Send encoded Opus audio data through the local track
    pub async fn send_audio(&self, session_id: &str, data: &[u8]) -> anyhow::Result<()> {
        // 取出句柄后立即释放 map 锁，避免跨 await 持锁（会串行阻塞所有会话）。
        let handle = {
            let conns = self.connections.lock().await;
            conns.get(session_id).context("VOICE_CALL_SESSION_NOT_FOUND")?.clone()
        };

        use webrtc::rtp::packet::Packet;

        let seq = handle.seq.fetch_add(1, Ordering::Relaxed);
        // RTP 时钟：按 48kHz 采样数递增；SSRC 为每连接随机值。
        let timestamp = handle
            .timestamp
            .fetch_add(RTP_TIMESTAMP_STEP, Ordering::Relaxed) as u32;
        let pkt = Packet {
            header: webrtc::rtp::header::Header {
                version: 2,
                padding: false,
                extension: false,
                marker: false,
                payload_type: 111,
                sequence_number: seq as u16,
                timestamp,
                ssrc: handle.ssrc,
                csrc: vec![],
                extension_profile: 0,
                extensions: vec![],
                extensions_padding: 0,
            },
            payload: bytes::Bytes::from(data.to_vec()),
        };

        handle
            .local_track
            .write_rtp_with_extensions(&pkt, &[])
            .await
            .context("VOICE_CALL_AUDIO_ENCODE_FAILED: write_rtp_with_extensions")?;

        Ok(())
    }

    /// Watch ICE connection state changes
    pub async fn ice_state_rx(
        &self,
        session_id: &str,
    ) -> anyhow::Result<tokio::sync::watch::Receiver<String>> {
        let conns = self.connections.lock().await;
        let handle = conns
            .get(session_id)
            .context("VOICE_CALL_SESSION_NOT_FOUND")?;

        Ok(handle.ice_state_tx.subscribe())
    }

    pub async fn has_connection(&self, session_id: &str) -> bool {
        self.connections.lock().await.contains_key(session_id)
    }

    /// Close and clean up
    pub async fn close_peer_connection(&self, session_id: &str) -> anyhow::Result<()> {
        if let Some(handle) = self.connections.lock().await.remove(session_id) {
            handle
                .connection
                .close()
                .await
                .context("VOICE_CALL_PEER_CONNECTION_FAILED: close")?;
            info!(action = "app_voice_call_peer_connection_closed", session_id = %session_id);
        }
        Ok(())
    }

    // ── Conference multi-participant methods ──────────────────────

    fn conn_key(session_id: &str, participant_id: &str) -> String {
        format!("{}:{}", session_id, participant_id)
    }

    pub async fn create_offer_for(
        &self,
        session_id: &str,
        participant_id: &str,
    ) -> anyhow::Result<OfferData> {
        let key = Self::conn_key(session_id, participant_id);
        let api = Self::build_api()?;

        let config = webrtc::peer_connection::configuration::RTCConfiguration {
            ice_servers: self.ice_servers(),
            ..Default::default()
        };

        let pc = api
            .new_peer_connection(config)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED")?;

        let track = Arc::new(Self::build_track());
        pc.add_track(track.clone())
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: add track")?;

        let mut candidate_rx = install_candidate_collector(&pc);

        let (ice_state_tx, _) = tokio::sync::watch::channel("new".to_string());
        let ice_tx_clone = ice_state_tx.clone();
        pc.on_ice_connection_state_change(Box::new(move |state| {
            let s = format!("{:?}", state).to_lowercase();
            let _ = ice_tx_clone.send(s);
            Box::pin(async {})
        }));

        let offer = pc
            .create_offer(None)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: create_offer")?;

        pc.set_local_description(offer.clone())
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: set_local_description")?;

        let candidates = gather_initial_candidates(&pc, candidate_rx).await;

        let handle = PeerConnectionHandle {
            session_id: key.clone(),
            connection: Arc::new(pc),
            local_track: track,
            ice_state_tx,
            seq: Arc::new(AtomicU64::new(0)),
            timestamp: Arc::new(AtomicU64::new(random_ssrc() as u64)),
            ssrc: random_ssrc(),
        };

        self.connections.lock().await.insert(key, handle);

        Ok(OfferData {
            sdp: offer.sdp,
            candidates,
        })
    }

    pub async fn create_answer_for(
        &self,
        session_id: &str,
        participant_id: &str,
        offer_sdp: &str,
    ) -> anyhow::Result<AnswerData> {
        let key = Self::conn_key(session_id, participant_id);
        let api = Self::build_api()?;

        let config = webrtc::peer_connection::configuration::RTCConfiguration {
            ice_servers: self.ice_servers(),
            ..Default::default()
        };

        let pc = api
            .new_peer_connection(config)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED")?;

        let track = Arc::new(Self::build_track());
        pc.add_track(track.clone())
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: add track")?;

        let mut candidate_rx = install_candidate_collector(&pc);

        let (ice_state_tx, _) = tokio::sync::watch::channel("new".to_string());
        let ice_tx_clone = ice_state_tx.clone();
        pc.on_ice_connection_state_change(Box::new(move |state| {
            let s = format!("{:?}", state).to_lowercase();
            let _ = ice_tx_clone.send(s);
            Box::pin(async {})
        }));

        let offer_desc =
            webrtc::peer_connection::sdp::session_description::RTCSessionDescription::offer(
                offer_sdp.to_string(),
            )
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: invalid offer SDP")?;

        pc.set_remote_description(offer_desc)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: set_remote_description")?;

        let answer = pc
            .create_answer(None)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: create_answer")?;

        pc.set_local_description(answer.clone())
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: set_local_description")?;

        let candidates = gather_initial_candidates(&pc, candidate_rx).await;

        let handle = PeerConnectionHandle {
            session_id: key.clone(),
            connection: Arc::new(pc),
            local_track: track,
            ice_state_tx,
            seq: Arc::new(AtomicU64::new(0)),
            timestamp: Arc::new(AtomicU64::new(random_ssrc() as u64)),
            ssrc: random_ssrc(),
        };

        self.connections.lock().await.insert(key, handle);

        Ok(AnswerData {
            sdp: answer.sdp,
            candidates,
        })
    }

    pub async fn set_remote_answer_for(
        &self,
        session_id: &str,
        participant_id: &str,
        answer_sdp: &str,
    ) -> anyhow::Result<()> {
        let key = Self::conn_key(session_id, participant_id);
        let handle = {
            let conns = self.connections.lock().await;
            conns.get(&key).context("VOICE_CALL_SESSION_NOT_FOUND")?.clone()
        };

        let desc =
            webrtc::peer_connection::sdp::session_description::RTCSessionDescription::answer(
                answer_sdp.to_string(),
            )
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: invalid answer SDP")?;

        handle
            .connection
            .set_remote_description(desc)
            .await
            .context("VOICE_CALL_PEER_CONNECTION_FAILED: set_remote_description (answer)")?;

        Ok(())
    }

    pub async fn add_remote_candidate_for(
        &self,
        session_id: &str,
        participant_id: &str,
        candidate_json: &str,
    ) -> anyhow::Result<()> {
        let key = Self::conn_key(session_id, participant_id);
        let handle = {
            let conns = self.connections.lock().await;
            conns.get(&key).context("VOICE_CALL_SESSION_NOT_FOUND")?.clone()
        };

        let candidate: webrtc::ice_transport::ice_candidate::RTCIceCandidateInit =
            serde_json::from_str(candidate_json)
                .context("VOICE_CALL_ICE_FAILED: invalid candidate JSON")?;

        handle
            .connection
            .add_ice_candidate(candidate)
            .await
            .context("VOICE_CALL_ICE_FAILED: add_ice_candidate")?;

        Ok(())
    }

    pub async fn on_track_from(
        &self,
        session_id: &str,
        participant_id: &str,
        callback: Arc<dyn Fn(Vec<u8>) + Send + Sync>,
    ) -> anyhow::Result<()> {
        let key = Self::conn_key(session_id, participant_id);
        let conns = self.connections.lock().await;
        let handle = conns.get(&key).context("VOICE_CALL_SESSION_NOT_FOUND")?;
        let pc = handle.connection.clone();
        drop(conns);

        pc.on_track(Box::new(
            move |track: Arc<webrtc::track::track_remote::TrackRemote>, _receiver, _transceiver| {
                let cb = callback.clone();
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 1500];
                    while let Ok((pkt, _attributes)) = track.read(&mut buf).await {
                        cb(pkt.payload.to_vec());
                    }
                });
                Box::pin(async {})
            },
        ));

        Ok(())
    }

    pub async fn send_audio_to(
        &self,
        session_id: &str,
        participant_id: &str,
        data: &[u8],
    ) -> anyhow::Result<()> {
        let key = Self::conn_key(session_id, participant_id);
        let handle = {
            let conns = self.connections.lock().await;
            conns.get(&key).context("VOICE_CALL_SESSION_NOT_FOUND")?.clone()
        };

        let seq = handle.seq.fetch_add(1, Ordering::Relaxed);
        let timestamp = handle
            .timestamp
            .fetch_add(RTP_TIMESTAMP_STEP, Ordering::Relaxed) as u32;
        let pkt = webrtc::rtp::packet::Packet {
            header: webrtc::rtp::header::Header {
                version: 2,
                padding: false,
                extension: false,
                marker: false,
                payload_type: 111,
                sequence_number: seq as u16,
                timestamp,
                ssrc: handle.ssrc,
                csrc: vec![],
                extension_profile: 0,
                extensions: vec![],
                extensions_padding: 0,
            },
            payload: bytes::Bytes::from(data.to_vec()),
        };

        handle
            .local_track
            .write_rtp_with_extensions(&pkt, &[])
            .await
            .context("VOICE_CALL_AUDIO_ENCODE_FAILED: write_rtp_with_extensions")?;

        Ok(())
    }

    pub async fn close_peer_connection_for(
        &self,
        session_id: &str,
        participant_id: &str,
    ) -> anyhow::Result<()> {
        let key = Self::conn_key(session_id, participant_id);
        if let Some(handle) = self.connections.lock().await.remove(&key) {
            handle
                .connection
                .close()
                .await
                .context("VOICE_CALL_PEER_CONNECTION_FAILED: close")?;
            info!(action = "app_voice_call_peer_connection_closed", session_id = %key);
        }
        Ok(())
    }

    pub async fn close_all_for_session(&self, session_id: &str) {
        let prefix = format!("{}:", session_id);
        let keys: Vec<String> = {
            self.connections
                .lock()
                .await
                .keys()
                .filter(|k| k.starts_with(&prefix))
                .cloned()
                .collect()
        };
        for key in keys {
            if let Some(handle) = self.connections.lock().await.remove(&key) {
                let _ = handle.connection.close().await;
                info!(action = "app_voice_call_peer_connection_closed", session_id = %key);
            }
        }
    }

    pub async fn get_participant_ids(&self, session_id: &str) -> Vec<String> {
        let prefix = format!("{}:", session_id);
        self.connections
            .lock()
            .await
            .keys()
            .filter(|k| k.starts_with(&prefix))
            .map(|k| k[prefix.len()..].to_string())
            .collect()
    }
}
