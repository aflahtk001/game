import * as THREE from 'three';
import { Player, PlayerState } from '../entities/Player';
import { BaseVehicle } from '../entities/vehicles/BaseVehicle';
import { UIManager } from '../ui/UIManager';
import { InputManager } from './InputManager';
import { SimplePhysics } from '../physics/SimplePhysics';
import { getMTV } from '../physics/Collision2D';
import type { OBB2D } from '../physics/Collision2D';

import { isMobileDevice } from '../utils/deviceUtils';

export class InteractionManager {
  private player: Player;
  private vehicles: BaseVehicle[];
  private uiManager: UIManager;
  private physics: SimplePhysics;
  
  private interactCooldown: number = 0;
  private INTERACTION_RADIUS = 4.0;

  constructor(player: Player, vehicles: BaseVehicle[], uiManager: UIManager, physics: SimplePhysics) {
    this.player = player;
    this.vehicles = vehicles;
    this.uiManager = uiManager;
    this.physics = physics;
  }

  public update(delta: number, inputManager: InputManager) {
    if (this.interactCooldown > 0) {
      this.interactCooldown -= delta;
    }

    if (this.player.state === PlayerState.DRIVING) {
      if (inputManager.consumeInteract() && this.interactCooldown <= 0) {
        this.exitVehicle();
        this.interactCooldown = 1.0; // 1 second cooldown
      }
    } else {
      let closestVehicle: BaseVehicle | null = null;
      let minDistance = Infinity;

      for (const vehicle of this.vehicles) {
        // Ensure we check distance to world position
        const vehiclePos = new THREE.Vector3();
        vehicle.mesh.getWorldPosition(vehiclePos);

        const dist = this.player.mesh.position.distanceTo(vehiclePos);
        if (dist < this.INTERACTION_RADIUS && dist < minDistance) {
          minDistance = dist;
          closestVehicle = vehicle;
        }
      }

      if (closestVehicle) {
        const isMobile = isMobileDevice();
        const config = closestVehicle.getConfig();
        const maxSeats = 1 + (config.passengerSeats ? config.passengerSeats.length : 0);
        const hasDriver = closestVehicle.occupants.has(0);
        
        let firstEmptyPassengerSeat = -1;
        for (let i = 1; i < maxSeats; i++) {
          if (!closestVehicle.occupants.has(i)) {
            firstEmptyPassengerSeat = i;
            break;
          }
        }

        if (hasDriver) {
          if (firstEmptyPassengerSeat !== -1) {
            const prompt = isMobile ? "Tap 🚪 Ride (Passenger)" : "Press E to Enter (Passenger)";
            this.uiManager.showInteractionPrompt(prompt);
            if (inputManager.consumeInteract() && this.interactCooldown <= 0) {
              this.player.enterVehicle(closestVehicle, firstEmptyPassengerSeat);
              this.uiManager.hideInteractionPrompt();
              this.interactCooldown = 1.0;
            }
          } else {
            this.uiManager.hideInteractionPrompt(); // Full
          }
        } else {
          if (firstEmptyPassengerSeat !== -1) {
            const prompt = isMobile ? "Tap 🚗 Drive | 🚪 Ride" : "Press E to Drive | F to Enter";
            this.uiManager.showInteractionPrompt(prompt);
            if (inputManager.consumeInteract() && this.interactCooldown <= 0) {
              this.player.enterVehicle(closestVehicle, 0); // Driver
              this.uiManager.hideInteractionPrompt();
              this.interactCooldown = 1.0;
            } else if (inputManager.consumePassengerEnter() && this.interactCooldown <= 0) {
              this.player.enterVehicle(closestVehicle, firstEmptyPassengerSeat); // Passenger
              this.uiManager.hideInteractionPrompt();
              this.interactCooldown = 1.0;
            }
          } else {
            const prompt = isMobile ? "Tap 🚗 Drive" : "Press E to Drive";
            this.uiManager.showInteractionPrompt(prompt);
            if (inputManager.consumeInteract() && this.interactCooldown <= 0) {
              this.player.enterVehicle(closestVehicle, 0); // Driver
              this.uiManager.hideInteractionPrompt();
              this.interactCooldown = 1.0;
            }
          }
        }
      } else {
        this.uiManager.hideInteractionPrompt();
      }
    }
  }

  private exitVehicle() {
    if (!this.player.currentVehicle) return;

    const vehicle = this.player.currentVehicle;
    const config = vehicle.getConfig();
    
    // Try multiple exit positions (Left door, Right door, Back, Front)
    const offsets = [
      config.exitPosition.clone(), // Primary
      new THREE.Vector3(-config.exitPosition.x, config.exitPosition.y, config.exitPosition.z), // Opposite side
      new THREE.Vector3(0, 0, config.collisionLength / 2 + 1), // Behind
      new THREE.Vector3(0, 0, -config.collisionLength / 2 - 1) // In front
    ];

    let safeWorldPos = new THREE.Vector3();
    let foundSafe = false;

    for (const offset of offsets) {
      const worldPos = vehicle.mesh.localToWorld(offset.clone());
      worldPos.y = this.physics.getGroundHeight(worldPos) + 0.1;

      // Mock player OBB at this position to check collisions
      const testOBB: OBB2D = {
        center: new THREE.Vector2(worldPos.x, worldPos.z),
        halfWidth: 0.5,
        halfLength: 0.5,
        rotation: 0
      };

      let isBlocked = false;
      for (const otherVehicle of this.vehicles) {
        if (getMTV(testOBB, otherVehicle.getCollisionBox()) !== null) {
          isBlocked = true;
          break;
        }
      }

      if (!isBlocked) {
        safeWorldPos = worldPos;
        foundSafe = true;
        break;
      }
    }

    if (!foundSafe) {
      // Fallback if completely surrounded (e.g., spawn on top)
      safeWorldPos = vehicle.mesh.position.clone();
      safeWorldPos.y += 3.0; 
    }
    
    this.player.exitVehicle(safeWorldPos);
    this.uiManager.hideInteractionPrompt();
  }
}
