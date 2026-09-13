import * as THREE from 'three';
import type { ControllableEntity } from '../ControllableEntity';
import { InputManager } from '../../core/InputManager';
import { CameraManager } from '../../core/CameraManager';
import { SimplePhysics } from '../../physics/SimplePhysics';
import type { VehicleConfig } from './VehicleConfig';
import type { OBB2D } from '../../physics/Collision2D';

export abstract class BaseVehicle implements ControllableEntity {
  public mesh: THREE.Group;
  protected config: VehicleConfig;

  // Physics state
  protected velocity: THREE.Vector3 = new THREE.Vector3();
  protected speed: number = 0;
  protected steeringAngle: number = 0;
  protected yVelocity: number = 0;
  protected isGrounded: boolean = false;

  public id: string;
  public occupants: Map<number, string> = new Map(); // seatIndex -> playerId

  // Visuals
  protected wheels: THREE.Object3D[] = [];
  protected body: THREE.Object3D;

  public getConfig(): VehicleConfig {
    return this.config;
  }

  public getBody(): THREE.Object3D {
    return this.body;
  }

  constructor(scene: THREE.Scene, config: VehicleConfig, id: string = Math.random().toString(36).substr(2, 9)) {
    this.id = id;
    this.config = config;
    this.mesh = new THREE.Group();
    
    // Abstract methods to build visual models
    this.body = this.createBody();
    this.mesh.add(this.body);

    this.wheels = this.createWheels();
    this.wheels.forEach(wheel => {
      wheel.rotation.order = 'YXZ'; // Y for steering, X for rolling
      this.mesh.add(wheel);
    });

    scene.add(this.mesh);
  }

  public getCollisionBox(): OBB2D {
    return {
      center: new THREE.Vector2(this.mesh.position.x, this.mesh.position.z),
      halfWidth: this.config.collisionWidth / 2,
      halfLength: this.config.collisionLength / 2,
      rotation: this.mesh.rotation.y
    };
  }

  protected abstract createBody(): THREE.Object3D;
  protected abstract createWheels(): THREE.Object3D[];

  /** Set by RemotePlayer when this vehicle is driven by a remote player (driver is not local) */
  public isRemoteControlled: boolean = false;

  // -- Network interpolation state --
  // The latest authoritative position/rotation received from the network (our DR target)
  private _netPos: THREE.Vector3 = new THREE.Vector3();
  private _netRotY: number = 0;
  // Extra-smooth anchor used by the passenger camera — lags slightly behind the mesh
  private _camAnchor: THREE.Vector3 = new THREE.Vector3();
  private _camAnchorInitialised: boolean = false;

  /**
   * Called each time a driver state packet arrives from the network (≈20 Hz).
   * We store the authoritative state as a target; dead-reckoning advances it each frame.
   */
  public syncRemoteState(position: THREE.Vector3, rotationY: number, speed: number, steeringAngle: number) {
    if (!this.isRemoteControlled) {
      // First sync — hard-snap so there's no startup lerp artefact
      this.mesh.position.copy(position);
      this.mesh.rotation.y = rotationY;
      this._camAnchor.copy(position);
      this._camAnchorInitialised = true;
    }
    this.isRemoteControlled = true;
    this.speed = speed;
    this.steeringAngle = steeringAngle;

    // Store as authoritative target (dead-reckoning will advance this each frame)
    this._netPos.copy(position);
    this._netRotY = rotationY;
  }

  public clearRemoteControl() {
    this.isRemoteControlled = false;
    this._camAnchorInitialised = false;
  }

  /** Smooth position for the passenger camera — never jitters. */
  public getCameraAnchor(): THREE.Vector3 {
    return this._camAnchor;
  }

  public getSpeed() { return this.speed; }
  public getSteeringAngle() { return this.steeringAngle; }

  // Allow subclasses to perform extra logic (like motorcycle lean)
  protected onUpdate(_delta: number, _speed: number, _steeringAngle: number) {}

  public update(delta: number, input: InputManager, _cameraManager: CameraManager, physics: SimplePhysics) {
    // ── Remote-controlled path (passenger is watching a driver on another machine) ──────
    if (this.isRemoteControlled) {
      // 1. Dead reckoning: advance the authoritative target by the vehicle's own speed
      //    This keeps it moving smoothly between network ticks (≈50 ms apart).
      const forward = new THREE.Vector3(0, 0, -1)
        .applyEuler(new THREE.Euler(0, this._netRotY, 0));
      this._netPos.addScaledVector(forward, this.speed * delta);

      // Also advance rotation based on steering
      const steerEffect = Math.min(1.0, Math.abs(this.speed) / 5);
      this._netRotY += this.steeringAngle * steerEffect * (this.speed / this.config.turnRadius) * delta;

      // 2. Smoothly converge mesh toward the dead-reckoned target
      //    Use exponential decay so convergence speed is frame-rate independent.
      //    τ = 1/12 s → reaches 99% in ~0.4 s — fast enough to track but no snap.
      const meshT = 1 - Math.exp(-12 * delta);
      this.mesh.position.lerp(this._netPos, meshT);

      // Shortest-path rotation lerp
      let rotDiff = this._netRotY - this.mesh.rotation.y;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      this.mesh.rotation.y += rotDiff * meshT;

      // 3. Camera anchor: extra smooth (τ = 1/6 s) so the camera never sees mesh jitter.
      if (!this._camAnchorInitialised) {
        this._camAnchor.copy(this.mesh.position);
        this._camAnchorInitialised = true;
      }
      const camT = 1 - Math.exp(-6 * delta);
      this._camAnchor.lerp(this.mesh.position, camT);

      // 4. Animate wheels and subclass effects
      this.updateWheels(delta);
      this.onUpdate(delta, this.speed, this.steeringAngle);
      return;
    }

    // 1. Get input
    const inputVec = input.getMovementVector();
    
    // 2. Acceleration & Braking
    if (inputVec.forward !== 0) {
      this.speed += inputVec.forward * this.config.acceleration * delta;
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 2);
    }

    if (inputVec.forward < 0 && this.speed > 0) {
      this.speed -= this.config.brakingForce * delta;
    }

    this.speed = Math.max(-this.config.maxSpeed * 0.3, Math.min(this.config.maxSpeed, this.speed));

    // 3. Steering
    const steeringEffectiveness = Math.min(1.0, Math.abs(this.speed) / 5);
    const targetSteering = -inputVec.right * this.config.steeringSensitivity;
    this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, targetSteering, delta * 5);
    
    const turnAmount = this.steeringAngle * steeringEffectiveness * (this.speed / this.config.turnRadius) * delta;
    this.mesh.rotation.y += turnAmount;

    // 4. Movement along local -Z forward axis
    const forwardVec = new THREE.Vector3(0, 0, -1);
    forwardVec.applyEuler(this.mesh.rotation);
    this.velocity.copy(forwardVec).multiplyScalar(this.speed);

    // 5. Gravity
    this.yVelocity -= this.config.weight * delta;
    
    this.mesh.position.x += this.velocity.x * delta;
    this.mesh.position.y += this.yVelocity * delta;
    this.mesh.position.z += this.velocity.z * delta;

    // 6. Ground Collision
    const groundHeight = physics.getGroundHeight(this.mesh.position);
    if (this.mesh.position.y <= groundHeight) {
      this.mesh.position.y = groundHeight;
      this.yVelocity = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // 7. Update Wheels
    this.updateWheels(delta);

    // 8. Custom Subclass Update
    this.onUpdate(delta, this.speed, this.steeringAngle);

    // 9. Camera Update (driver only)
    if (input instanceof InputManager) {
      const distance = this.config.cameraDistance || 10;
      const height = this.config.cameraHeight || 2.0;
      _cameraManager.setDistance(distance);
      _cameraManager.setOffset(new THREE.Vector3(0, height, 0));

      if (Math.abs(this.speed) > 2.0) {
        const targetTheta = this.speed > 0 ? this.mesh.rotation.y : this.mesh.rotation.y + Math.PI;
        _cameraManager.alignTheta(targetTheta, delta * 3);
      }
    }
  }

  private updateWheels(delta: number) {
    // After wheelGeo.rotateZ(PI/2), the cylinder's long axis (and axle) points along X.
    // Rolling the tyre on its axle = rotating around X.
    // Steering (front wheels pivoting left/right) = rotating around Y, applied first (YXZ order).
    const wheelRadius = 0.4;
    const wheelCircumference = 2 * Math.PI * wheelRadius;
    const rotationsPerSecond = Math.abs(this.speed) / wheelCircumference;
    // Negative sign: moving forward (-Z) means the bottom of the tyre moves backward → positive X rotation
    const rollDelta = (this.speed >= 0 ? 1 : -1) * rotationsPerSecond * Math.PI * 2 * delta;

    this.wheels.forEach((wheel, index) => {
      // Roll: rotate around X (the axle)
      wheel.rotation.x += rollDelta;

      // Steer front wheels around Y (applied before X in YXZ order)
      const isFrontWheel = this.wheels.length > 2 ? index < 2 : index < 1;
      if (isFrontWheel) {
        wheel.rotation.y = THREE.MathUtils.lerp(wheel.rotation.y, this.steeringAngle, 0.3);
      }
    });
  }
}

