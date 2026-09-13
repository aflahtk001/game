import * as THREE from 'three';
import { BaseVehicle } from './BaseVehicle';
import type { VehicleConfig } from './VehicleConfig';

const motorcycleConfig: VehicleConfig = {
  maxSpeed: 28,
  acceleration: 15,
  brakingForce: 30,
  steeringSensitivity: 0.8,
  turnRadius: 6,
  weight: 15,
  numWheels: 2,
  collisionWidth: 1.0,
  collisionLength: 2.4,
  cameraDistance: 6,
  cameraHeight: 1.8,
  driverSeatPosition: new THREE.Vector3(0, 0.4, -0.1),
  passengerSeats: [
    new THREE.Vector3(0, 0.5, 0.4)
  ],
  exitPosition: new THREE.Vector3(-1.2, 0, 0),
  hideDriver: false // Driver is visible sitting on bike
};

export class Motorcycle extends BaseVehicle {
  constructor(scene: THREE.Scene, position: THREE.Vector3, id?: string) {
    super(scene, motorcycleConfig, id);
    this.mesh.position.copy(position);
  }

  protected createBody(): THREE.Object3D {
    const group = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
    const paintMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3 }); // Vibrant green sportbike
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 0.8 });

    // Main Frame / Engine block
    const engineGeo = new THREE.BoxGeometry(0.5, 0.5, 1.0);
    const engine = new THREE.Mesh(engineGeo, frameMat);
    engine.position.set(0, 0.6, 0);
    engine.castShadow = true;
    group.add(engine);

    // Fuel Tank / Fairing
    const tankGeo = new THREE.BoxGeometry(0.45, 0.35, 0.8);
    const tank = new THREE.Mesh(tankGeo, paintMat);
    tank.position.set(0, 0.95, -0.3);
    tank.castShadow = true;
    group.add(tank);

    // Seat
    const seatGeo = new THREE.BoxGeometry(0.4, 0.15, 0.7);
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 0.9, 0.3);
    seat.castShadow = true;
    group.add(seat);

    // Handlebars
    const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
    barGeo.rotateZ(Math.PI / 2);
    const bars = new THREE.Mesh(barGeo, chromeMat);
    bars.position.set(0, 1.2, -0.6);
    bars.castShadow = true;
    group.add(bars);

    // Headlight
    const lightGeo = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(0, 1.05, -0.75);
    group.add(light);

    // Exhaust pipe
    const pipeGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);
    pipeGeo.rotateX(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, chromeMat);
    pipe.position.set(0.3, 0.4, 0.4);
    group.add(pipe);

    return group;
  }

  protected createWheels(): THREE.Object3D[] {
    const wheels: THREE.Object3D[] = [];
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });

    // Front & Back Wheels
    const positions = [
      new THREE.Vector3(0, 0.35, -0.9), // Front
      new THREE.Vector3(0, 0.35, 0.9)    // Rear
    ];

    positions.forEach(pos => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.copy(pos);

      // Tyre
      const tyreGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.18, 16);
      tyreGeo.rotateZ(Math.PI / 2);
      const tyre = new THREE.Mesh(tyreGeo, tyreMat);
      tyre.castShadow = true;
      wheelGroup.add(tyre);

      // Rim
      const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 8);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(rim);

      wheels.push(wheelGroup);
    });

    return wheels;
  }

  // Motorcycle dynamic leaning when steering
  protected onUpdate(delta: number, speed: number, steeringAngle: number): void {
    const steerEffect = Math.min(1.0, Math.abs(speed) / 5);
    const targetLean = -(steeringAngle * steerEffect) * 0.4; // Lean into the turn
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, targetLean, delta * 8);
  }
}
