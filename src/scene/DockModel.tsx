import { memo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { GEO, MAT, lampMaterial } from './assets';
import { SelectedEdges, SelectionRing } from './SelectionMarker';

interface Props {
  id: string;
  x: number;
  z: number;
  doorOpen: boolean;
  statusColor: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

const DOOR_W = 3.8;
const DOOR_H = 4.0;

/** Dock door in the wall plus the leveler platform in front of it. */
export const DockModel = memo(function DockModel(p: Props) {
  const door = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useFrame((_, dt) => {
    if (!door.current) return;
    const targetScale = p.doorOpen ? 0.15 : 1;
    const s = THREE.MathUtils.damp(door.current.scale.y, DOOR_H * targetScale, 4, Math.min(dt, 0.1));
    door.current.scale.y = s;
    door.current.position.y = DOOR_H - s / 2;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 6) p.onSelect(p.id);
  };
  const outline = p.selected ? <SelectedEdges /> : null;

  return (
    <group
      position={[p.x, 0, p.z]}
      onClick={click}
      onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
      onPointerOut={() => setHovered(false)}
    >
      {/* frame */}
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={GEO.box} material={MAT.doorFrame} position={[side * (DOOR_W / 2 + 0.2), 2.3, 0]} scale={[0.4, 4.6, 0.7]} castShadow>
          {outline}
        </mesh>
      ))}
      <mesh geometry={GEO.box} material={MAT.doorFrame} position={[0, 4.4, 0]} scale={[DOOR_W + 0.8, 0.4, 0.7]} castShadow>
        {outline}
      </mesh>
      {/* roller door */}
      <mesh ref={door} geometry={GEO.box} material={MAT.door} position={[0, DOOR_H / 2, 0]} scale={[DOOR_W, DOOR_H, 0.15]} />
      {/* leveler */}
      <mesh geometry={GEO.box} material={MAT.leveler} position={[0, 0.55, 0.9]} scale={[DOOR_W, 0.9, 1.3]} receiveShadow castShadow>
        {outline}
      </mesh>
      {/* bumper stripes */}
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={GEO.box} material={MAT.wallTrim} position={[side * 1.5, 0.6, 1.57]} scale={[0.5, 0.6, 0.06]} />
      ))}
      {/* status light */}
      <mesh geometry={GEO.lamp} material={lampMaterial(p.statusColor)} position={[0, 4.95, 0.3]} />
      {p.selected && <SelectionRing radius={3.2} />}
    </group>
  );
});
