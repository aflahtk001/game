import * as THREE from 'three';
import { BaseVehicle } from './vehicles/BaseVehicle';
import { Car } from './vehicles/Car';
import { Truck } from './vehicles/Truck';
import { Bus } from './vehicles/Bus';
import { Motorcycle } from './vehicles/Motorcycle';
import { SimplePhysics } from '../physics/SimplePhysics';
import { InputManager } from '../core/InputManager';
import { CameraManager } from '../core/CameraManager';

export class VehicleManager {
  private vehicles: BaseVehicle[] = [];

  constructor(scene: THREE.Scene) {
    // Spawn test vehicles with fixed IDs so they sync easily across clients
    this.vehicles.push(new Car(scene, new THREE.Vector3(5, 5, -10), 'car_1'));
    this.vehicles.push(new Motorcycle(scene, new THREE.Vector3(0, 5, -10), 'moto_1'));
    this.vehicles.push(new Truck(scene, new THREE.Vector3(10, 5, -10), 'truck_1'));
    this.vehicles.push(new Bus(scene, new THREE.Vector3(-8, 5, -10), 'bus_1'));
  }

  public getVehicles(): BaseVehicle[] {
    return this.vehicles;
  }

  public getVehicle(id: string): BaseVehicle | undefined {
    return this.vehicles.find(v => v.id === id);
  }

  public update(delta: number, physics: SimplePhysics, inputManager: InputManager, cameraManager: CameraManager, possessedEntity: any) {
    // We need to update all vehicles.
    // If a vehicle is not possessed, it should still be updated (gravity, friction) but without receiving input
    
    // We will create a dummy input manager that returns 0 for non-possessed vehicles
    // A simpler way: BaseVehicle's update takes inputManager. If possessed, pass real one, else pass a dummy one.
    
    const dummyInput = {
      getMovementVector: () => ({ forward: 0, right: 0 }),
    } as unknown as InputManager;

    this.vehicles.forEach(vehicle => {
      if (vehicle === possessedEntity) {
        vehicle.update(delta, inputManager, cameraManager, physics);
      } else {
        vehicle.update(delta, dummyInput, cameraManager, physics);
      }
    });
  }
}
