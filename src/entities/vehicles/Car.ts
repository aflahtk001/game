import * as THREE from 'three';
import { BaseVehicle } from './BaseVehicle';
import type { VehicleConfig } from './VehicleConfig';

const carConfig: VehicleConfig = {
  maxSpeed: 25,
  acceleration: 12,
  brakingForce: 25,
  steeringSensitivity: 0.6,
  turnRadius: 8,
  weight: 30,
  numWheels: 4,
  collisionWidth: 2,
  collisionLength: 4,
  cameraDistance: 8,
  cameraHeight: 2.0,
  driverSeatPosition: new THREE.Vector3(-0.4, 0.5, 0.2), // Left seat
  passengerSeats: [
    new THREE.Vector3(0.4, 0.5, 0.2),  // Front right
    new THREE.Vector3(-0.4, 0.5, 1.0), // Back left
    new THREE.Vector3(0.4, 0.5, 1.0)   // Back right
  ],
  exitPosition: new THREE.Vector3(-2.0, 0, 0), // Left door
  hideDriver: true
};

export class Car extends BaseVehicle {
  constructor(scene: THREE.Scene, position: THREE.Vector3, id?: string) {
    super(scene, carConfig, id);
    this.mesh.position.copy(position);
  }

  protected createBody(): THREE.Object3D {
    const group = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000 }); // Red car
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 });

    // Main chassis (lower body)
    const chassisGeo = new THREE.BoxGeometry(2, 0.8, 4);
    const chassis = new THREE.Mesh(chassisGeo, bodyMaterial);
    chassis.position.y = 0.6; // Clear the ground (wheels are r=0.4)
    chassis.castShadow = true;
    group.add(chassis);

    // Cabin (upper body)
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.7, 2);
    const cabin = new THREE.Mesh(cabinGeo, glassMaterial);
    cabin.position.set(0, 1.35, -0.2); // Slightly offset backwards
    cabin.castShadow = true;
    group.add(cabin);

    return group;
  }

  protected createWheels(): THREE.Object3D[] {
    const wheels: THREE.Object3D[] = [];

    const positions = [
      new THREE.Vector3(-1.1, 0.4, -1.2), // Front Left
      new THREE.Vector3(1.1, 0.4, -1.2),  // Front Right
      new THREE.Vector3(-1.1, 0.4, 1.2),  // Back Left
      new THREE.Vector3(1.1, 0.4, 1.2)    // Back Right
    ];

    positions.forEach(pos => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Main tyre body — cylinder lying on X axis
      const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const tyreGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
      tyreGeo.rotateZ(Math.PI / 2);
      const tyre = new THREE.Mesh(tyreGeo, tyreMat);
      tyre.castShadow = true;
      group.add(tyre);

      // Visible tread stripe on one side cap so rolling is apparent
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
      const stripeGeo = new THREE.BoxGeometry(0.32, 0.05, 0.75);
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      // Offset stripe to one side (visible on the cap face)
      stripe.position.set(0, 0, 0);
      group.add(stripe);

      wheels.push(group);
    });

    return wheels;
  }
}
