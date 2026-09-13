import * as THREE from 'three';
import { Terrain } from './Terrain';
import { Environment } from './Environment';
import { RoadManager } from './RoadManager';

export class World {
  public terrain: Terrain;
  public environment: Environment;
  public roadManager: RoadManager;

  constructor(scene: THREE.Scene) {
    this.terrain = new Terrain();
    scene.add(this.terrain.mesh);

    this.environment = new Environment(scene);
    this.roadManager = new RoadManager(scene);
  }
}
