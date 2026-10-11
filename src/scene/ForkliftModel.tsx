import { memo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { GEO, MAT, dampAngle, lampMaterial } from './assets';
import { SelectedEdges, SelectionRing } from './SelectionMarker';

interface Props {
  id: string;
  x: number;
  z: number;
  lifting: boolean;
  statusColor: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** Low-poly forklift. Drives at constant speed towards (x, z) and faces its heading. */
export const ForkliftModel = memo(function ForkliftModel(p: Props) {
  const group = useRef<THREE.Group>(null);
  const forks = useRef<THREE.Group>(null);
  // Initial position only: later moves are animated in useFrame, not via props.
  const [initial] = useState<[number, number, number]>(() => [p.x, 0.1, p.z]);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(dt, 0.1);
    const dx = p.x - g.position.x;
    const dz = p.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    // The sim moves up to 6 m per 2 s tick; drive slightly faster to keep up.
    const step = Math.min(dist, 3.6 * d);
    if (dist > 0.02) {
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      g.rotation.y = dampAngle(g.rotation.y, Math.atan2(dx, dz), 8, d);
    }
    if (forks.current) {
      const target = p.lifting ? 1.1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.9 : 0.15;
      forks.current.position.y = THREE.MathUtils.damp(forks.current.position.y, target, 3, d);
    }
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 6) p.onSelect(p.id);
  };
  const outline = p.selected ? <SelectedEdges /> : null;

  return (
    <group
      ref={group}
      position={initial}
      onClick={click}
      onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
      onPointerOut={() => setHovered(false)}
    >
      {/* body + counterweight */}
      <mesh geometry={GEO.box} material={MAT.forkliftBody} position={[0, 0.65, -0.1]} scale={[1.2, 0.8, 1.7]} castShadow>
        {outline}
      </mesh>
      <mesh geometry={GEO.box} material={MAT.forkliftDark} position={[0, 0.75, -0.95]} scale={[1.2, 0.9, 0.3]} castShadow />
      {/* overhead guard */}
      <mesh geometry={GEO.box} material={MAT.forkliftDark} position={[0, 2.05, -0.2]} scale={[1.15, 0.08, 1.2]} castShadow>
        {outline}
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} geometry={GEO.box} material={MAT.forkliftDark} position={[x, 1.55, 0.35]} scale={[0.08, 1.0, 0.08]} />
      ))}
      {/* mast */}
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} geometry={GEO.box} material={MAT.forkliftDark} position={[x, 1.3, 0.85]} scale={[0.1, 2.4, 0.12]} castShadow>
          {outline}
        </mesh>
      ))}
      {/* forks */}
      <group ref={forks} position={[0, 0.15, 0]}>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} geometry={GEO.box} material={MAT.forks} position={[x, 0, 1.45]} scale={[0.12, 0.06, 1.1]} castShadow />
        ))}
        <mesh geometry={GEO.box} material={MAT.forks} position={[0, 0.3, 0.92]} scale={[0.9, 0.6, 0.05]} />
      </group>
      {/* wheels */}
      {[
        [-0.62, 0.45],
        [0.62, 0.45],
        [-0.62, -0.6],
        [0.62, -0.6],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={GEO.wheel} material={MAT.tire} position={[x, 0.3, z]} scale={0.6} />
      ))}
      <mesh geometry={GEO.lamp} material={lampMaterial(p.statusColor)} position={[0, 2.25, -0.2]} scale={0.8} />
      {p.selected && <SelectionRing radius={1.9} />}
    </group>
  );
});
