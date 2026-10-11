import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { SELECT_RING } from './assets';
import { ACCENT } from '../theme';

/** Amber edge outline; drop inside any selected box mesh. */
export function SelectedEdges() {
  return <Edges color={ACCENT} lineWidth={2.5} threshold={20} renderOrder={10} />;
}

/** Pulsing ground ring under a selected object. */
export function SelectionRing({ radius }: { radius: number }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = radius * (1 + 0.08 * Math.sin(clock.elapsedTime * 4));
    ring.current.scale.set(s, 1, s);
  });
  return (
    <mesh ref={ring} geometry={SELECT_RING} position-y={0.15} raycast={() => null}>
      <meshBasicMaterial color={ACCENT} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
