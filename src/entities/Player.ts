import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { CameraManager } from '../core/CameraManager';
import { SimplePhysics } from '../physics/SimplePhysics';
import { PlayerAnimator } from './PlayerAnimator';
import type { ControllableEntity } from './ControllableEntity';
import type { OBB2D } from '../physics/Collision2D';
import type { BaseVehicle } from './vehicles/BaseVehicle';

export type PlayerState = 'WALKING' | 'SITTING' | 'DRIVING';
export const PlayerState = {
  WALKING: 'WALKING' as const,
  SITTING: 'SITTING' as const,
  DRIVING: 'DRIVING' as const,
};

export class Player implements ControllableEntity {
  public mesh: THREE.Group;
  private animator: PlayerAnimator;
  
  private velocity: THREE.Vector3 = new THREE.Vector3();
  
  private walkSpeed: number = 8;
  private sprintSpeed: number = 18;
  private acceleration: number = 50;
  private deceleration: number = 40;
  private turnSpeed: number = 10;
  
  private isGrounded: boolean = false;
  private jumpForce: number = 12;
  private gravity: number = -25;
  private yVelocity: number = 0;
  private wasGrounded: boolean = false;

  public state: PlayerState = PlayerState.WALKING;
  public currentVehicle: BaseVehicle | null = null;
  public seatIndex: number = -1;
  private scene: THREE.Scene;

  public getAnimatorState(): string {
    return this.animator.currentState;
  }

  public getSpeed(): number {
    return this.velocity.length();
  }

  public getCollisionBox(): OBB2D {
    return {
      center: new THREE.Vector2(this.mesh.position.x, this.mesh.position.z),
      halfWidth: 0.5,
      halfLength: 0.5,
      rotation: this.mesh.rotation.y
    };
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const { group, animator } = this.createPlayerModel();
    this.mesh = group;
    this.animator = animator;
    
    this.mesh.position.y = 5; // Drop from a height
    scene.add(this.mesh);
  }

  private createPlayerModel(): { group: THREE.Group, animator: PlayerAnimator } {
    const group = new THREE.Group();
    
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const clothesMaterial = new THREE.MeshStandardMaterial({ color: 0x3366cc }); 
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

  public enterVehicle(vehicle: BaseVehicle, seatIndex: number) {
    this.state = PlayerState.DRIVING;
    this.currentVehicle = vehicle;
    this.seatIndex = seatIndex;
    vehicle.occupants.set(seatIndex, 'local');
    
    // Attach player to vehicle body (so they lean with it)
    this.mesh.removeFromParent();
    vehicle.getBody().add(this.mesh);
    
    const config = vehicle.getConfig();
    let seatPos = config.driverSeatPosition;
    if (seatIndex > 0 && config.passengerSeats && config.passengerSeats.length >= seatIndex) {
      seatPos = config.passengerSeats[seatIndex - 1];
    }

    this.mesh.position.copy(seatPos);
    this.mesh.rotation.set(0, Math.PI, 0);
    
    // Only hide driver/passengers if config says hideDriver and they are in the vehicle
    if (config.hideDriver) {
      this.mesh.visible = false;
    }
    
    this.animator.setState('SIT');
    this.velocity.set(0,0,0);
    this.yVelocity = 0;

    // If we are the driver, take local physics ownership of the vehicle
    if (seatIndex === 0) {
      vehicle.clearRemoteControl();
    }
  }

  public exitVehicle(safePosition: THREE.Vector3) {
    if (!this.currentVehicle) return;

    this.currentVehicle.occupants.delete(this.seatIndex);
    this.currentVehicle = null;
    this.seatIndex = -1;
    this.state = PlayerState.WALKING;
    
    this.mesh.removeFromParent();
    this.scene.add(this.mesh);
    this.mesh.visible = true;
    
    this.mesh.position.copy(safePosition);
    this.animator.setState('IDLE');
  }

  public update(delta: number, input: InputManager, cameraManager: CameraManager, physics: SimplePhysics) {
    if (this.state === PlayerState.DRIVING) {
      this.animator.setState('SIT');
      this.animator.update(delta, 0);
      return; // Skip walking logic
    }

    if (input.consumeInteract()) {
      if (this.state === PlayerState.SITTING) {
        this.state = PlayerState.WALKING;
      } else if (this.state === PlayerState.WALKING) {
        this.state = PlayerState.SITTING;
      }
    }

    if (this.state === PlayerState.SITTING) {
      this.animator.setState('SIT');
      this.animator.update(delta, 0);
      
      this.yVelocity += this.gravity * delta;
      this.mesh.position.y += this.yVelocity * delta;
      
      const groundHeight = physics.getGroundHeight(this.mesh.position);
      if (this.mesh.position.y <= groundHeight) {
        this.mesh.position.y = groundHeight;
        this.yVelocity = 0;
        this.isGrounded = true;
      }
      return; 
    }

    const inputVec = input.getMovementVector();
    const isSprinting = input.isSprinting();
    const isJumping = input.isJumping();

    if (input instanceof InputManager) {
      cameraManager.setDistance(6);
      cameraManager.setOffset(new THREE.Vector3(0, 1.5, 0));
    }

    const forwardVec = cameraManager.getForwardVector();
    const rightVec = cameraManager.getRightVector();
    
    const moveDirection = new THREE.Vector3();
    moveDirection.addScaledVector(forwardVec, inputVec.forward);
    moveDirection.addScaledVector(rightVec, inputVec.right);

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
    }

    const targetSpeed = (isSprinting && inputVec.forward > 0) ? this.sprintSpeed : this.walkSpeed;
    const targetVelocity = moveDirection.clone().multiplyScalar(targetSpeed * (moveDirection.lengthSq() > 0 ? 1 : 0));

    if (moveDirection.lengthSq() > 0) {
      this.velocity.lerp(targetVelocity, this.acceleration * delta);
    } else {
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), this.deceleration * delta);
    }

    const speed = this.velocity.length();
    if (speed > 0.1) {
      const targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
      let currentRotation = this.mesh.rotation.y;
      
      while (targetRotation - currentRotation > Math.PI) currentRotation += Math.PI * 2;
      while (targetRotation - currentRotation < -Math.PI) currentRotation -= Math.PI * 2;
      
      this.mesh.rotation.y = THREE.MathUtils.lerp(currentRotation, targetRotation, this.turnSpeed * delta);
    }

    if (this.isGrounded && isJumping) {
      this.yVelocity = this.jumpForce;
      this.isGrounded = false;
      this.animator.setState('JUMP');
    }

    this.yVelocity += this.gravity * delta;

    this.mesh.position.x += this.velocity.x * delta;
    this.mesh.position.y += this.yVelocity * delta;
    this.mesh.position.z += this.velocity.z * delta;

    const groundHeight = physics.getGroundHeight(this.mesh.position);
    this.wasGrounded = this.isGrounded;

    if (this.mesh.position.y <= groundHeight) {
      this.mesh.position.y = groundHeight;
      this.yVelocity = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      if (this.yVelocity > 0) {
        this.animator.setState('JUMP');
      } else {
        this.animator.setState('FALL');
      }
    } else {
      if (!this.wasGrounded && this.yVelocity < -10) {
        this.animator.setState('LAND');
      } else if (this.animator.currentState !== 'LAND') {
        if (speed > 0.1) {
          if (speed > this.walkSpeed + 1) {
            this.animator.setState('SPRINT');
          } else {
            this.animator.setState('WALK');
          }
        } else {
          this.animator.setState('IDLE');
        }
      }
    }

    this.animator.update(delta, speed);
  }
}
