import * as THREE from 'three';

export class Terrain {
  public mesh: THREE.Mesh;

  constructor() {
    // Create a large ground plane
    const geometry = new THREE.PlaneGeometry(1000, 1000);
    
    // Grid texture for basic ground
    const gridTexture = this.createGridTexture();
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(100, 100);

    const material = new THREE.MeshStandardMaterial({
      map: gridTexture,
      color: 0x4a7a4a, // Greenish tint
      roughness: 0.8,
      metalness: 0.1
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
  }

  private createGridTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    if (context) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 512, 512);
      context.strokeStyle = '#cccccc';
      context.lineWidth = 4;
      
      for (let i = 0; i <= 512; i += 64) {
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, 512);
        context.stroke();
        
        context.beginPath();
        context.moveTo(0, i);
        context.lineTo(512, i);
        context.stroke();
      }
    }
    
    return new THREE.CanvasTexture(canvas);
  }
}
