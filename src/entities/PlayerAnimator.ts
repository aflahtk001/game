import * as THREE from 'three';

export type PlayerState = 
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'SPRINT'
  | 'JUMP'
  | 'FALL'
  | 'LAND'
  | 'SIT';

export class PlayerAnimator {
  private head: THREE.Object3D;
  private leftArm: THREE.Object3D;
  private rightArm: THREE.Object3D;
  private leftLeg: THREE.Object3D;
  private rightLeg: THREE.Object3D;
  private torso: THREE.Object3D;

  public currentState: PlayerState = 'IDLE';
  private animationTime: number = 0;
  private landTimer: number = 0;

  constructor(parts: {
    head: THREE.Object3D,
    leftArm: THREE.Object3D,
    rightArm: THREE.Object3D,
    leftLeg: THREE.Object3D,
    rightLeg: THREE.Object3D,
    torso: THREE.Object3D
  }) {
    this.head = parts.head;
    this.leftArm = parts.leftArm;
    this.rightArm = parts.rightArm;
    this.leftLeg = parts.leftLeg;
    this.rightLeg = parts.rightLeg;
    this.torso = parts.torso;

  }

  public setState(newState: PlayerState) {
    if (this.currentState !== newState) {
      this.currentState = newState;
      if (newState === 'LAND') {
        this.landTimer = 0.2; // 200ms landing animation
      }
      
      // Reset parts if entering certain states
      if (newState === 'SIT') {
        this.resetPose();
      }
    }
  }

  private resetPose() {
    const parts = [this.head, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg, this.torso];
    parts.forEach(part => {
      part.rotation.set(0, 0, 0);
      part.position.set(part.position.x, part.userData.originalY || part.position.y, part.position.z);
    });
  }

  public update(delta: number, speed: number) {
    this.animationTime += delta;

    switch (this.currentState) {
      case 'IDLE':
        this.animateIdle(delta);
        break;
      case 'WALK':
      case 'RUN':
      case 'SPRINT':
        this.animateMove(delta, speed);
        break;
      case 'JUMP':
        this.animateJump(delta);
        break;
      case 'FALL':
        this.animateFall(delta);
        break;
      case 'LAND':
        this.animateLand(delta);
        break;
      case 'SIT':
        this.animateSit(delta);
        break;
    }
  }

  private animateIdle(delta: number) {
    // Gentle breathing effect
    const breathe = Math.sin(this.animationTime * 2) * 0.05;
    
    // Smoothly return torso, head and arms to neutral Y
    this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, (this.torso.userData.originalY || 1.5) + breathe, delta * 5);
    this.head.position.y = THREE.MathUtils.lerp(this.head.position.y, (this.head.userData.originalY || 2.25) + breathe, delta * 5);
    this.leftArm.position.y = THREE.MathUtils.lerp(this.leftArm.position.y, this.leftArm.userData.originalY || 1.9, delta * 5);
    this.rightArm.position.y = THREE.MathUtils.lerp(this.rightArm.position.y, this.rightArm.userData.originalY || 1.9, delta * 5);
    this.leftLeg.position.y = THREE.MathUtils.lerp(this.leftLeg.position.y, this.leftLeg.userData.originalY || 1.0, delta * 5);
    this.rightLeg.position.y = THREE.MathUtils.lerp(this.rightLeg.position.y, this.rightLeg.userData.originalY || 1.0, delta * 5);
    
    // Smoothly return arms and legs to neutral rotation
    this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 5);
    this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 5);
    this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, 0, delta * 5);
    this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0, delta * 5);
    
    this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 5);
    this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 5);
    this.leftLeg.rotation.z = THREE.MathUtils.lerp(this.leftLeg.rotation.z, 0, delta * 5);
    this.rightLeg.rotation.z = THREE.MathUtils.lerp(this.rightLeg.rotation.z, 0, delta * 5);
  }

  private animateMove(delta: number, _speed: number) {
    let freq = 10;
    let amp = 0.5;

    if (this.currentState === 'WALK') {
      freq = 8; amp = 0.4;
    } else if (this.currentState === 'SPRINT') {
      freq = 15; amp = 0.8;
    }

    const sin = Math.sin(this.animationTime * freq);
    
    // Arms and legs swing opposite
    this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, sin * amp, delta * 10);
    this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -sin * amp, delta * 10);
    this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, 0, delta * 10);
    this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0, delta * 10);
    
    this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, -sin * amp, delta * 10);
    this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, sin * amp, delta * 10);
    this.leftLeg.rotation.z = THREE.MathUtils.lerp(this.leftLeg.rotation.z, 0, delta * 10);
    this.rightLeg.rotation.z = THREE.MathUtils.lerp(this.rightLeg.rotation.z, 0, delta * 10);

    // Torso bounce
    const bounce = Math.abs(Math.sin(this.animationTime * freq)) * 0.1;
    this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, (this.torso.userData.originalY || 1.5) + bounce, delta * 10);
    this.head.position.y = THREE.MathUtils.lerp(this.head.position.y, (this.head.userData.originalY || 2.25) + bounce, delta * 10);
    
    // Ensure arms and legs return to neutral Y
    this.leftArm.position.y = THREE.MathUtils.lerp(this.leftArm.position.y, this.leftArm.userData.originalY || 1.9, delta * 10);
    this.rightArm.position.y = THREE.MathUtils.lerp(this.rightArm.position.y, this.rightArm.userData.originalY || 1.9, delta * 10);
    this.leftLeg.position.y = THREE.MathUtils.lerp(this.leftLeg.position.y, this.leftLeg.userData.originalY || 1.0, delta * 10);
    this.rightLeg.position.y = THREE.MathUtils.lerp(this.rightLeg.position.y, this.rightLeg.userData.originalY || 1.0, delta * 10);
  }

  private animateJump(delta: number) {
    // Arms swing forward and up (-X is forward)
    this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, -Math.PI / 2, delta * 15);
    this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -Math.PI / 2, delta * 15);
    // Legs bend back slightly (+X is backward)
    this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, Math.PI / 8, delta * 15);
    this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, Math.PI / 8, delta * 15);
  }

  private animateFall(delta: number) {
    // Arms flail forward and outward
    this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, -Math.PI / 4, delta * 10);
    this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -Math.PI / 4, delta * 10);
    this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, -Math.PI / 4, delta * 10);
    this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, Math.PI / 4, delta * 10);
    
    // Legs flail backward and outward
    this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, Math.PI / 8, delta * 10);
    this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, Math.PI / 8, delta * 10);
    this.leftLeg.rotation.z = THREE.MathUtils.lerp(this.leftLeg.rotation.z, -Math.PI / 16, delta * 10);
    this.rightLeg.rotation.z = THREE.MathUtils.lerp(this.rightLeg.rotation.z, Math.PI / 16, delta * 10);
  }

  private animateLand(delta: number) {
    this.landTimer -= delta;
    
    // Crouch slightly
    this.torso.position.y = (this.torso.userData.originalY || 1.0) - 0.2;
    this.head.position.y = (this.head.userData.originalY || 1.75) - 0.2;
    
    this.leftLeg.rotation.x = Math.PI / 8;
    this.rightLeg.rotation.x = Math.PI / 8;

    if (this.landTimer <= 0) {
      this.setState('IDLE');
    }
  }

  private animateSit(delta: number) {
    // Sit pose
    this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, -Math.PI / 2, delta * 5);
    this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, -Math.PI / 2, delta * 5);
    
    this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 5);
    this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 5);
    this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, 0, delta * 5);
    this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0, delta * 5);

    // Lower everything by ~0.8 to sit on the ground
    this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, 0.7, delta * 5);
    this.head.position.y = THREE.MathUtils.lerp(this.head.position.y, 1.45, delta * 5);
    this.leftArm.position.y = THREE.MathUtils.lerp(this.leftArm.position.y, 1.1, delta * 5);
    this.rightArm.position.y = THREE.MathUtils.lerp(this.rightArm.position.y, 1.1, delta * 5);
    this.leftLeg.position.y = THREE.MathUtils.lerp(this.leftLeg.position.y, 0.2, delta * 5);
    this.rightLeg.position.y = THREE.MathUtils.lerp(this.rightLeg.position.y, 0.2, delta * 5);
  }
}
