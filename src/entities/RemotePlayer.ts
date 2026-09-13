import * as THREE from 'three';
import { PlayerAnimator } from './PlayerAnimator';
import type { PlayerState as AnimatorState } from './PlayerAnimator';
import type { PlayerStatePayload } from '../network/networkTypes';

export class RemotePlayer {
  public mesh: THREE.Group;
  private animator: PlayerAnimator;
  public playerId: string;
  public displayName: string;
  private scene: THREE.Scene;
  private vehicleManager: import('./VehicleManager').VehicleManager;

  // Network targets for interpolation
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetRotationY: number = 0;
  private currentAnimatorState: string = 'IDLE';
  private targetSpeed: number = 0;

  // Name tag
  private nameSprite: THREE.Sprite;

  constructor(scene: THREE.Scene, playerId: string, displayName: string, vehicleManager: import('./VehicleManager').VehicleManager) {
    this.scene = scene;
    this.playerId = playerId;
    this.displayName = displayName;
    this.vehicleManager = vehicleManager;

    const { group, animator } = this.createPlayerModel();
    this.mesh = group;
    this.animator = animator;
    
    // Add name tag
    this.nameSprite = this.createNameSprite();
    this.nameSprite.position.y = 3.0; // Above head
    this.mesh.add(this.nameSprite);

    this.scene.add(this.mesh);
  }

  private createPlayerModel(): { group: THREE.Group, animator: PlayerAnimator } {
    const group = new THREE.Group();
    
    // Slight color variation for remote players to distinguish them easily (optional)
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const clothesMaterial = new THREE.MeshStandardMaterial({ color: 0xcc3333 }); // Reddish shirt for remotes
    const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    
    const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const head = new THREE.Mesh(headGeometry, skinMaterial);
    head.position.y = 2.25;
    head.castShadow = true;
    group.add(head);

    const torsoGeometry = new THREE.BoxGeometry(0.8, 1, 0.4);
    const torso = new THREE.Mesh(torsoGeometry, clothesMaterial);
    torso.position.y = 1.5;
    torso.castShadow = true;
    group.add(torso);

    const armGeo = new THREE.BoxGeometry(0.3, 1, 0.3);
    const leftArm = new THREE.Mesh(armGeo, skinMaterial);
    leftArm.position.set(0, -0.4, 0); 
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(0.6, 1.9, 0); 
    leftArmPivot.add(leftArm);
    group.add(leftArmPivot);

    const rightArm = new THREE.Mesh(armGeo, skinMaterial);
    rightArm.position.set(0, -0.4, 0); 
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(-0.6, 1.9, 0); 
    rightArmPivot.add(rightArm);
    group.add(rightArmPivot);

    const legGeo = new THREE.BoxGeometry(0.35, 1, 0.35);
    const leftLeg = new THREE.Mesh(legGeo, pantsMaterial);
    leftLeg.position.set(0, -0.5, 0); 
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(0.2, 1.0, 0); 
    leftLegPivot.add(leftLeg);
    group.add(leftLegPivot);

    const rightLeg = new THREE.Mesh(legGeo, pantsMaterial);
    rightLeg.position.set(0, -0.5, 0); 
    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(-0.2, 1.0, 0); 
    rightLegPivot.add(rightLeg);
    group.add(rightLegPivot);

    const animator = new PlayerAnimator({
      head, torso, leftArm: leftArmPivot, rightArm: rightArmPivot, leftLeg: leftLegPivot, rightLeg: rightLegPivot
    });

    return { group, animator };
  }

  private nameCanvas: HTMLCanvasElement | null = null;
  private nameTexture: THREE.CanvasTexture | null = null;
  public isMicOn: boolean = false;
  public isSpeaking: boolean = false;

  private createNameSprite(): THREE.Sprite {
    this.nameCanvas = document.createElement('canvas');
    this.nameCanvas.width = 256;
    this.nameCanvas.height = 64;
    this.nameTexture = new THREE.CanvasTexture(this.nameCanvas);
    const material = new THREE.SpriteMaterial({ map: this.nameTexture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 1, 1);
    sprite.renderOrder = 999; // Ensure name tag renders on top

    this.updateNameTag();
    return sprite;
  }

  public updateNameTag(isSpeaking?: boolean, isMicOn?: boolean) {
    if (isSpeaking !== undefined) this.isSpeaking = isSpeaking;
    if (isMicOn !== undefined) this.isMicOn = isMicOn;

    if (!this.nameCanvas || !this.nameTexture) return;
    const ctx = this.nameCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.nameCanvas.width, this.nameCanvas.height);
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';

    let icon = this.isMicOn ? '🎙️' : '🔇';
    let text = `${icon} ${this.displayName}`;

    if (this.isSpeaking) {
      text = `🔊 ${this.displayName}`;
      ctx.fillStyle = '#4ade80';
      ctx.strokeStyle = '#064e3b';
    } else {
      ctx.fillStyle = this.isMicOn ? '#ffffff' : '#94a3b8';
      ctx.strokeStyle = '#0f172a';
    }

    ctx.lineWidth = 4;
    ctx.strokeText(text, 128, 40);
    ctx.fillText(text, 128, 40);

    this.nameTexture.needsUpdate = true;
  }

  // Track which vehicle+seat this remote player currently occupies so we can clean up
  private _occupiedVehicleId: string | null = null;
  private _occupiedSeatIndex: number = -1;

  public setTargetState(state: PlayerStatePayload) {
    this.targetPosition.set(state.position.x, state.position.y, state.position.z);
    
    // Calculate shortest rotation path
    let currentRot = this.mesh.rotation.y;
    let targetRot = state.rotation.y;
    while (targetRot - currentRot > Math.PI) currentRot += Math.PI * 2;
    while (targetRot - currentRot < -Math.PI) currentRot -= Math.PI * 2;
    this.mesh.rotation.y = currentRot;
    this.targetRotationY = targetRot;

    this.currentAnimatorState = state.animatorState;
    this.targetSpeed = state.velocityLength;

    if (state.isMicOn !== undefined && state.isMicOn !== this.isMicOn) {
      this.updateNameTag(undefined, state.isMicOn);
    }
    
    if (state.isDriving && state.vehicleId) {
      const vehicle = this.vehicleManager.getVehicle(state.vehicleId);
      if (vehicle) {
        const seatIndex = state.seatIndex ?? 0;

        // ----- Update occupants map -----
        // Clear previous seat if we switched vehicle or seat
        if (this._occupiedVehicleId && (this._occupiedVehicleId !== state.vehicleId || this._occupiedSeatIndex !== seatIndex)) {
          const oldVehicle = this.vehicleManager.getVehicle(this._occupiedVehicleId);
          if (oldVehicle) oldVehicle.occupants.delete(this._occupiedSeatIndex);
        }
        vehicle.occupants.set(seatIndex, this.playerId);
        this._occupiedVehicleId = state.vehicleId;
        this._occupiedSeatIndex = seatIndex;

        // Sync vehicle physics if this remote player is the driver
        if (seatIndex === 0 && state.vehicleState) {
          const vs = state.vehicleState;
          vehicle.syncRemoteState(
            new THREE.Vector3(vs.position.x, vs.position.y, vs.position.z),
            vs.rotationY,
            vs.speed,
            vs.steeringAngle
          );
        }

        // Attach remote player mesh to vehicle body
        if (this.mesh.parent !== vehicle.getBody()) {
          this.mesh.removeFromParent();
          vehicle.getBody().add(this.mesh);
        }

        const config = vehicle.getConfig();
        let seatPos = config.driverSeatPosition;
        if (seatIndex > 0 && config.passengerSeats && config.passengerSeats.length >= seatIndex) {
          seatPos = config.passengerSeats[seatIndex - 1];
        }

        this.mesh.position.copy(seatPos);
        this.mesh.rotation.set(0, Math.PI, 0);

        this.mesh.visible = !config.hideDriver;
      }
    } else {
      // Remote player exited vehicle — clear their seat
      if (this._occupiedVehicleId) {
        const oldVehicle = this.vehicleManager.getVehicle(this._occupiedVehicleId);
        if (oldVehicle) {
          oldVehicle.occupants.delete(this._occupiedSeatIndex);
          // If the seat was driver seat, release remote physics control
          if (this._occupiedSeatIndex === 0) oldVehicle.clearRemoteControl();
        }
        this._occupiedVehicleId = null;
        this._occupiedSeatIndex = -1;
      }

      if (this.mesh.parent !== this.scene) {
        this.mesh.removeFromParent();
        this.scene.add(this.mesh);
      }
      this.mesh.visible = true;
    }
  }

  public update(delta: number) {
    // Only interpolate position and rotation if not attached to a vehicle
    if (this.mesh.parent === this.scene) {
      this.mesh.position.lerp(this.targetPosition, delta * 10);
      this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, this.targetRotationY, delta * 12);
    }

    // Update Animator
    this.animator.setState(this.currentAnimatorState as AnimatorState);
    this.animator.update(delta, this.targetSpeed);
  }

  public destroy() {
    // Release vehicle seat if still occupied
    if (this._occupiedVehicleId) {
      const vehicle = this.vehicleManager.getVehicle(this._occupiedVehicleId);
      if (vehicle) {
        vehicle.occupants.delete(this._occupiedSeatIndex);
        if (this._occupiedSeatIndex === 0) vehicle.clearRemoteControl();
      }
    }
    this.mesh.removeFromParent();
  }
}
