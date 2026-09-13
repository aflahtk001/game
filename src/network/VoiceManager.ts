import * as THREE from 'three';
import { NetworkManager } from './NetworkManager';
import type { ProximityVoiceConfig } from './ProximityVoiceConfig';
import { DEFAULT_PROXIMITY_CONFIG, calculateProximityVolume } from './ProximityVoiceConfig';

interface RemoteAudioPipeline {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  panner?: PannerNode;
  analyser: AnalyserNode;
}

export type MicState = 'disabled' | 'enabled' | 'requesting' | 'denied' | 'error';

function optimizeAudioSDP(sdp: string): string {
  // Enforce low-latency, resilient Opus audio codec parameters
  return sdp.replace(
    /a=fmtp:111 ((?:(?!minptime).)*)\r\n/g,
    'a=fmtp:111 $1;minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;cbr=1\r\n'
  );
}

export class VoiceManager {
  private networkManager: NetworkManager;
  public config: ProximityVoiceConfig = { ...DEFAULT_PROXIMITY_CONFIG };

  private localStream: MediaStream | null = null;
  private silentTrack: MediaStreamTrack | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private audioNodes: Map<string, RemoteAudioPipeline> = new Map();

  public isMicEnabled: boolean = false;
  public isSpeakerEnabled: boolean = true;
  public micState: MicState = 'disabled';
  private onSpeakingStateChange?: (playerId: string, isSpeaking: boolean) => void;
  public onMicStateChanged?: (state: MicState, errorMsg?: string) => void;
  public onSpeakerStateChanged?: (enabled: boolean) => void;

  // Web Audio Context & Analysers
  private audioContext: AudioContext | null = null;
  private analysers: Map<string, AnalyserNode> = new Map();
  private speakingInterval: number | null = null;

  // ICE Candidate buffering
  private candidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();
  private makingOfferMap: Map<string, boolean> = new Map();

  constructor(networkManager: NetworkManager, initialConfig?: Partial<ProximityVoiceConfig>) {
    this.networkManager = networkManager;
    if (initialConfig) {
      this.config = { ...this.config, ...initialConfig };
    }

    this.networkManager.on('webrtc_signal', this.handleSignal.bind(this));
    this.networkManager.on('world_joined', this.handleWorldJoined.bind(this));
    this.networkManager.on('player_joined', this.handlePlayerJoined.bind(this));
    this.networkManager.on('player_left', this.handlePlayerLeft.bind(this));
    this.networkManager.on('session_left', this.handleSessionLeft.bind(this));

    // Unlock AudioContext on initial touch/click for all browsers
    const unlock = () => {
      this.ensureAudioContext();
      this.unlockAudioContext();
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  public unlockAudioContext(): void {
    if (!this.audioContext) {
      this.ensureAudioContext();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  public getOrCreateSilentTrack(): MediaStreamTrack {
    if (this.silentTrack && this.silentTrack.readyState === 'live') {
      return this.silentTrack;
    }
    this.ensureAudioContext();
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(dst);
    osc.start();
    this.silentTrack = dst.stream.getAudioTracks()[0];
    return this.silentTrack;
  }

  public setConfig(newConfig: Partial<ProximityVoiceConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (this.audioNodes) {
      for (const node of this.audioNodes.values()) {
        if (node.panner) {
          node.panner.refDistance = this.config.minDistance;
          node.panner.maxDistance = this.config.maxDistance;
        }
      }
    }
  }

  public getConfig(): ProximityVoiceConfig {
    return { ...this.config };
  }

  public setSpeakingStateCallback(cb: (playerId: string, isSpeaking: boolean) => void) {
    this.onSpeakingStateChange = cb;
  }

  public toggleSpeaker(): boolean {
    this.isSpeakerEnabled = !this.isSpeakerEnabled;
    this.ensureAudioContext();
    this.unlockAudioContext();
    this.onSpeakerStateChanged?.(this.isSpeakerEnabled);
    return this.isSpeakerEnabled;
  }

  public setSpeakerEnabled(enabled: boolean): void {
    this.isSpeakerEnabled = enabled;
    this.ensureAudioContext();
    this.unlockAudioContext();
    this.onSpeakerStateChanged?.(this.isSpeakerEnabled);
  }

  public async toggleMic(): Promise<MicState> {
    if (this.isMicEnabled) {
      this.muteMic();
      return 'disabled';
    } else {
      const state = await this.enableMic();
      return state;
    }
  }

  private async enableMic(): Promise<MicState> {
    this.micState = 'requesting';
    this.onMicStateChanged?.('requesting');

    try {
      this.ensureAudioContext();
      this.unlockAudioContext();

      if (!this.localStream) {
        // High-clarity, low-latency mono audio capture
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000
          } as MediaTrackConstraints,
          video: false,
        });
        this.setupLocalAnalyser(this.localStream);
      } else {
        // Unmute existing stream
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }

      this.isMicEnabled = true;
      this.micState = 'enabled';
      this.onMicStateChanged?.('enabled');

      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
      }

      // Seamlessly attach track to existing transceivers and ensure sendrecv direction
      for (const pc of this.peerConnections.values()) {
        if (pc.signalingState !== 'closed') {
          const audioTransceiver = pc.getTransceivers().find(
            t => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio'
          );
          if (audioTransceiver && audioTransceiver.sender && audioTrack) {
            audioTransceiver.direction = 'sendrecv';
            audioTransceiver.sender.replaceTrack(audioTrack).catch(() => {});
          } else {
            const audioSender = pc.getSenders().find(s => !s.track || s.track.kind === 'audio');
            if (audioSender && audioTrack) {
              audioSender.replaceTrack(audioTrack).catch(() => {});
            }
          }
        }
      }

      return 'enabled';
    } catch (error: any) {
      console.error('[VoiceManager] Failed to get microphone access:', error);
      if (error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
        this.micState = 'denied';
        this.onMicStateChanged?.('denied', 'Microphone permission was denied.');
        return 'denied';
      } else {
        this.micState = 'error';
        this.onMicStateChanged?.('error', error?.message || 'Failed to access microphone.');
        return 'error';
      }
    }
  }

  private muteMic() {
    this.isMicEnabled = false;
    this.micState = 'disabled';
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }

    // Switch active transceivers to silent track so connection stays alive without sending room noise
    const silentTrack = this.getOrCreateSilentTrack();
    for (const pc of this.peerConnections.values()) {
      if (pc.signalingState !== 'closed') {
        const audioTransceiver = pc.getTransceivers().find(
          t => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio'
        );
        if (audioTransceiver && audioTransceiver.sender && silentTrack) {
          audioTransceiver.sender.replaceTrack(silentTrack).catch(() => {});
        }
      }
    }

    if (this.onSpeakingStateChange) {
      this.onSpeakingStateChange('local', false);
    }
    this.onMicStateChanged?.('disabled');
  }

  private async handleWorldJoined(payload: { activePlayers: Array<{ id: string }> }) {
    const localId = this.networkManager.localPlayer?.id || '';
    if (payload.activePlayers) {
      for (const remote of payload.activePlayers) {
        if (remote.id !== localId && localId > remote.id) {
          await this.initiateCall(remote.id);
        }
      }
    }
  }

  private async handlePlayerJoined(payload: { player: { id: string } }) {
    const localId = this.networkManager.localPlayer?.id || '';
    if (payload.player.id === localId) return;
    if (localId > payload.player.id) {
      await this.initiateCall(payload.player.id);
    }
  }

  private handlePlayerLeft(payload: { playerId: string }) {
    this.removePeer(payload.playerId);
  }

  private handleSessionLeft() {
    for (const playerId of Array.from(this.peerConnections.keys())) {
      this.removePeer(playerId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.isMicEnabled = false;
    if (this.speakingInterval) {
      clearInterval(this.speakingInterval);
      this.speakingInterval = null;
    }
    this.candidateQueues.clear();
    this.makingOfferMap.clear();
  }

  private async initiateCall(targetId: string) {
    const pc = this.getOrCreatePeerConnection(targetId);
    if (pc.signalingState !== 'stable') {
      return;
    }

    try {
      this.makingOfferMap.set(targetId, true);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true
      });
      if (pc.signalingState !== 'stable') return;
      
      const optimizedSdp = optimizeAudioSDP(offer.sdp || '');
      const desc = new RTCSessionDescription({ type: offer.type, sdp: optimizedSdp });
      await pc.setLocalDescription(desc);
      this.networkManager.sendWebRTCSignal(targetId, desc);
    } catch (err) {
      console.warn('[VoiceManager] Error creating offer:', err);
    } finally {
      this.makingOfferMap.set(targetId, false);
    }
  }

  private async handleSignal(payload: { targetId: string; senderId?: string; signal: any }) {
    const { senderId, signal } = payload;
    if (!senderId) return;

    const localId = this.networkManager.localPlayer?.id || '';
    const isPolite = localId < senderId; // Deterministic tie-breaker
    const pc = this.getOrCreatePeerConnection(senderId);

    try {
      if (signal.type === 'offer') {
        const isMakingOffer = this.makingOfferMap.get(senderId) || false;
        const offerCollision = (pc.signalingState !== 'stable') || isMakingOffer;

        if (offerCollision) {
          if (!isPolite) {
            // Impolite peer ignores colliding offer; polite peer will accept ours
            return;
          }
          // Polite peer rolls back local offer to accept remote offer
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' } as any).catch(() => {}),
            pc.setRemoteDescription(new RTCSessionDescription(signal))
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        }

        await this.flushCandidateQueue(senderId, pc);
        const answer = await pc.createAnswer();
        const optimizedAnswerSdp = optimizeAudioSDP(answer.sdp || '');
        const desc = new RTCSessionDescription({ type: answer.type, sdp: optimizedAnswerSdp });
        await pc.setLocalDescription(desc);
        this.networkManager.sendWebRTCSignal(senderId, desc);
      } else if (signal.type === 'answer') {
        // Only set remote description if we are in have-local-offer state
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await this.flushCandidateQueue(senderId, pc);
        }
      } else if (signal.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal));
          } catch (e) {
            // Stale candidate ignored
          }
        } else {
          if (!this.candidateQueues.has(senderId)) {
            this.candidateQueues.set(senderId, []);
          }
          this.candidateQueues.get(senderId)!.push(signal);
        }
      }
    } catch (err) {
      console.warn('[VoiceManager] Handled signal with warning:', err);
    }
  }

  private async flushCandidateQueue(playerId: string, pc: RTCPeerConnection) {
    const queue = this.candidateQueues.get(playerId);
    if (queue && queue.length > 0) {
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[VoiceManager] Failed to add buffered ICE candidate:', e);
        }
      }
      this.candidateQueues.delete(playerId);
    }
  }

  private getOrCreatePeerConnection(playerId: string): RTCPeerConnection {
    if (this.peerConnections.has(playerId)) {
      return this.peerConnections.get(playerId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    const initialTrack = (this.isMicEnabled && this.localStream)
      ? this.localStream.getAudioTracks()[0]
      : this.getOrCreateSilentTrack();

    // Ensure audio transceiver is initialized with an active track
    try {
      const transceiver = pc.addTransceiver(initialTrack, {
        direction: 'sendrecv',
        streams: this.localStream ? [this.localStream] : []
      });
      if (initialTrack && transceiver.sender) {
        transceiver.sender.replaceTrack(initialTrack).catch(() => {});
      }
    } catch (e) {
      console.warn('[VoiceManager] addTransceiver error:', e);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.networkManager.sendWebRTCSignal(playerId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      if (track.kind !== 'audio') return;

      const stream = event.streams[0] || new MediaStream([track]);
      this.setupAudioPipeline(playerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(playerId);
      }
    };

    this.peerConnections.set(playerId, pc);
    return pc;
  }

  private removePeer(playerId: string) {
    const pc = this.peerConnections.get(playerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(playerId);
    }

    this.cleanupAudioPipeline(playerId);
    this.candidateQueues.delete(playerId);

    if (this.onSpeakingStateChange) {
      this.onSpeakingStateChange(playerId, false);
    }
  }

  public ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    if (!this.speakingInterval) {
      this.speakingInterval = window.setInterval(() => this.checkSpeakingStates(), 80);
    }
  }

  private setupLocalAnalyser(stream: MediaStream) {
    this.ensureAudioContext();
    if (!this.audioContext) return;

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      this.analysers.set('local', analyser);
    } catch (e) {
      console.warn('[VoiceManager] Error setting up local audio analyser:', e);
    }
  }

  private setupAudioPipeline(playerId: string, stream: MediaStream) {
    this.ensureAudioContext();
    if (!this.audioContext) return;

    this.cleanupAudioPipeline(playerId);

    try {
      const source = this.audioContext.createMediaStreamSource(stream);

      // 1. Analyser on raw source (for instant speaking indicator)
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      this.analysers.set(playerId, analyser);

      // 2. Gain node for smooth distance attenuation & master volume
      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(this.isSpeakerEnabled ? 1.0 : 0.0, this.audioContext.currentTime);

      // 3. 3D Spatial Panner Node (equalpower stereo panning without pitch distortion)
      let panner: PannerNode | undefined = undefined;
      if (this.config.spatialAudioEnabled && this.audioContext.createPanner) {
        panner = this.audioContext.createPanner();
        panner.panningModel = 'equalpower';
        panner.distanceModel = 'inverse';
        panner.refDistance = this.config.minDistance;
        panner.maxDistance = this.config.maxDistance;
        panner.rolloffFactor = 0; // Volume falloff is fully managed by our gain node

        source.connect(gain);
        gain.connect(panner);
        panner.connect(this.audioContext.destination);
      } else {
        source.connect(gain);
        gain.connect(this.audioContext.destination);
      }

      this.audioNodes.set(playerId, { source, gain, panner, analyser });
    } catch (e) {
      console.warn('[VoiceManager] Error setting up audio pipeline for:', playerId, e);
    }
  }

  private cleanupAudioPipeline(playerId: string) {
    const nodes = this.audioNodes.get(playerId);
    if (nodes) {
      try { nodes.source.disconnect(); } catch (_) {}
      try { nodes.gain.disconnect(); } catch (_) {}
      if (nodes.panner) {
        try { nodes.panner.disconnect(); } catch (_) {}
      }
      try { nodes.analyser.disconnect(); } catch (_) {}
      this.audioNodes.delete(playerId);
    }
    this.analysers.delete(playerId);
  }

  /**
   * Updates listener position and all remote speaker positions every frame.
   * Smoothly adjusts proximity volume and 3D spatial panning without dropping connections.
   */
  public updateSpatialAudio(
    listenerPos: THREE.Vector3,
    listenerForward: THREE.Vector3,
    speakerPositions: Map<string, THREE.Vector3>
  ) {
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    const currentTime = this.audioContext.currentTime;

    // 1. Update AudioListener position & orientation in 3D world space
    const listener = this.audioContext.listener;
    if (listener) {
      if (listener.positionX) {
        listener.positionX.setTargetAtTime(listenerPos.x, currentTime, 0.04);
        listener.positionY.setTargetAtTime(listenerPos.y, currentTime, 0.04);
        listener.positionZ.setTargetAtTime(listenerPos.z, currentTime, 0.04);
        listener.forwardX.setTargetAtTime(listenerForward.x, currentTime, 0.04);
        listener.forwardY.setTargetAtTime(listenerForward.y, currentTime, 0.04);
        listener.forwardZ.setTargetAtTime(listenerForward.z, currentTime, 0.04);
        listener.upX.setTargetAtTime(0, currentTime, 0.04);
        listener.upY.setTargetAtTime(1, currentTime, 0.04);
        listener.upZ.setTargetAtTime(0, currentTime, 0.04);
      } else if ((listener as any).setPosition) {
        (listener as any).setPosition(listenerPos.x, listenerPos.y, listenerPos.z);
        (listener as any).setOrientation(listenerForward.x, listenerForward.y, listenerForward.z, 0, 1, 0);
      }
    }

    // 2. Update proximity volume and 3D speaker position for each connected remote peer
    for (const [playerId, nodes] of this.audioNodes.entries()) {
      const speakerPos = speakerPositions.get(playerId);
      // If speakerPos is not yet established, default distance to 0 (full volume)
      const distance = speakerPos ? listenerPos.distanceTo(speakerPos) : 0;

      const targetVolume = this.isSpeakerEnabled ? calculateProximityVolume(distance, this.config) : 0.0;
      nodes.gain.gain.setTargetAtTime(targetVolume, currentTime, 0.04);

      // Update 3D spatial panner position
      if (nodes.panner && speakerPos && this.config.spatialAudioEnabled) {
        if (nodes.panner.positionX) {
          nodes.panner.positionX.setTargetAtTime(speakerPos.x, currentTime, 0.04);
          nodes.panner.positionY.setTargetAtTime(speakerPos.y, currentTime, 0.04);
          nodes.panner.positionZ.setTargetAtTime(speakerPos.z, currentTime, 0.04);
        } else if ((nodes.panner as any).setPosition) {
          (nodes.panner as any).setPosition(speakerPos.x, speakerPos.y, speakerPos.z);
        }
      }
    }
  }

  private checkSpeakingStates() {
    if (!this.onSpeakingStateChange) return;

    const dataArray = new Uint8Array(128);
    
    for (const [playerId, analyser] of this.analysers.entries()) {
      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      const isSpeaking = average > 6;
      this.onSpeakingStateChange(playerId, isSpeaking);
    }
  }
}
