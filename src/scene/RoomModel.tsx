import { memo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { POD } from '../data/layout';
import { GEO, MAT, lampMaterial } from './assets';
import { InstancedBoxes, type BoxSpec } from './InstancedBoxes';
import { SelectedEdges, SelectionRing } from './SelectionMarker';

interface Props {
  id: string;
  /** World position of the pod centre. */
  x: number;
  z: number;
  inSession: boolean;
  statusColor: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

const H = 3.2;
const HALF_W = POD.w / 2;
const HALF_D = POD.d / 2;

/** Desk rows facing the screen; seated cohort figures line up behind them. */
const DESKS: BoxSpec[] = [2.0, 0.4, -1.2, -2.8].flatMap((z) =>
  [-2.4, 0, 2.4].map((x): BoxSpec => ({ position: [x, 0.8, z], scale: [1.7, 0.08, 0.6] })),
);

/** Glass classroom pod in front of a training-centre entrance. */
export const RoomModel = memo(function RoomModel(p: Props) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

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
      {/* floor */}
      <mesh geometry={GEO.box} material={MAT.podFloor} position={[0, 0.1, 0]} scale={[POD.w, 0.2, POD.d]} receiveShadow>
        {outline}
      </mesh>
      {/* glass walls (open towards the building entrance) */}
      <mesh geometry={GEO.box} material={MAT.glass} position={[0, H / 2, HALF_D]} scale={[POD.w, H, 0.08]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={MAT.glass} position={[s * HALF_W, H / 2, 0]} scale={[0.08, H, POD.d]} />
      ))}
      {/* frame */}
      {[
        [-HALF_W, HALF_D],
        [HALF_W, HALF_D],
        [-HALF_W, -HALF_D],
        [HALF_W, -HALF_D],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={GEO.box} material={MAT.doorFrame} position={[x, H / 2, z]} scale={[0.18, H, 0.18]} castShadow>
          {outline}
        </mesh>
      ))}
      <mesh geometry={GEO.box} material={MAT.trim} position={[0, H, HALF_D]} scale={[POD.w + 0.2, 0.14, 0.2]}>
        {outline}
      </mesh>
      {/* lecture screen on the building side: lit while a class is in session */}
      <mesh
        geometry={GEO.box}
        material={p.inSession ? lampMaterial('#7cc4ff') : MAT.robotDark}
        position={[0, 1.9, -HALF_D + 0.35]}
        scale={[4.2, 1.9, 0.06]}
      />
      <InstancedBoxes boxes={DESKS} material={MAT.desk} />
      {/* status sign above the entrance */}
      <mesh geometry={GEO.box} material={lampMaterial(p.statusColor)} position={[0, H + 0.45, HALF_D + 0.05]} scale={[2.2, 0.4, 0.08]} />
      {p.selected && <SelectionRing radius={6.2} />}
    </group>
  );
});
