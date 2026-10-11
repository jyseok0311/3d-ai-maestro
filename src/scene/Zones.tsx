import { memo, useEffect, useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Edges, useCursor } from '@react-three/drei';
import {
  AUDIENCE,
  BOOTH_X,
  BOOTH_Z,
  CLASSROOM,
  CLASS_X,
  CLASS_Z,
  ENTRY_X,
  EXIT_X,
  INTERVIEW_ROOM,
  INTERVIEW_X,
  INTERVIEW_Z,
  QUEUE_Z,
  ROAD_Z,
  STAGE_ORDER,
  STAGE_PLATFORM,
  TABLE_X,
  TABLE_Z,
  ZONE,
  ZONE_SPACING,
  zoneX,
} from '../data/layout';
import type { Stage, StageKey } from '../data/types';
import { GEO, MAT, labelTexture, lampMaterial, paintMaterial } from './assets';
import { InstancedBoxes, type BoxSpec } from './InstancedBoxes';
import { SelectionRing } from './SelectionMarker';
import { ACCENT, STAGE_COLOR } from '../theme';

/** Canvas-texture label sprite. */
function Label({ code, text, active, color, position, height = 3 }: {
  code: string;
  text: string;
  active: boolean;
  color: string;
  position: [number, number, number];
  height?: number;
}) {
  const label = useMemo(() => {
    const texture = labelTexture(code, text, active, color);
    return { texture, aspect: texture.image.width / texture.image.height };
  }, [code, text, active, color]);
  useEffect(() => () => label.texture.dispose(), [label]);
  return (
    <sprite position={position} scale={[label.aspect * height, height, 1]} raycast={() => null}>
      <spriteMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

/** Floor, back wall, coloured front edge and the zone sign. */
export const ZoneShell = memo(function ZoneShell({ stage, active }: { stage: Stage; active: boolean }) {
  const color = STAGE_COLOR[stage.id];
  return (
    <group position={[stage.origin.x, 0, 0]}>
      <mesh geometry={GEO.box} material={MAT.floor} position={[0, 0.05, 0]} scale={[ZONE.w, 0.1, ZONE.d]} receiveShadow />
      <mesh position={[0, 0.11, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ZONE.w, ZONE.d]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.08 : 0.04} depthWrite={false} />
      </mesh>
      <mesh geometry={GEO.box} material={MAT.wall} position={[0, 0.9, -ZONE.d / 2]} scale={[ZONE.w, 1.8, 0.4]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={paintMaterial(color)} position={[0, 0.14, ZONE.d / 2]} scale={[ZONE.w, 0.08, 0.5]} />
      <Label
        code={`0${stage.order}`}
        text={`${stage.name} · ${stage.subtitle}`}
        active={active}
        color={color}
        position={[-ZONE.w / 2 + 14, 4.2, -ZONE.d / 2]}
      />
    </group>
  );
});

interface HotspotProps {
  id: string;
  /** World-space centre of the click box. */
  position: [number, number, number];
  size: [number, number, number];
  selected: boolean;
  onSelect: (id: string) => void;
}

/** Invisible click box for a facility, outlined while selected. */
export const FacilityHotspot = memo(function FacilityHotspot({ id, position, size, selected, onSelect }: HotspotProps) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 6) onSelect(id);
  };
  return (
    <group position={position}>
      <mesh
        position-y={size[1] / 2}
        scale={size}
        onClick={click}
        onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry />
        <meshBasicMaterial color={ACCENT} transparent opacity={selected ? 0.07 : 0} depthWrite={false} />
        {selected && <Edges color={ACCENT} lineWidth={2} />}
      </mesh>
      {selected && <SelectionRing radius={Math.max(size[0], size[2]) * 0.62} />}
    </group>
  );
});

/** Glass room: floor, walls and corner posts (open towards the road). */
function GlassRoom({ x, z, w, d, h = 3 }: { x: number; z: number; w: number; d: number; h?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.box} material={MAT.road} position={[0, 0.13, 0]} scale={[w, 0.06, d]} receiveShadow />
      <mesh geometry={GEO.box} material={MAT.glass} position={[0, h / 2, -d / 2]} scale={[w, h, 0.08]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={MAT.glass} position={[(s * w) / 2, h / 2, 0]} scale={[0.08, h, d]} />
      ))}
      {[
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
      ].map(([px, pz], i) => (
        <mesh key={i} geometry={GEO.box} material={MAT.frame} position={[px, h / 2, pz]} scale={[0.18, h, 0.18]} castShadow />
      ))}
    </group>
  );
}

// ── ① Selection ─────────────────────────────────────────────────────────
const SEL = zoneX('selection');
const STANCHIONS: BoxSpec[] = Array.from({ length: 13 }, (_, i): BoxSpec => ({
  position: [SEL - 22 + i * 3.7, 0.55, QUEUE_Z - 1.3],
  scale: [0.12, 1.1, 0.12],
}));
const BOOTH_DESKS: BoxSpec[] = BOOTH_X.flatMap((bx): BoxSpec[] => [
  { position: [SEL + bx, 0.45, BOOTH_Z], scale: [3.2, 0.9, 1.2] },
  { position: [SEL + bx - 4.2, 1.1, BOOTH_Z], scale: [0.15, 2.2, 4.5] },
  { position: [SEL + bx + 4.2, 1.1, BOOTH_Z], scale: [0.15, 2.2, 4.5] },
]);
const BOOTH_SCREENS: BoxSpec[] = BOOTH_X.map((bx): BoxSpec => ({ position: [SEL + bx, 1.25, BOOTH_Z - 0.2], scale: [1.1, 0.7, 0.08] }));
const INTERVIEW_TABLES: BoxSpec[] = INTERVIEW_X.map((ix): BoxSpec => ({ position: [SEL + ix, 0.75, INTERVIEW_Z], scale: [6, 0.1, 1.6] }));

export const SelectionZone = memo(function SelectionZone() {
  return (
    <group>
      <InstancedBoxes boxes={STANCHIONS} material={MAT.frame} />
      <mesh geometry={GEO.box} material={paintMaterial('#a78bfa')} position={[SEL - 22 + 22.2, 1.0, QUEUE_Z - 1.3]} scale={[44.4, 0.05, 0.05]} />
      <InstancedBoxes boxes={BOOTH_DESKS} material={MAT.desk} />
      <InstancedBoxes boxes={BOOTH_SCREENS} material={MAT.dark} />
      {INTERVIEW_X.map((ix) => (
        <GlassRoom key={ix} x={SEL + ix} z={INTERVIEW_Z} w={INTERVIEW_ROOM.w} d={INTERVIEW_ROOM.d} />
      ))}
      <InstancedBoxes boxes={INTERVIEW_TABLES} material={MAT.desk} />
    </group>
  );
});

// ── ② Training ──────────────────────────────────────────────────────────
const TRN = zoneX('training');
const CLASS_DESKS: BoxSpec[] = CLASS_X.flatMap((cx) =>
  Array.from({ length: 8 }, (_, s): BoxSpec => ({
    position: [TRN + cx + ((s % 4) - 1.5) * 3.2, 0.8, CLASS_Z + 0.5 + Math.floor(s / 4) * 3.4 - 0.9],
    scale: [2.2, 0.08, 0.7],
  })),
);

export const TrainingZone = memo(function TrainingZone({ occupied }: { occupied: boolean[] }) {
  return (
    <group>
      {CLASS_X.map((cx, i) => (
        <group key={cx}>
          <GlassRoom x={TRN + cx} z={CLASS_Z} w={CLASSROOM.w} d={CLASSROOM.d} />
          {/* lecture screen, lit while a class is running */}
          <mesh
            geometry={GEO.box}
            material={occupied[i] ? lampMaterial('#7cc4ff') : MAT.dark}
            position={[TRN + cx, 1.9, CLASS_Z - CLASSROOM.d / 2 + 0.4]}
            scale={[6, 2.2, 0.08]}
          />
        </group>
      ))}
      <InstancedBoxes boxes={CLASS_DESKS} material={MAT.desk} />
    </group>
  );
});

// ── ③ Study ─────────────────────────────────────────────────────────────
const STD = zoneX('study');
const TABLES = TABLE_Z.flatMap((tz) => TABLE_X.map((tx) => ({ x: STD + tx, z: tz })));
const LAPTOPS: BoxSpec[] = TABLES.flatMap((t) =>
  [0, 1, 2, 3].map((s): BoxSpec => {
    const a = (s / 4) * Math.PI * 2 + Math.PI / 4;
    return { position: [t.x + Math.sin(a) * 1.0, 0.95, t.z + Math.cos(a) * 1.0], scale: [0.6, 0.05, 0.45] };
  }),
);
const PLANTS = [
  [STD - 27, -20],
  [STD + 27, -20],
  [STD - 27, 16],
  [STD + 27, 16],
  [STD, -2],
];

export interface TableTeam {
  name: string;
  progress: number;
  color: string;
}

export const StudyZone = memo(function StudyZone({ tables }: { tables: (TableTeam | null)[] }) {
  return (
    <group>
      {TABLES.map((t, i) => {
        const team = tables[i];
        return (
          <group key={i}>
            <mesh geometry={GEO.cylinder} material={MAT.desk} position={[t.x, 0.88, t.z]} scale={[1.55, 0.08, 1.55]} castShadow receiveShadow />
            <mesh geometry={GEO.cylinder} material={MAT.frame} position={[t.x, 0.45, t.z]} scale={[0.15, 0.85, 0.15]} />
            {/* progress tower beside the table */}
            <mesh geometry={GEO.box} material={MAT.dark} position={[t.x + 3, 1.6, t.z - 2.4]} scale={[0.5, 3.2, 0.5]} />
            {team && (
              <>
                <mesh
                  geometry={GEO.box}
                  material={lampMaterial(team.color)}
                  position={[t.x + 3, 0.05 + (3.1 * team.progress) / 2, t.z - 2.4]}
                  scale={[0.56, Math.max(0.05, 3.1 * team.progress), 0.56]}
                />
                <Label code={`${Math.round(team.progress * 100)}%`} text={team.name} active color={team.color} position={[t.x, 4.2, t.z]} height={1.7} />
              </>
            )}
          </group>
        );
      })}
      <InstancedBoxes boxes={LAPTOPS} material={MAT.laptop} />
      {PLANTS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={GEO.cylinder} material={MAT.pot} position-y={0.4} scale={[0.6, 0.8, 0.6]} />
          <mesh geometry={GEO.leaves} material={MAT.leaf} position-y={1.6} scale={1.1} castShadow />
        </group>
      ))}
    </group>
  );
});

// ── ④ Showcase ──────────────────────────────────────────────────────────
const SHW = zoneX('showcase');
const CHAIRS: BoxSpec[] = Array.from({ length: AUDIENCE.cols * AUDIENCE.rows }, (_, s): BoxSpec => ({
  position: [SHW + AUDIENCE.x0 + (s % AUDIENCE.cols) * AUDIENCE.dx, 0.35, AUDIENCE.z0 + Math.floor(s / AUDIENCE.cols) * AUDIENCE.dz + 0.4],
  scale: [1.1, 0.5, 1.0],
}));

export const ShowcaseZone = memo(function ShowcaseZone({ presenting }: { presenting: boolean }) {
  const P = STAGE_PLATFORM;
  return (
    <group>
      <mesh geometry={GEO.box} material={MAT.stage} position={[SHW, P.h / 2, P.z]} scale={[P.w, P.h, P.d]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={MAT.gold} position={[SHW, P.h + 0.03, P.z + P.d / 2 - 0.2]} scale={[P.w, 0.06, 0.25]} />
      {/* big screen: glows while a team presents */}
      <mesh
        geometry={GEO.box}
        material={presenting ? lampMaterial('#fde68a') : MAT.dark}
        position={[SHW, P.h + 3.6, P.z - P.d / 2 + 0.3]}
        scale={[18, 6, 0.15]}
      />
      {/* podium and trophy */}
      <mesh geometry={GEO.box} material={MAT.frame} position={[SHW + 9, P.h + 0.6, P.z + 1.5]} scale={[1.2, 1.2, 0.8]} castShadow />
      <mesh geometry={GEO.cylinder} material={MAT.gold} position={[SHW - 12, P.h + 0.6, P.z + 1]} scale={[0.35, 1.2, 0.35]} castShadow />
      <mesh geometry={GEO.leaves} material={MAT.gold} position={[SHW - 12, P.h + 1.6, P.z + 1]} scale={0.55} castShadow />
      <InstancedBoxes boxes={CHAIRS} material={MAT.chair} />
    </group>
  );
});

// ── Staff (reviewers, interviewers, instructors, MC) ────────────────────
const STAFF: BoxSpec[] = [
  ...BOOTH_X.map((bx): BoxSpec => ({ position: [SEL + bx, -0.5, BOOTH_Z - 1.5], scale: [1, 1, 1] })),
  ...INTERVIEW_X.flatMap((ix) => [-1.8, 0, 1.8].map((dx): BoxSpec => ({ position: [SEL + ix + dx, -0.5, INTERVIEW_Z - 1.6], scale: [1, 1, 1] }))),
  ...CLASS_X.map((cx): BoxSpec => ({ position: [TRN + cx + 3.5, 0, CLASS_Z - 4.6], scale: [1, 1, 1] })),
  { position: [SHW + 10.5, STAGE_PLATFORM.h, STAGE_PLATFORM.z + 1.5], scale: [1, 1, 1] },
];

/** Static staff figures in slate grey, two instanced draw calls. */
export function StaffFigures() {
  return (
    <group>
      <InstancedBoxes boxes={STAFF} material={MAT.staff} geometry={GEO.body} />
      <InstancedBoxes boxes={STAFF} material={MAT.skin} geometry={GEO.head} />
    </group>
  );
}

// ── Road, arrows and gates ──────────────────────────────────────────────
const ROAD_LEN = EXIT_X - ENTRY_X + 24;
const ROAD_MID = (EXIT_X + ENTRY_X) / 2;
const DASHES: BoxSpec[] = Array.from({ length: Math.floor(ROAD_LEN / 6) }, (_, i): BoxSpec => ({
  position: [ENTRY_X - 12 + i * 6 + 1.5, 0.13, ROAD_Z],
  scale: [2.6, 0.02, 0.16],
}));
/** Chevrons between zones, pointing along the journey. */
const CHEVRONS: BoxSpec[] = STAGE_ORDER.slice(0, -1).flatMap((s) => {
  const x = zoneX(s) + ZONE_SPACING / 2;
  return [0, 1.6].flatMap((dx): BoxSpec[] => [
    { position: [x - 0.8 + dx, 0.14, ROAD_Z - 0.7], scale: [1.6, 0.03, 0.3] },
    { position: [x - 0.8 + dx, 0.14, ROAD_Z + 0.7], scale: [1.6, 0.03, 0.3] },
  ]);
});

export const Road = memo(function Road({ highlight }: { highlight: StageKey | 'all' }) {
  return (
    <group>
      <mesh geometry={GEO.box} material={MAT.ground} position={[ROAD_MID, 0.02, 4]} scale={[ROAD_LEN + 20, 0.04, 70]} receiveShadow />
      <mesh geometry={GEO.box} material={MAT.road} position={[ROAD_MID, 0.07, ROAD_Z]} scale={[ROAD_LEN, 0.1, 7]} receiveShadow />
      <InstancedBoxes boxes={DASHES} material={MAT.lineMark} />
      <InstancedBoxes boxes={CHEVRONS} material={lampMaterial(highlight === 'all' ? ACCENT : STAGE_COLOR[highlight])} />
      <Label code="IN" text="지원 접수 입구" active={false} color={ACCENT} position={[ENTRY_X, 3.2, ROAD_Z - 4.5]} height={2.2} />
      <Label code="OUT" text="수료 · 퇴장" active={false} color={ACCENT} position={[EXIT_X, 3.2, ROAD_Z - 4.5]} height={2.2} />
    </group>
  );
});
