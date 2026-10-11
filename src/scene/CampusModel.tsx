import { memo, useEffect, useMemo } from 'react';
import {
  BUILDING,
  CHARGER,
  FRONT_Z,
  LOBBY_Z,
  LOUNGE_X,
  LOUNGE_Z,
  PREP_ZONE,
  ROOM_COUNT,
  WALKWAY_Z,
  roomX,
} from '../data/layout';
import type { Campus } from '../data/types';
import { GEO, MAT, labelTexture, lampMaterial } from './assets';
import { InstancedBoxes, type BoxSpec } from './InstancedBoxes';

interface Props {
  campus: Campus;
  active: boolean;
}

const B = BUILDING;
const BW = B.maxX - B.minX;
const BD = B.maxZ - B.minZ;
const DOOR_GAP = 4.2;
const WALL_H = 4.6;

const P = PREP_ZONE;
const MARKINGS: BoxSpec[] = [
  ...[P.minZ, P.maxZ].map((z): BoxSpec => ({ position: [(P.minX + P.maxX) / 2, 0.12, z], scale: [P.maxX - P.minX, 0.02, 0.15] })),
  ...[P.minX, P.maxX].map((x): BoxSpec => ({ position: [x, 0.12, (P.minZ + P.maxZ) / 2], scale: [0.15, 0.02, P.maxZ - P.minZ] })),
  // walkway edge lines and lobby queue line
  ...[WALKWAY_Z - 4.4, WALKWAY_Z + 4.4].map((z): BoxSpec => ({ position: [6, 0.13, z], scale: [BW + 30, 0.02, 0.12] })),
  { position: [-3, 0.1, LOBBY_Z - 2.6], scale: [52, 0.02, 0.1] },
];

/** Lounge benches where classes on a break gather. */
const BENCHES: BoxSpec[] = Array.from({ length: 4 }, (_, i): BoxSpec => ({
  position: [LOUNGE_X + 3.2, 0.45, LOUNGE_Z + i * 5],
  scale: [0.8, 0.5, 3.2],
}));

/** Static shell of one campus: training centre, entrances, lobby, walkway, labels. */
export const CampusModel = memo(function CampusModel({ campus, active }: Props) {
  // Front wall segments between the entrances.
  const edges = [B.minX, ...Array.from({ length: ROOM_COUNT }, (_, i) => roomX(i)), B.maxX];
  const segments = edges.slice(0, -1).map((from, i) => {
    const a = i === 0 ? from : from + DOOR_GAP / 2;
    const b = i === edges.length - 2 ? edges[i + 1] : edges[i + 1] - DOOR_GAP / 2;
    return { x: (a + b) / 2, w: b - a };
  });

  const label = useMemo(() => {
    const texture = labelTexture(campus.code, campus.name, active);
    return { texture, aspect: texture.image.width / texture.image.height };
  }, [campus.code, campus.name, active]);
  useEffect(() => () => label.texture.dispose(), [label]);

  return (
    <group position={[campus.origin.x, 0, campus.origin.z]}>
      {/* campus ground */}
      <mesh geometry={GEO.box} material={MAT.lot} position={[6, 0.04, 8]} scale={[BW + 32, 0.08, 72]} receiveShadow />
      {/* training centre floor */}
      <mesh geometry={GEO.box} material={MAT.slab} position={[(B.minX + B.maxX) / 2, 0.05, (B.minZ + B.maxZ) / 2]} scale={[BW, 0.1, BD]} receiveShadow />

      {/* cut-away walls: low on three sides, full height on the entrance side */}
      <mesh geometry={GEO.box} material={MAT.wall} position={[0, 0.8, B.minZ]} scale={[BW, 1.6, 0.4]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={MAT.wall} position={[B.minX, 0.8, (B.minZ + B.maxZ) / 2]} scale={[0.4, 1.6, BD]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={MAT.wall} position={[B.maxX, 0.8, (B.minZ + B.maxZ) / 2]} scale={[0.4, 1.6, BD]} castShadow receiveShadow />
      {segments.map((s, i) => (
        <mesh key={i} geometry={GEO.box} material={MAT.wall} position={[s.x, WALL_H / 2, FRONT_Z]} scale={[s.w, WALL_H, 0.5]} castShadow receiveShadow />
      ))}
      <mesh geometry={GEO.box} material={MAT.trim} position={[0, WALL_H + 0.08, FRONT_Z]} scale={[BW, 0.16, 0.55]} />

      {/* practice prep zone */}
      <mesh position={[(P.minX + P.maxX) / 2, 0.12, (P.minZ + P.maxZ) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[P.maxX - P.minX, P.maxZ - P.minZ]} />
        <meshBasicMaterial color="#4f9dff" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <InstancedBoxes boxes={MARKINGS} material={MAT.lineMark} />

      {/* robot charging station */}
      <mesh geometry={GEO.box} material={MAT.charger} position={[CHARGER.x + 2, 1, CHARGER.z]} scale={[0.8, 2, 1.6]} castShadow />
      <mesh geometry={GEO.lamp} material={lampMaterial('#facc15')} position={[CHARGER.x + 2, 2.2, CHARGER.z]} />

      {/* campus walkway and lounge */}
      <mesh geometry={GEO.box} material={MAT.podFloor} position={[6, 0.06, WALKWAY_Z]} scale={[BW + 32, 0.1, 9]} receiveShadow />
      <mesh geometry={GEO.box} material={MAT.podFloor} position={[LOUNGE_X + 1, 0.07, LOUNGE_Z + 7.5]} scale={[10, 0.06, 20]} receiveShadow />
      <InstancedBoxes boxes={BENCHES} material={MAT.desk} />

      <sprite position={[B.minX + label.aspect * 1.6, 5.5, B.minZ]} scale={[label.aspect * 3.2, 3.2, 1]} raycast={() => null}>
        <spriteMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
});
