import * as THREE from 'three';

export class CameraManager {
  public camera: THREE.PerspectiveCamera;
  private currentPosition: THREE.Vector3 = new THREE.Vector3();
  private currentLookat: THREE.Vector3 = new THREE.Vector3();

  // Orbital parameters
  private spherical: THREE.Spherical;
  private targetOffset: THREE.Vector3 = new THREE.Vector3(0, 1.5, 0);

  constructor(aspectRatio: number, container: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    this.spherical = new THREE.Spherical(6, Math.PI / 3, Math.PI); // distance, phi (polar), theta (azimuth)

    container.addEventListener('click', (e: MouseEvent) => {
      // Only request pointer lock on desktop/mouse click
      if ((e as any).pointerType === 'touch') return;
      if (!document.pointerLockElement && typeof document.body.requestPointerLock === 'function') {
        try {
          const promise = document.body.requestPointerLock() as any;
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
          }
        } catch {
          // Ignore pointer lock rejections
        }
      }
    });

    document.addEventListener('mousemove', this.onMouseMove.bind(this));
  }

  public rotate(deltaX: number, deltaY: number, sensitivity: number = 0.002) {
    this.spherical.theta -= deltaX * sensitivity;
    this.spherical.phi -= deltaY * sensitivity;

    // Clamp phi to prevent going upside down or under ground
    const epsilon = 0.1;
    this.spherical.phi = Math.max(epsilon, Math.min(Math.PI / 2 - epsilon, this.spherical.phi));
  }

  private onMouseMove(event: MouseEvent) {
    if (document.pointerLockElement !== document.body) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.rotate(movementX, movementY, 0.002);
  }

  public resize(aspectRatio: number) {
    this.camera.aspect = aspectRatio;
    this.camera.updateProjectionMatrix();
  }

  public setDistance(distance: number) {
    this.spherical.radius = THREE.MathUtils.lerp(this.spherical.radius, distance, 0.1);
  }

  public setOffset(offset: THREE.Vector3) {
    this.targetOffset.lerp(offset, 0.1);
  }

  public alignTheta(targetTheta: number, t: number) {
    // We need to lerp the angle properly to avoid spinning the wrong way
    let current = this.spherical.theta;
    // Normalize target to be within -PI to PI
    targetTheta = targetTheta % (Math.PI * 2);
    current = current % (Math.PI * 2);

    let diff = targetTheta - current;
    // Shortest path
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;

    this.spherical.theta += diff * t;
  }

  public getForwardVector(): THREE.Vector3 {
    // Camera's forward direction on the XZ plane
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    return forward;
  }

  public getRightVector(): THREE.Vector3 {
    // Camera's right direction on the XZ plane
    const right = new THREE.Vector3();
    const forward = this.getForwardVector();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    return right;
  }

  public update(targetPosition: THREE.Vector3, delta: number) {
    const idealLookat = new THREE.Vector3().copy(targetPosition).add(this.targetOffset);

    // Calculate ideal position based on spherical coordinates relative to target
    const idealOffset = new THREE.Vector3().setFromSpherical(this.spherical);
    const idealPosition = new THREE.Vector3().copy(idealLookat).add(idealOffset);

    // Smoothly interpolate camera position
    const t = 1.0 - Math.pow(0.001, delta);
    this.currentPosition.lerp(idealPosition, t);
    
    // For lookat, we also smoothly interpolate, but we snap if it's too far to avoid floaty feel
    this.currentLookat.lerp(idealLookat, t);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookat);
  }
}
