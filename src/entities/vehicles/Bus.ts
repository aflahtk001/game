import * as THREE from 'three';
import { BaseVehicle } from './BaseVehicle';
import type { VehicleConfig } from './VehicleConfig';

const busConfig: VehicleConfig = {
  maxSpeed: 25,
  acceleration: 8,  // Slow acceleration
  brakingForce: 15, // Takes longer to stop
  steeringSensitivity: 0.4, // Sluggish steering
  turnRadius: 15,   // Very wide turns
  weight: 100,      // Heavy
  numWheels: 6,
  collisionWidth: 2.8,
  collisionLength: 9.2,
  cameraDistance: 15,
  cameraHeight: 4.0,
  driverSeatPosition: new THREE.Vector3(-0.8, 2.5, -3.0), // Front left
  passengerSeats: [
    new THREE.Vector3(0.8, 2.5, -3.0), // Front right
    new THREE.Vector3(-0.8, 2.5, -1.0),
    new THREE.Vector3(0.8, 2.5, -1.0),
    new THREE.Vector3(-0.8, 2.5, 1.0),
    new THREE.Vector3(0.8, 2.5, 1.0),
    new THREE.Vector3(-0.8, 2.5, 3.0),
    new THREE.Vector3(0.8, 2.5, 3.0),
  ],
  exitPosition: new THREE.Vector3(-2.5, 0, -3.0), // Front left door
  hideDriver: true
};

export class Bus extends BaseVehicle {
  constructor(scene: THREE.Scene, position: THREE.Vector3, id?: string) {
    super(scene, busConfig, id);
    this.mesh.position.copy(position);
  }

  protected createBody(): THREE.Object3D {
    const group = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xeeee22 }); // Yellow bus
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 }); 
    
    // Main body
    const bodyGeo = new THREE.BoxGeometry(2.5, 3.5, 9);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
    bodyMesh.position.y = 2.0; // Clear the ground
    bodyMesh.castShadow = true;
    group.add(bodyMesh);
    
    // Simple side windows representation
    const windowGeo = new THREE.BoxGeometry(2.6, 1.0, 7);
    const windows = new THREE.Mesh(windowGeo, windowMaterial);
    windows.position.y = 2.5;
    group.add(windows);

    return group;
  }

  protected createWheels(): THREE.Object3D[] {
    const wheels: THREE.Object3D[] = [];
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const positions = [
      new THREE.Vector3(-1.3, 0.5, -3.5), // Front Left
      new THREE.Vector3(1.3, 0.5, -3.5),  // Front Right
      new THREE.Vector3(-1.3, 0.5, 1.5),  // Mid Left
      new THREE.Vector3(1.3, 0.5, 1.5),   // Mid Right
      new THREE.Vector3(-1.3, 0.5, 3.5),  // Back Left
      new THREE.Vector3(1.3, 0.5, 3.5)    // Back Right
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
