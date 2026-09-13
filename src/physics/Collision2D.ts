import * as THREE from 'three';

export interface OBB2D {
  center: THREE.Vector2;
  halfWidth: number; // along X axis
  halfLength: number; // along Z axis
  rotation: number; // rotation around Y axis
}

export function getMTV(a: OBB2D, b: OBB2D): THREE.Vector2 | null {
  const axes: THREE.Vector2[] = [];
  
  const ca = Math.cos(a.rotation);
  const sa = Math.sin(a.rotation);
  axes.push(new THREE.Vector2(ca, -sa)); // local X
  axes.push(new THREE.Vector2(sa, ca));  // local Z
  
  const cb = Math.cos(b.rotation);
  const sb = Math.sin(b.rotation);
  axes.push(new THREE.Vector2(cb, -sb));
  axes.push(new THREE.Vector2(sb, cb));
  
  let minOverlap = Infinity;
  let smallestAxis = new THREE.Vector2();
  
  for (const axis of axes) {
    const projA = projectOBB(a, axis);
    const projB = projectOBB(b, axis);
    
    if (projA.max <= projB.min || projB.max <= projA.min) {
      return null;
    }
    
    const overlap1 = projA.max - projB.min;
    const overlap2 = projB.max - projA.min;
    const overlap = Math.min(overlap1, overlap2);
    
    if (overlap < minOverlap) {
      minOverlap = overlap;
      smallestAxis = axis.clone();
      
      const centerVec = new THREE.Vector2().subVectors(b.center, a.center);
      if (smallestAxis.dot(centerVec) < 0) {
        smallestAxis.negate();
      }
    }
  }
  
  return smallestAxis.multiplyScalar(minOverlap);
}

function projectOBB(obb: OBB2D, axis: THREE.Vector2): { min: number, max: number } {
  const c = Math.cos(obb.rotation);
  const s = Math.sin(obb.rotation);
  const localX = new THREE.Vector2(c, -s);
  const localZ = new THREE.Vector2(s, c);
  
  const centerProj = obb.center.dot(axis);
  const rProj = Math.abs(localX.dot(axis)) * obb.halfWidth;
  const fProj = Math.abs(localZ.dot(axis)) * obb.halfLength;
  
  const extents = rProj + fProj;
  return { min: centerProj - extents, max: centerProj + extents };
}
