import * as THREE from 'three';

export interface VehicleConfig {
  maxSpeed: number;
  acceleration: number;
  brakingForce: number;
  steeringSensitivity: number;
  turnRadius: number; // Modifies how fast it can turn based on speed
  weight: number;     // Impacts gravity and suspension
  numWheels: number;
  collisionWidth: number;
  collisionLength: number;
  cameraDistance?: number;
  cameraHeight?: number;
  driverSeatPosition: THREE.Vector3;
  passengerSeats?: THREE.Vector3[];
  exitPosition: THREE.Vector3;
  hideDriver?: boolean;
}
