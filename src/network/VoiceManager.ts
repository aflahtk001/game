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

export class VoiceManager {
  private networkManager: NetworkManager;
  public config: ProximityVoiceConfig = { ...DEFAULT_PROXIMITY_CONFIG };

  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteAudios: Map<string, HTMLAudioElement> = new Map();
  private audioNodes: Map<string, RemoteAudioPipeline> = new Map();

  public isMicEnabled: boolean = false;
  private onSpeakingStateChange?: (playerId: string, isSpeaking: boolean) => void;

  // Web Audio Context & Analysers
  private audioContext: AudioContext | null = null;
  private analysers: Map<string, AnalyserNode> = new Map();
  private speakingInterval: number | null = null;

  // ICE Candidate buffering
  private candidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();

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
  }

  public setConfig(newConfig: Partial<ProximityVoiceConfig>) {
    this.config = { ...this.config, ...newConfig };
    // Update panners with new config if applicable
    if (this.audioNodes) {
      for (const node of this.audioNodes.values()) {
        if (node.panner) {
          node.panner.refDistance = this.config.minDistance;
          node.panner.maxDistance = this.config.maxDistance;
          node.panner.rolloffFactor = this.config.rolloffFactor;
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

  public async toggleMic(): Promise<boolean> {
    if (this.isMicEnabled) {
      this.muteMic();
      return false;
    } else {
      const success = await this.enableMic();
      return success;
    }
  }

  private async enableMic(): Promise<boolean> {
    try {
      this.ensureAudioContext();

      if (!this.localStream) {
        // Request microphone permission on first enable
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.setupLocalAnalyser(this.localStream);
      } else {
        // Unmute existing stream
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }

      this.isMicEnabled = true;

      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
      }

      // Ensure all connected world members have the track attached
      const localId = this.networkManager.localPlayer?.id;
      for (const remoteId of this.networkManager.activeWorldPlayers.keys()) {
        if (remoteId !== localId) {
          const pc = this.getOrCreatePeerConnection(remoteId);
          const senders = pc.getSenders();
          const hasTrack = senders.some(sender => sender.track === audioTrack);
          if (!hasTrack && audioTrack) {
            pc.addTrack(audioTrack, this.localStream);
            await this.initiateCall(remoteId);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('[VoiceManager] Failed to get microphone access:', error);
      return false;
    }
  }

  private muteMic() {
    this.isMicEnabled = false;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }

    if (this.onSpeakingStateChange) {
      this.onSpeakingStateChange('local', false);
    }
  }

  private async handleWorldJoined(payload: { activePlayers: Array<{ id: string }> }) {
    const localId = this.networkManager.localPlayer?.id;
    if (payload.activePlayers) {
      for (const remote of payload.activePlayers) {
        if (remote.id !== localId) {
          await this.initiateCall(remote.id);
        }
      }
    }
  }

  private async handlePlayerJoined(payload: { player: { id: string } }) {
    if (payload.player.id === this.networkManager.localPlayer?.id) return;
    // Initiate WebRTC connection to new player (kept open throughout the world session)
    await this.initiateCall(payload.player.id);
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
  }

  private async initiateCall(targetId: string) {
    const pc = this.getOrCreatePeerConnection(targetId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.networkManager.sendWebRTCSignal(targetId, offer);
    } catch (err) {
      console.error('[VoiceManager] Error creating offer:', err);
    }
  }

  private async handleSignal(payload: { targetId: string; senderId?: string; signal: any }) {
    const { senderId, signal } = payload;
    if (!senderId) return;

    const pc = this.getOrCreatePeerConnection(senderId);

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        await this.flushCandidateQueue(senderId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.networkManager.sendWebRTCSignal(senderId, answer);
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        await this.flushCandidateQueue(senderId, pc);
      } else if (signal.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signal));
        } else {
          if (!this.candidateQueues.has(senderId)) {
            this.candidateQueues.set(senderId, []);
          }
          this.candidateQueues.get(senderId)!.push(signal);
        }
      }
    } catch (err) {
      console.error('[VoiceManager] Error handling signal:', err);
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

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.networkManager.sendWebRTCSignal(playerId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      let audio = this.remoteAudios.get(playerId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.muted = true; // Muted in DOM so Web Audio API handles spatial/proximity volume!
        document.body.appendChild(audio);
        this.remoteAudios.set(playerId, audio);
      }
      audio.srcObject = stream;
      audio.play().catch(e => console.warn('[VoiceManager] Autoplay error:', e));

      // Setup Web Audio spatialization and proximity pipeline
      this.setupAudioPipeline(playerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(playerId);
      }
    };

    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, this.localStream);
      }
    }

    this.peerConnections.set(playerId, pc);
    return pc;
  }

  private removePeer(playerId: string) {
    const pc = this.peerConnections.get(playerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(playerId);
    }

    const audio = this.remoteAudios.get(playerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      if (audio.parentElement) {
        audio.parentElement.removeChild(audio);
      }
      this.remoteAudios.delete(playerId);
    }

    this.cleanupAudioPipeline(playerId);
    this.candidateQueues.delete(playerId);

    if (this.onSpeakingStateChange) {
      this.onSpeakingStateChange(playerId, false);
    }
  }

  private ensureAudioContext() {
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
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
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

      // 1. Analyser on raw source (for accurate speaking indicator regardless of distance attenuation)
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      this.analysers.set(playerId, analyser);

      // 2. Gain node for smooth distance attenuation and mute
      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0.0, this.audioContext.currentTime);

      // 3. 3D Spatial Panner Node
      let panner: PannerNode | undefined = undefined;
      if (this.config.spatialAudioEnabled && this.audioContext.createPanner) {
        panner = this.audioContext.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'linear';
        panner.refDistance = this.config.minDistance;
        panner.maxDistance = this.config.maxDistance;
        panner.rolloffFactor = this.config.rolloffFactor;

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
    const currentTime = this.audioContext.currentTime;

    // 1. Update AudioListener position & orientation in 3D world space
    const listener = this.audioContext.listener;
    if (listener) {
      if (listener.positionX) {
        listener.positionX.setTargetAtTime(listenerPos.x, currentTime, 0.05);
        listener.positionY.setTargetAtTime(listenerPos.y, currentTime, 0.05);
        listener.positionZ.setTargetAtTime(listenerPos.z, currentTime, 0.05);
        listener.forwardX.setTargetAtTime(listenerForward.x, currentTime, 0.05);
        listener.forwardY.setTargetAtTime(listenerForward.y, currentTime, 0.05);
        listener.forwardZ.setTargetAtTime(listenerForward.z, currentTime, 0.05);
        listener.upX.setTargetAtTime(0, currentTime, 0.05);
        listener.upY.setTargetAtTime(1, currentTime, 0.05);
        listener.upZ.setTargetAtTime(0, currentTime, 0.05);
      } else if ((listener as any).setPosition) {
        (listener as any).setPosition(listenerPos.x, listenerPos.y, listenerPos.z);
        (listener as any).setOrientation(listenerForward.x, listenerForward.y, listenerForward.z, 0, 1, 0);
      }
    }

    // 2. Update proximity volume and 3D speaker position for each connected remote peer
    for (const [playerId, nodes] of this.audioNodes.entries()) {
      const speakerPos = speakerPositions.get(playerId);
      const distance = speakerPos ? listenerPos.distanceTo(speakerPos) : 9999;

      // Calculate proximity volume attenuation:
      // - 0 to 5m: 100% full volume
      // - 5 to 15m: gradually reduced
      // - 15 to 25m: low volume
      // - > 25m: 0.0 (completely inaudible)
      const targetVolume = calculateProximityVolume(distance, this.config);
      nodes.gain.gain.setTargetAtTime(targetVolume, currentTime, 0.06);

      // Update 3D spatial panner position
      if (nodes.panner && speakerPos && this.config.spatialAudioEnabled) {
        if (nodes.panner.positionX) {
          nodes.panner.positionX.setTargetAtTime(speakerPos.x, currentTime, 0.05);
          nodes.panner.positionY.setTargetAtTime(speakerPos.y, currentTime, 0.05);
          nodes.panner.positionZ.setTargetAtTime(speakerPos.z, currentTime, 0.05);
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
