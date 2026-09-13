import * as THREE from 'three';
import { InputManager } from './core/InputManager';
import { CameraManager } from './core/CameraManager';
import { World } from './world/World';
import { Player, PlayerState } from './entities/Player';
import { VehicleManager } from './entities/VehicleManager';
import type { ControllableEntity } from './entities/ControllableEntity';
import { SimplePhysics } from './physics/SimplePhysics';
import { getMTV } from './physics/Collision2D';
import { UIManager } from './ui/UIManager';
import { InteractionManager } from './core/InteractionManager';
import { NetworkManager } from './network/NetworkManager';
import { JoinScreenUI } from './ui/JoinScreenUI';
import { GlobalWorldHUD } from './ui/GlobalWorldHUD';
import { ChatUI } from './ui/ChatUI';
import { RemotePlayerManager } from './entities/RemotePlayerManager';
import { VoiceManager } from './network/VoiceManager';
import { VoiceUI } from './ui/VoiceUI';

export class Game {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private lastTime: number = 0;

  public inputManager: InputManager;
  public cameraManager: CameraManager;
  public physics: SimplePhysics;
  public world: World;
  
  public player: Player;
  public vehicleManager: VehicleManager;
  public uiManager: UIManager;
  public interactionManager: InteractionManager;
  public networkManager: NetworkManager;
  public joinScreenUI: JoinScreenUI;
  public worldHUD: GlobalWorldHUD;
  public chatUI: ChatUI;
  public voiceManager: VoiceManager;
  public voiceUI: VoiceUI;
  public remotePlayerManager: RemotePlayerManager;

  constructor(container: HTMLElement) {
    this.container = container;

    // Core Setup
    this.scene = new THREE.Scene();
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.lastTime = performance.now();

    // Systems
    this.inputManager = new InputManager();
    this.cameraManager = new CameraManager(window.innerWidth / window.innerHeight, this.container);
    this.physics = new SimplePhysics();
    this.uiManager = new UIManager();

    // Networking & UI Setup
    this.networkManager = new NetworkManager();
    this.joinScreenUI = new JoinScreenUI(this.networkManager);
    this.worldHUD = new GlobalWorldHUD(this.networkManager);
    this.chatUI = new ChatUI(this.networkManager);
    this.voiceManager = new VoiceManager(this.networkManager);
    this.voiceUI = new VoiceUI(this.voiceManager);
    
    // Wire up VoiceUI to player list updates from NetworkManager
    this.networkManager.on('world_joined', () => this.updateVoiceUI());
    this.networkManager.on('player_joined', () => this.updateVoiceUI());
    this.networkManager.on('player_left', () => this.updateVoiceUI());
    this.networkManager.on('session_left', () => this.voiceUI.updatePlayerList([]));
    this.networkManager.on('identified', () => this.updateVoiceUI());

    // Wire up speaking state to 3D avatar overhead name tag and Voice UI
    this.voiceManager.setSpeakingStateCallback((playerId, isSpeaking) => {
      const rp = playerId !== 'local' ? this.remotePlayerManager?.getPlayer(playerId) : undefined;
      this.voiceUI.updateSpeakingState(playerId, isSpeaking, rp?.displayName);
      if (playerId !== 'local') {
        this.remotePlayerManager?.setPlayerSpeaking(playerId, isSpeaking);
      }
    });

    // Wire up real-time mic status updates from network state
    this.networkManager.on('update_state', (payload) => {
      if (payload && payload.players) {
        for (const [playerId, state] of Object.entries(payload.players)) {
          if (playerId !== this.networkManager.localPlayer?.id && state.isMicOn !== undefined) {
            const rp = this.remotePlayerManager?.getPlayer(playerId);
            this.voiceUI.setPlayerMicStatus(playerId, state.isMicOn, rp?.displayName);
          }
        }
      }
    });

    this.networkManager.connect();

    // World & Entities
    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.vehicleManager = new VehicleManager(this.scene);
    this.remotePlayerManager = new RemotePlayerManager(this.scene, this.networkManager, this.vehicleManager);

    this.interactionManager = new InteractionManager(
      this.player, 
      this.vehicleManager.getVehicles(), 
      this.uiManager, 
      this.physics
    );

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private onWindowResize() {
    this.cameraManager.resize(window.innerWidth / window.innerHeight);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private updateVoiceUI() {
    const localId = this.networkManager.localPlayer?.id;
    const localName = this.networkManager.localPlayer?.displayName || 'You';

    const list: { id: string; name: string; isLocal?: boolean }[] = [];
    const addedIds = new Set<string>();
    
    // 1. Add local player first
    list.push({
      id: 'local',
      name: localName,
      isLocal: true
    });
    if (localId) addedIds.add(localId);

    // 2. Add active world players from NetworkManager
    for (const [remoteId, remote] of this.networkManager.activeWorldPlayers.entries()) {
      if (remoteId !== localId && !addedIds.has(remoteId)) {
        list.push({
          id: remoteId,
          name: remote.displayName || `Player_${remoteId.substring(0, 4)}`,
          isLocal: false
        });
        addedIds.add(remoteId);
      }
    }

    // 3. Fallback: Add any spawned remote players from world
    if (this.remotePlayerManager) {
      for (const [rpId, rp] of this.remotePlayerManager.getAllPlayers().entries()) {
        if (!addedIds.has(rpId)) {
          list.push({
            id: rpId,
            name: rp.displayName || `Player_${rpId.substring(0, 4)}`,
            isLocal: false
          });
          addedIds.add(rpId);
        }
      }
    }

    this.voiceUI.updatePlayerList(list);
  }

  public start() {
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  private animate() {
    const time = performance.now();
    const delta = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Update interactions (Enter/Exit)
    this.interactionManager.update(delta, this.inputManager);

    const isDriving = this.player.state === PlayerState.DRIVING;
    const currentVehicle = this.player.currentVehicle;

    // Update Player (always receives real input so they can control camera/exit, but ignores movement if driving)
    this.player.update(delta, this.inputManager, this.cameraManager, this.physics);

    // Only pass the currentVehicle to VehicleManager if the local player is the DRIVER (seat 0).
    // Passengers should not process local vehicle physics inputs (otherwise they fight the driver's synced state).
    const activeVehicle = (this.player.currentVehicle && this.player.seatIndex === 0) ? this.player.currentVehicle : null;
    this.vehicleManager.update(delta, this.physics, this.inputManager, this.cameraManager, activeVehicle);

    // Resolve Collisions between entities
    this.resolveCollisions();

    // Update Camera & HUD
    if (isDriving && currentVehicle) {
      const isPassenger = this.player.seatIndex !== 0;

      if (isPassenger) {
        // ── Passenger camera ──────────────────────────────────────────────────────
        // Use the double-smoothed camera anchor so the camera never sees network jitter.
        // The anchor is already lagged behind the mesh, giving buttery-smooth following.
        this.cameraManager.update(currentVehicle.getCameraAnchor(), delta);

        const config = currentVehicle.getConfig();
        this.cameraManager.setDistance(config.cameraDistance || 10);
        this.cameraManager.setOffset(new THREE.Vector3(0, config.cameraHeight || 2.0, 0));
        // Align camera behind the vehicle (use mesh rotation — already smoothed)
        this.cameraManager.alignTheta(currentVehicle.mesh.rotation.y, delta * 3);
      } else {
        // ── Driver camera ─────────────────────────────────────────────────────────
        this.cameraManager.update(currentVehicle.mesh.position, delta);
      }

      this.uiManager.setHUDVisible(true);

      // Passengers: dead-zone small synced speeds to avoid idle vibration
      const rawSpeed = (currentVehicle as any).speed as number;
      const displaySpeed = !isPassenger ? rawSpeed : (Math.abs(rawSpeed) < 1.0 ? 0 : rawSpeed);
      this.uiManager.updateHUD(displaySpeed);
    } else {
      this.cameraManager.update(this.player.mesh.position, delta);
      this.uiManager.setHUDVisible(false);
    }

    // Multiplayer update
    this.remotePlayerManager.update(delta);

    // ── Update Proximity & 3D Spatial Voice Audio ────────────────────────────
    const listenerPos = new THREE.Vector3();
    this.player.mesh.getWorldPosition(listenerPos);
    const listenerForward = new THREE.Vector3();
    this.cameraManager.camera.getWorldDirection(listenerForward);

    const speakerPositions = new Map<string, THREE.Vector3>();
    for (const [rpId, rp] of this.remotePlayerManager.getAllPlayers().entries()) {
      const spkPos = new THREE.Vector3();
      rp.mesh.getWorldPosition(spkPos);
      speakerPositions.set(rpId, spkPos);
      const dist = listenerPos.distanceTo(spkPos);
      this.voiceUI.setPlayerDistance(rpId, dist);
    }

    this.voiceManager.updateSpatialAudio(listenerPos, listenerForward, speakerPositions);

    // Broadcast local state if in world
    if (this.networkManager.isConnected && (this.networkManager.isInWorld || this.networkManager.currentSession)) {
      let vehicleState = undefined;
      let seatIndex = undefined;
      let vehicleId = null;

      if (this.player.currentVehicle) {
        vehicleId = this.player.currentVehicle.id;
        seatIndex = this.player.seatIndex;

        // Driver is authoritative over the vehicle's position
        if (seatIndex === 0) {
          vehicleState = {
            position: {
              x: this.player.currentVehicle.mesh.position.x,
              y: this.player.currentVehicle.mesh.position.y,
              z: this.player.currentVehicle.mesh.position.z
            },
            rotationY: this.player.currentVehicle.mesh.rotation.y,
            speed: this.player.currentVehicle.getSpeed(),
            steeringAngle: this.player.currentVehicle.getSteeringAngle()
          };
        }
      }

      this.networkManager.sendPlayerState({
        position: {
          x: listenerPos.x,
          y: listenerPos.y,
          z: listenerPos.z
        },
        rotation: {
          y: this.player.mesh.rotation.y
        },
        velocityLength: this.player.getSpeed(),
        animatorState: this.player.getAnimatorState(),
        isDriving: this.player.state === 'DRIVING',
        vehicleId,
        seatIndex,
        vehicleState,
        isMicOn: this.voiceManager.isMicEnabled
      });
    }

    // Render
    this.renderer.render(this.scene, this.cameraManager.camera);
  }

  private resolveCollisions() {
    const physicalEntities: ControllableEntity[] = [...this.vehicleManager.getVehicles()];
    
    // Only collide player if they are walking around (not driving)
    if (this.player.state !== PlayerState.DRIVING) {
      physicalEntities.push(this.player);
    }

    // SAT OBB collision on the XZ plane
    for (let i = 0; i < physicalEntities.length; i++) {
      for (let j = i + 1; j < physicalEntities.length; j++) {
        const a = physicalEntities[i];
        const b = physicalEntities[j];

        const boxA = a.getCollisionBox();
        const boxB = b.getCollisionBox();

        const mtv = getMTV(boxA, boxB);
        if (mtv) {
          // Push them apart along the MTV
          a.mesh.position.x -= mtv.x * 0.5;
          a.mesh.position.z -= mtv.y * 0.5;
          
          b.mesh.position.x += mtv.x * 0.5;
          b.mesh.position.z += mtv.y * 0.5;
        }
      }
    }
  }
}
