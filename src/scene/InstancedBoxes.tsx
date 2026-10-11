import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { GEO } from './assets';

export interface BoxSpec {
  position: [number, number, number];
  scale: [number, number, number];
}

/** Static, non-interactive meshes (boxes by default) drawn in a single instanced draw call. */
export function InstancedBoxes({
  boxes,
  material,
  geometry = GEO.box,
}: {
  boxes: BoxSpec[];
  material: THREE.Material;
  geometry?: THREE.BufferGeometry;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current!;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    boxes.forEach((b, i) => mesh.setMatrixAt(i, m.compose(p.set(...b.position), q, s.set(...b.scale))));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes, material, geometry]);

  return <instancedMesh ref={ref} args={[geometry, material, boxes.length]} raycast={() => null} />;
}
