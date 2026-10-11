import { memo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { GEO, MAT, dampAngle, lampMaterial, paintMaterial } from './assets';
import { SelectedEdges, SelectionRing } from './SelectionMarker';

interface Props {
  id: string;
  x: number;
  z: number;
  rot: number;
  cabColor: string;
  statusColor: string;
  visible: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

const WHEELS: [number, number][] = [
  [-1.15, 3.3],
  [1.15, 3.3],
  [-1.15, -2.6],
  [1.15, -2.6],
  [-1.15, -1.5],
  [1.15, -1.5],
];

/** Low-poly box truck. Glides towards (x, z, rot) instead of snapping. */
export const TruckModel = memo(function TruckModel(p: Props) {
  const group = useRef<THREE.Group>(null);
  // Initial transform only: later moves are animated in useFrame, not via props.
  const [initial] = useState(() => ({ position: [p.x, 0, p.z] as [number, number, number], rot: p.rot }));
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && p.visible);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(dt, 0.1);
    g.position.x = THREE.MathUtils.damp(g.position.x, p.x, 1.6, d);
    g.position.z = THREE.MathUtils.damp(g.position.z, p.z, 1.6, d);
    g.rotation.y = dampAngle(g.rotation.y, p.rot, 3, d);
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 6) p.onSelect(p.id);
  };
  const outline = p.selected ? <SelectedEdges /> : null;

  return (
    <group
      ref={group}
      position={initial.position}
      rotation-y={initial.rot}
      visible={p.visible}
      onClick={p.visible ? click : undefined}
      onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
      onPointerOut={() => setHovered(false)}
    >
      {/* trailer */}
      <mesh geometry={GEO.box} material={MAT.trailer} position={[0, 2.15, -1.1]} scale={[2.5, 2.7, 6.6]} castShadow receiveShadow>
        {outline}
      </mesh>
      {/* chassis */}
      <mesh geometry={GEO.box} material={MAT.chassis} position={[0, 0.65, 0.2]} scale={[2.2, 0.35, 8.6]} castShadow>
        {outline}
      </mesh>
      {/* cab */}
      <mesh geometry={GEO.box} material={paintMaterial(p.cabColor)} position={[0, 1.75, 3.35]} scale={[2.4, 2.2, 1.9]} castShadow>
        {outline}
      </mesh>
      {/* windscreen */}
      <mesh geometry={GEO.box} material={MAT.forkliftDark} position={[0, 2.25, 4.31]} scale={[2.1, 0.8, 0.05]} />
      {/* status beacon */}
      <mesh geometry={GEO.lamp} material={lampMaterial(p.statusColor)} position={[0, 3.05, 3.35]} />
      {WHEELS.map(([wx, wz], i) => (
        <mesh key={i} geometry={GEO.wheel} material={MAT.tire} position={[wx, 0.5, wz]} />
      ))}
      {p.selected && <SelectionRing radius={5.6} />}
    </group>
  );
});
