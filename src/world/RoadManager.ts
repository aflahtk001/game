import * as THREE from 'three';

export class RoadManager {
  private roads: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.roads = new THREE.Group();
    scene.add(this.roads);

    this.createRoads();
  }

  private createRoads() {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
    });

    // Create a simple crossroad
    const roadGeometry1 = new THREE.PlaneGeometry(10, 200);
    const road1 = new THREE.Mesh(roadGeometry1, roadMaterial);
    road1.rotation.x = -Math.PI / 2;
    road1.position.y = 0.01; // Slightly above ground to prevent z-fighting
    road1.receiveShadow = true;
    this.roads.add(road1);

    const roadGeometry2 = new THREE.PlaneGeometry(200, 10);
    const road2 = new THREE.Mesh(roadGeometry2, roadMaterial);
    road2.rotation.x = -Math.PI / 2;
    road2.position.y = 0.01;
    road2.receiveShadow = true;
    this.roads.add(road2);
  }
}
