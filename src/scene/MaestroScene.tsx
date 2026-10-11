import { useCallback, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import {
  AUDIENCE,
  CLASSROOM,
  INTERVIEW_ROOM,
  STAGE_ORDER,
  STAGE_PLATFORM,
  facilityCenter,
  worldBounds,
  zoneX,
} from '../data/layout';
import type { Facility } from '../data/types';
import { useMaestroStore } from '../store/useMaestroStore';
import { needsAttention, participantMatches } from '../store/selectors';
import { STALLED_COLOR, STATUS, TEAM_PHASE } from '../theme';
import { CameraRig } from './CameraRig';
import { Participants, type Figure } from './Participants';
import { computeSpots } from './placement';
import {
  FacilityHotspot,
  Road,
  SelectionZone,
  ShowcaseZone,
  StaffFigures,
  StudyZone,
  TrainingZone,
  ZoneShell,
  type TableTeam,
} from './Zones';

/**
 * The 3D view. This file only maps store state to visual props; the models
 * below it know nothing about the simulation or KPIs.
 */
export function MaestroScene() {
  const select = useMaestroStore((s) => s.select);
  const down = useRef({ x: 0, y: 0 });

  return (
    <div
      className="scene"
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 32, near: 1, far: 1200, position: [120, 140, 120] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={(e) => {
          // Ignore the click that ends a pan drag.
          if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 6) select(null);
        }}
      >
        <color attach="background" args={['#0c0e11']} />
        <fog attach="fog" args={['#0c0e11', 260, 620]} />
        <Lights />
        <Ground />
        <World />
      </Canvas>
    </div>
  );
}

function Lights() {
  const light = useRef<THREE.DirectionalLight>(null);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const offset = useMemo(() => new THREE.Vector3(60, 110, 40), []);

  // Keep the shadow frustum centred on what the camera looks at, so a tight
  // (sharp) shadow map covers the visible area at any pan position.
  useFrame(() => {
    const l = light.current;
    if (!l || !controls) return;
    l.position.copy(controls.target).add(offset);
    l.target.position.copy(controls.target);
    l.target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={['#c9d4e6', '#1a1610', 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={light}
        intensity={2.4}
        color="#fff3df"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-near={10}
        shadow-camera-far={400}
      />
    </>
  );
}

function Ground() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color="#101317" roughness={1} />
      </mesh>
      <Grid
        position={[0, 0.005, 0]}
        args={[10, 10]}
        infiniteGrid
        cellSize={2.5}
        cellThickness={0.6}
        cellColor="#1d2228"
        sectionSize={12.5}
        sectionThickness={1}
        sectionColor="#1d3a63"
        fadeDistance={520}
        fadeStrength={1.4}
      />
    </>
  );
}

/** Click-box size for each kind of facility. */
function hotspotSize(f: Facility): [number, number, number] {
  switch (f.kind) {
    case 'booth':
      return [7.5, 2.4, 6];
    case 'interview':
      return [INTERVIEW_ROOM.w, 3, INTERVIEW_ROOM.d];
    case 'classroom':
      return [CLASSROOM.w, 3, CLASSROOM.d];
    case 'table':
      return [6.2, 2.2, 6.2];
    case 'stage':
      return [STAGE_PLATFORM.w, 3, STAGE_PLATFORM.d];
    case 'audience':
      return [AUDIENCE.cols * AUDIENCE.dx, 1.8, AUDIENCE.rows * AUDIENCE.dz + 1];
  }
}

function World() {
  const { stages, facilities, participants, teams, view, filters, selection, cameraFocus } = useMaestroStore(
    useShallow((s) => ({
      stages: s.stages,
      facilities: s.facilities,
      participants: s.participants,
      teams: s.teams,
      view: s.view,
      filters: s.filters,
      selection: s.selection,
      cameraFocus: s.cameraFocus,
    })),
  );
  const select = useMaestroStore((s) => s.select);

  const bounds = useMemo(() => worldBounds(), []);
  const spots = useMemo(() => computeSpots(participants, facilities), [participants, facilities]);

  const figures = useMemo<Figure[]>(
    () =>
      Object.values(participants)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((p) => ({
          id: p.id,
          spot: spots[p.id],
          color: STATUS[p.status].color,
          visible: participantMatches(p, teams, filters),
          alert: needsAttention(p, teams),
        })),
    [participants, spots, teams, filters],
  );

  const occupied = useMemo(() => {
    const set = new Set(Object.values(participants).map((p) => p.facilityId));
    return ['classroom-1', 'classroom-2', 'classroom-3'].map((id) => set.has(id));
  }, [participants]);

  const tables = useMemo<(TableTeam | null)[]>(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const team = Object.values(teams).find((t) => t.tableId === `table-${i + 1}`);
        if (!team) return null;
        return {
          name: team.name,
          progress: team.progress / 100,
          color: team.stalled ? STALLED_COLOR : TEAM_PHASE[team.phase].color,
        };
      }),
    [teams],
  );

  const presenting = useMemo(() => Object.values(teams).some((t) => t.phase === 'presenting'), [teams]);

  // A selected team highlights its table (or the stage while it presents).
  const highlighted = useMemo(() => {
    if (selection?.kind === 'facility') return selection.id;
    if (selection?.kind === 'team') {
      const t = teams[selection.id];
      if (t?.tableId) return t.tableId;
      if (t?.phase === 'presenting') return 'stage-1';
      if (t?.phase === 'ready') return 'audience-1';
    }
    return null;
  }, [selection, teams]);

  // Stable callbacks so memoised models don't re-render when the store ticks.
  const selectParticipant = useCallback((id: string) => select({ kind: 'participant', id }), [select]);
  const selectFacility = useCallback((id: string) => select({ kind: 'facility', id }), [select]);

  return (
    <>
      <CameraRig focus={cameraFocus} bounds={bounds} />
      <Road highlight={view} />
      {STAGE_ORDER.map((id) => (
        <ZoneShell key={id} stage={stages[id]} active={view === id} />
      ))}
      <SelectionZone />
      <TrainingZone occupied={occupied} />
      <StudyZone tables={tables} />
      <ShowcaseZone presenting={presenting} />
      <StaffFigures />

      {Object.values(facilities).map((f) => {
        const c = facilityCenter(f);
        return (
          <FacilityHotspot
            key={f.id}
            id={f.id}
            position={[zoneX(f.stage) + c.x, f.kind === 'stage' ? 0 : 0.1, c.z]}
            size={hotspotSize(f)}
            selected={highlighted === f.id}
            onSelect={selectFacility}
          />
        );
      })}

      <Participants
        figures={figures}
        selectedId={selection?.kind === 'participant' ? selection.id : null}
        onSelect={selectParticipant}
      />
    </>
  );
}
