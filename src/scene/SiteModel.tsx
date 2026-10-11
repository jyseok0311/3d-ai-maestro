import { memo, useEffect, useMemo } from 'react';
import {
  BUILDING,
  CHARGER,
  DOCK_COUNT,
  DOCK_WALL_Z,
  PARKING_X,
  PARKING_Z,
  ROAD_Z,
  STAGING,
  dockX,
} from '../data/layout';
import type { Site } from '../data/types';
import { GEO, MAT, labelTexture, lampMaterial } from './assets';
import { InstancedBoxes, type BoxSpec } from './InstancedBoxes';

interface Props {
  site: Site;
  active: boolean;
}

const B = BUILDING;
const BW = B.maxX - B.minX;
const BD = B.maxZ - B.minZ;
const DOOR_GAP = 4.6;
const WALL_H = 4.6;

const S = STAGING;
const MARKINGS: BoxSpec[] = [
  ...[S.minZ, S.maxZ].map((z): BoxSpec => ({ position: [(S.minX + S.maxX) / 2, 0.12, z], scale: [S.maxX - S.minX, 0.02, 0.15] })),
  ...[S.minX, S.maxX].map((x): BoxSpec => ({ position: [x, 0.12, (S.minZ + S.maxZ) / 2], scale: [0.15, 0.02, S.maxZ - S.minZ] })),
  ...Array.from({ length: 18 }, (_, i): BoxSpec => ({ position: [-44 + i * 5.8, 0.12, ROAD_Z], scale: [2.6, 0.02, 0.18] })),
  ...Array.from({ length: 5 }, (_, i): BoxSpec => ({ position: [PARKING_X, 0.1, PARKING_Z - 2.25 + i * 4.5], scale: [10, 0.02, 0.12] })),
];

/** Static shell of one site: floor, cut-away walls, yard, road and labels. */
export const SiteModel = memo(function SiteModel({ site, active }: Props) {
  // Dock wall segments between the door openings.
  const edges = [B.minX, ...Array.from({ length: DOCK_COUNT }, (_, i) => dockX(i)), B.maxX];
  const segments = edges.slice(0, -1).map((from, i) => {
    const a = i === 0 ? from : from + DOOR_GAP / 2;
    const b = i === edges.length - 2 ? edges[i + 1] : edges[i + 1] - DOOR_GAP / 2;
    return { x: (a + b) / 2, w: b - a };
  });

  const label = useMemo(() => {
    const texture = labelTexture(site.code, site.name, active);
    return { texture, aspect: texture.image.width / texture.image.height };
  }, [site.code, site.name, active]);
  useEffect(() => () => label.texture.dispose(), [label]);

  return (
    <group position={[site.origin.x, 0, site.origin.z]}>
      {/* yard asphalt */}
      <mesh geometry={GEO.box} material={MAT.lot} position={[6, 0.04, 8]} scale={[BW + 32, 0.08, 72]} receiveShadow />
      {/* warehouse floor */}
      <mesh geometry={GEO.box} material={MAT.slab} position={[(B.minX + B.maxX) / 2, 0.05, (B.minZ + B.maxZ) / 2]} scale={[BW, 0.1, BD]} receiveShadow />

      {/* cut-away walls: low on three sides, full height on the dock side */}
      <mesh geometry={GEO.box} material={MAT.wall} position={[0, 0.8, B.minZ]} scale={[BW, 1.6, 0.4]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={MAT.wall} position={[B.minX, 0.8, (B.minZ + B.maxZ) / 2]} scale={[0.4, 1.6, BD]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={MAT.wall} position={[B.maxX, 0.8, (B.minZ + B.maxZ) / 2]} scale={[0.4, 1.6, BD]} castShadow receiveShadow />
      {segments.map((s, i) => (
        <mesh key={i} geometry={GEO.box} material={MAT.wall} position={[s.x, WALL_H / 2, DOCK_WALL_Z]} scale={[s.w, WALL_H, 0.5]} castShadow receiveShadow />
      ))}
      <mesh geometry={GEO.box} material={MAT.wallTrim} position={[0, WALL_H + 0.08, DOCK_WALL_Z]} scale={[BW, 0.16, 0.55]} />

      {/* staging zone floor marking */}
      <mesh position={[(STAGING.minX + STAGING.maxX) / 2, 0.12, (STAGING.minZ + STAGING.maxZ) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[STAGING.maxX - STAGING.minX, STAGING.maxZ - STAGING.minZ]} />
        <meshBasicMaterial color="#f5a524" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      {/* staging outline, road dashes and parking bays: one draw call */}
      <InstancedBoxes boxes={MARKINGS} material={MAT.roadLine} />

      {/* charging station */}
      <mesh geometry={GEO.box} material={MAT.charger} position={[CHARGER.x + 2, 1, CHARGER.z]} scale={[0.8, 2, 1.6]} castShadow />
      <mesh geometry={GEO.lamp} material={lampMaterial('#facc15')} position={[CHARGER.x + 2, 2.2, CHARGER.z]} />

      {/* road */}
      <mesh geometry={GEO.box} material={MAT.chassis} position={[6, 0.06, ROAD_Z]} scale={[BW + 32, 0.1, 9]} receiveShadow />

      <sprite position={[B.minX + label.aspect * 1.6, 5.5, B.minZ]} scale={[label.aspect * 3.2, 3.2, 1]} raycast={() => null}>
        <spriteMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
});
