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
  assisting: boolean;
  statusColor: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** Low-poly teaching-assistant robot with a lifting tray for devices and kits. */
export const RobotModel = memo(function RobotModel(p: Props) {
  const group = useRef<THREE.Group>(null);
  const tray = useRef<THREE.Group>(null);
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
    if (tray.current) {
      const target = p.assisting ? 1.25 + Math.sin(state.clock.elapsedTime * 1.5) * 0.35 : 0.95;
      tray.current.position.y = THREE.MathUtils.damp(tray.current.position.y, target, 3, d);
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
      {/* drive base */}
      <mesh geometry={GEO.box} material={MAT.robotDark} position={[0, 0.3, 0]} scale={[1.2, 0.4, 1.4]} castShadow>
        {outline}
      </mesh>
      {/* torso */}
      <mesh geometry={GEO.box} material={MAT.robotShell} position={[0, 1.05, -0.25]} scale={[0.9, 1.1, 0.7]} castShadow>
        {outline}
      </mesh>
      {/* head with face screen */}
      <mesh geometry={GEO.box} material={MAT.robotShell} position={[0, 1.95, -0.25]} scale={[0.75, 0.55, 0.6]} castShadow>
        {outline}
      </mesh>
      <mesh geometry={GEO.box} material={lampMaterial(p.statusColor)} position={[0, 1.97, 0.06]} scale={[0.55, 0.3, 0.02]} />
      {/* lifting tray with a kit box */}
      <group ref={tray} position={[0, 0.95, 0]}>
        <mesh geometry={GEO.box} material={MAT.tray} position={[0, 0, 0.45]} scale={[1.0, 0.06, 0.7]} castShadow />
        <mesh geometry={GEO.box} material={MAT.trim} position={[0, 0.2, 0.45]} scale={[0.6, 0.34, 0.45]} castShadow />
      </group>
      {[
        [-0.62, 0.45],
        [0.62, 0.45],
        [-0.62, -0.45],
        [0.62, -0.45],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={GEO.wheel} material={MAT.tire} position={[x, 0.22, z]} scale={0.45} />
      ))}
      {p.selected && <SelectionRing radius={1.9} />}
    </group>
  );
});
