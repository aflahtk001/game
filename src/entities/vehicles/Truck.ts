import * as THREE from 'three';
import { BaseVehicle } from './BaseVehicle';
import type { VehicleConfig } from './VehicleConfig';

const truckConfig: VehicleConfig = {
  maxSpeed: 22,
  acceleration: 10,
  brakingForce: 20,
  steeringSensitivity: 0.5,
  turnRadius: 12,
  weight: 60,
  numWheels: 4,
  collisionWidth: 2.2,
  collisionLength: 5.5,
  cameraDistance: 12,
  cameraHeight: 3.0,
  driverSeatPosition: new THREE.Vector3(-0.5, 1.5, -0.5), // Left side of cabin
  passengerSeats: [
    new THREE.Vector3(0.5, 1.5, -0.5) // Right side of cabin
  ],
  exitPosition: new THREE.Vector3(-2.2, 0, -0.5), // Left door
  hideDriver: true
};

export class Truck extends BaseVehicle {
  constructor(scene: THREE.Scene, position: THREE.Vector3, id?: string) {
    super(scene, truckConfig, id);
    this.mesh.position.copy(position);
  }

  protected createBody(): THREE.Object3D {
    const group = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xaa2222 }); // Dark red truck
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 }); // Dark bed
    
    // Main lower body
    const lowerBodyGeo = new THREE.BoxGeometry(2.0, 1.0, 5.0);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMaterial);
    lowerBody.position.y = 1.0; 
    lowerBody.castShadow = true;
    group.add(lowerBody);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(2.0, 1.2, 2.0);
    const cabin = new THREE.Mesh(cabinGeo, bodyMaterial);
    cabin.position.set(0, 2.1, -0.5); 
    cabin.castShadow = true;
    group.add(cabin);

    // Windows
    const windowGeo = new THREE.BoxGeometry(2.1, 0.8, 1.8);
    const windows = new THREE.Mesh(windowGeo, windowMaterial);
    windows.position.set(0, 2.1, -0.5);
    group.add(windows);

    // Truck bed inner (just a black box on top of rear lower body)
    const bedGeo = new THREE.BoxGeometry(1.8, 0.2, 2.2);
    const bed = new THREE.Mesh(bedGeo, bedMaterial);
    bed.position.set(0, 1.5, 1.3);
    group.add(bed);

    return group;
  }

  protected createWheels(): THREE.Object3D[] {
    const wheels: THREE.Object3D[] = [];
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const positions = [
      new THREE.Vector3(-1.0, 0.5, -1.8), // Front Left
      new THREE.Vector3(1.0, 0.5, -1.8),  // Front Right
      new THREE.Vector3(-1.0, 0.5, 1.8),  // Back Left
      new THREE.Vector3(1.0, 0.5, 1.8)    // Back Right
    ];

    positions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMaterial);
      wheel.position.copy(pos);
      wheel.castShadow = true;
      wheels.push(wheel);
    });

    return wheels;
  }
}
