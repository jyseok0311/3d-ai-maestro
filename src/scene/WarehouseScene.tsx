import { useCallback, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { dockX, DOCK_WALL_Z, worldBounds } from '../data/layout';
import { useWarehouseStore, type SelectionKind } from '../store/useWarehouseStore';
import { isLowStock, truckMatches } from '../store/selectors';
import { CARRIER_COLORS, DOCK_STATUS, FORKLIFT_STATUS, TRUCK_STATUS } from '../theme';
import { CameraRig } from './CameraRig';
import { DockModel } from './DockModel';
import { ForkliftModel } from './ForkliftModel';
import { Racks } from './Racks';
import { SiteModel } from './SiteModel';
import { TruckModel } from './TruckModel';
import { computeTruckPlacements } from './placement';

/**
 * The 3D view. This file only maps store state to visual props; the models
 * below it know nothing about the simulation or KPIs.
 */
export function WarehouseScene() {
  const select = useWarehouseStore((s) => s.select);
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
        sectionColor="#4a3a1a"
        fadeDistance={520}
        fadeStrength={1.4}
      />
    </>
  );
}

function World() {
  const { sites, docks, trucks, forklifts, shipments, inventory, siteId, filters, selection, cameraFocus } =
    useWarehouseStore(
      useShallow((s) => ({
        sites: s.sites,
        docks: s.docks,
        trucks: s.trucks,
        forklifts: s.forklifts,
        shipments: s.shipments,
        inventory: s.inventory,
        siteId: s.siteId,
        filters: s.filters,
        selection: s.selection,
        cameraFocus: s.cameraFocus,
      })),
    );
  const select = useWarehouseStore((s) => s.select);

  const siteList = useMemo(() => Object.values(sites), [sites]);
  const bounds = useMemo(() => worldBounds(siteList.length), [siteList.length]);
  const placements = useMemo(() => computeTruckPlacements(trucks, docks, sites), [trucks, docks, sites]);

  const slotFill = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of Object.values(inventory)) {
      const fill = Math.min(1, it.quantity / (it.reorderPoint * 3));
      const { aisle, bay, level } = it.location;
      m.set(`${it.siteId}:${aisle}:${bay}:${level}`, isLowStock(it) ? -Math.max(fill, 0.2) : Math.max(fill, 0.25));
    }
    return m;
  }, [inventory]);

  // Stable callbacks so memoised models don't re-render when the store ticks.
  const selectTruck = useCallback((id: string) => select({ kind: 'truck', id }), [select]);
  const selectForklift = useCallback((id: string) => select({ kind: 'forklift', id }), [select]);
  const selectDock = useCallback((id: string) => select({ kind: 'dock', id }), [select]);
  const selectRack = useCallback((id: string) => select({ kind: 'rack', id }), [select]);
  const isSel = (kind: SelectionKind, id: string) => selection?.kind === kind && selection.id === id;

  return (
    <>
      <CameraRig focus={cameraFocus} bounds={bounds} />

      {siteList.map((site) => (
        <SiteModel key={site.id} site={site} active={siteId === site.id} />
      ))}

      <Racks
        sites={siteList}
        slotFill={slotFill}
        selectedKey={selection?.kind === 'rack' ? selection.id : null}
        onSelect={selectRack}
      />

      {Object.values(docks).map((d) => {
        const o = sites[d.siteId].origin;
        return (
          <DockModel
            key={d.id}
            id={d.id}
            x={o.x + dockX(d.index)}
            z={o.z + DOCK_WALL_Z}
            doorOpen={d.status === 'occupied'}
            statusColor={DOCK_STATUS[d.status].color}
            selected={isSel('dock', d.id)}
            onSelect={selectDock}
          />
        );
      })}

      {Object.values(trucks).map((t) => {
        const p = placements[t.id];
        return (
          <TruckModel
            key={t.id}
            id={t.id}
            x={p.x}
            z={p.z}
            rot={p.rot}
            cabColor={CARRIER_COLORS[t.carrier] ?? '#64748b'}
            statusColor={TRUCK_STATUS[t.status].color}
            visible={truckMatches(t, shipments, filters)}
            selected={isSel('truck', t.id)}
            onSelect={selectTruck}
          />
        );
      })}

      {Object.values(forklifts).map((f) => {
        const o = sites[f.siteId].origin;
        return (
          <ForkliftModel
            key={f.id}
            id={f.id}
            x={o.x + f.position.x}
            z={o.z + f.position.z}
            lifting={f.status === 'lifting'}
            statusColor={FORKLIFT_STATUS[f.status].color}
            selected={isSel('forklift', f.id)}
            onSelect={selectForklift}
          />
        );
      })}
    </>
  );
}
