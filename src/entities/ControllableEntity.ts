import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { CameraManager } from '../core/CameraManager';
import { SimplePhysics } from '../physics/SimplePhysics';

import type { OBB2D } from '../physics/Collision2D';

export interface ControllableEntity {
  mesh: THREE.Object3D;
  update(delta: number, input: InputManager, cameraManager: CameraManager, physics: SimplePhysics): void;
  getCollisionBox(): OBB2D;
}
