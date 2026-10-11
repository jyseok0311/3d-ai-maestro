import { useCallback, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { POD_CENTER_Z, roomX, worldBounds } from '../data/layout';
import { useMaestroStore, type SelectionKind } from '../store/useMaestroStore';
import { cohortMatches, isLowStock } from '../store/selectors';
import { ASSISTANT_STATUS, COHORT_STATUS, MATERIAL_COLOR, ROOM_STATUS, TRACK } from '../theme';
import { CameraRig } from './CameraRig';
import { CampusModel } from './CampusModel';
import { Cabinets, type SlotFill } from './Cabinets';
import { CohortModel } from './CohortModel';
import { RobotModel } from './RobotModel';
import { RoomModel } from './RoomModel';
import { computeCohortPlacements } from './placement';

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

function World() {
  const { campuses, rooms, cohorts, assistants, sessions, materials, campusId, filters, selection, cameraFocus } =
    useMaestroStore(
      useShallow((s) => ({
        campuses: s.campuses,
        rooms: s.rooms,
        cohorts: s.cohorts,
        assistants: s.assistants,
        sessions: s.sessions,
        materials: s.materials,
        campusId: s.campusId,
        filters: s.filters,
        selection: s.selection,
        cameraFocus: s.cameraFocus,
      })),
    );
  const select = useMaestroStore((s) => s.select);

  const campusList = useMemo(() => Object.values(campuses), [campuses]);
  const bounds = useMemo(() => worldBounds(campusList.length), [campusList.length]);
  const placements = useMemo(() => computeCohortPlacements(cohorts, rooms, campuses), [cohorts, rooms, campuses]);

  const slots = useMemo(() => {
    const m = new Map<string, SlotFill>();
    for (const it of Object.values(materials)) {
      const { aisle, bay, level } = it.location;
      m.set(`${it.campusId}:${aisle}:${bay}:${level}`, {
        fill: Math.max(0.25, Math.min(1, it.quantity / (it.reorderPoint * 3))),
        low: isLowStock(it),
        color: MATERIAL_COLOR[it.category],
      });
    }
    return m;
  }, [materials]);

  // Stable callbacks so memoised models don't re-render when the store ticks.
  const selectCohort = useCallback((id: string) => select({ kind: 'cohort', id }), [select]);
  const selectAssistant = useCallback((id: string) => select({ kind: 'assistant', id }), [select]);
  const selectRoom = useCallback((id: string) => select({ kind: 'room', id }), [select]);
  const selectCabinet = useCallback((id: string) => select({ kind: 'cabinet', id }), [select]);
  const isSel = (kind: SelectionKind, id: string) => selection?.kind === kind && selection.id === id;

  return (
    <>
      <CameraRig focus={cameraFocus} bounds={bounds} />

      {campusList.map((campus) => (
        <CampusModel key={campus.id} campus={campus} active={campusId === campus.id} />
      ))}

      <Cabinets
        campuses={campusList}
        slots={slots}
        selectedKey={selection?.kind === 'cabinet' ? selection.id : null}
        onSelect={selectCabinet}
      />

      {Object.values(rooms).map((r) => {
        const o = campuses[r.campusId].origin;
        return (
          <RoomModel
            key={r.id}
            id={r.id}
            x={o.x + roomX(r.index)}
            z={o.z + POD_CENTER_Z}
            inSession={r.status === 'in_session'}
            statusColor={ROOM_STATUS[r.status].color}
            selected={isSel('room', r.id)}
            onSelect={selectRoom}
          />
        );
      })}

      {Object.values(cohorts).map((c) => {
        const p = placements[c.id];
        return (
          <CohortModel
            key={c.id}
            id={c.id}
            x={p.x}
            z={p.z}
            rot={p.rot}
            seated={p.seated}
            figures={Math.round(c.learners / 2)}
            trackColor={TRACK[c.track].color}
            statusColor={COHORT_STATUS[c.status].color}
            visible={cohortMatches(c, sessions, filters)}
            selected={isSel('cohort', c.id)}
            onSelect={selectCohort}
          />
        );
      })}

      {Object.values(assistants).map((a) => {
        const o = campuses[a.campusId].origin;
        return (
          <RobotModel
            key={a.id}
            id={a.id}
            x={o.x + a.position.x}
            z={o.z + a.position.z}
            assisting={a.status === 'assisting'}
            statusColor={ASSISTANT_STATUS[a.status].color}
            selected={isSel('assistant', a.id)}
            onSelect={selectAssistant}
          />
        );
      })}
    </>
  );
}
