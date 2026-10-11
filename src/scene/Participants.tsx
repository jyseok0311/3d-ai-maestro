import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { ENTRY_X, ROAD_Z, ZONE_SPACING, type Spot } from '../data/layout';
import { GEO, MAT, lampMaterial } from './assets';
import { SelectionRing } from './SelectionMarker';
import { ACCENT } from '../theme';

export interface Figure {
  id: string;
  spot: Spot;
  color: string;
  visible: boolean;
  alert: boolean;
}

interface Props {
  figures: Figure[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const MAX = 96;
const WALK_SPEED = 9;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const ACCENT_COLOR = new THREE.Color(ACCENT);

/**
 * Every participant as instanced figures: bodies, heads and attention markers
 * are three draw calls in total. People glide to their spot and use the road
 * whenever they move to another zone.
 */
export const Participants = memo(function Participants({ figures, selectedId, onSelect }: Props) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const alerts = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Group>(null);
  const positions = useRef(new Map<string, THREE.Vector3>());
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), v: new THREE.Vector3(), c: new THREE.Color() }), []);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  // Colours change only when the list or statuses change, not every frame.
  useLayoutEffect(() => {
    figures.forEach((f, i) => {
      tmp.c.set(f.color);
      if (f.id === selectedId) tmp.c.lerp(ACCENT_COLOR, 0.5);
      bodies.current!.setColorAt(i, tmp.c);
    });
    if (bodies.current!.instanceColor) bodies.current!.instanceColor.needsUpdate = true;
  }, [figures, selectedId, tmp]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.1);
    const t = state.clock.elapsedTime;
    const seen = new Set<string>();

    figures.forEach((f, i) => {
      seen.add(f.id);
      let pos = positions.current.get(f.id);
      if (!pos) {
        // Newcomers walk in from the entrance; the initial crowd starts in place.
        pos = state.clock.elapsedTime > 1 ? new THREE.Vector3(ENTRY_X, 0, ROAD_Z) : new THREE.Vector3(f.spot.x, 0, f.spot.z);
        positions.current.set(f.id, pos);
      }
      const wp = roadWaypoint(pos.x, pos.z, f.spot.x, f.spot.z);
      const dx = wp.x - pos.x;
      const dz = wp.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const walking = dist > 0.05 || Math.hypot(f.spot.x - pos.x, f.spot.z - pos.z) > 0.05;
      if (dist > 0.01) {
        const step = Math.min(dist, WALK_SPEED * d);
        pos.x += (dx / dist) * step;
        pos.z += (dz / dist) * step;
      }

      if (!f.visible) {
        bodies.current!.setMatrixAt(i, HIDDEN);
        heads.current!.setMatrixAt(i, HIDDEN);
        alerts.current!.setMatrixAt(i, HIDDEN);
        return;
      }
      const floor = walking ? 0 : (f.spot.y ?? 0);
      const y = walking ? Math.abs(Math.sin(t * 10 + i)) * 0.18 : floor + (f.spot.seated ? -0.5 : 0);
      tmp.m.makeTranslation(tmp.v.set(pos.x, y, pos.z));
      bodies.current!.setMatrixAt(i, tmp.m);
      heads.current!.setMatrixAt(i, tmp.m);
      if (f.alert) {
        tmp.m.makeScale(0.36, 0.5, 0.36).setPosition(pos.x, y + 2.75 + Math.sin(t * 4 + i) * 0.1, pos.z);
        alerts.current!.setMatrixAt(i, tmp.m);
      } else {
        alerts.current!.setMatrixAt(i, HIDDEN);
      }
      if (f.id === selectedId && ring.current) ring.current.position.set(pos.x, floor, pos.z);
    });

    for (let i = figures.length; i < MAX; i++) {
      bodies.current!.setMatrixAt(i, HIDDEN);
      heads.current!.setMatrixAt(i, HIDDEN);
      alerts.current!.setMatrixAt(i, HIDDEN);
    }
    for (const id of positions.current.keys()) if (!seen.has(id)) positions.current.delete(id);
    for (const mesh of [bodies.current!, heads.current!, alerts.current!]) mesh.instanceMatrix.needsUpdate = true;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const f = e.instanceId !== undefined ? figures[e.instanceId] : undefined;
    if (e.delta < 6 && f?.visible) onSelect(f.id);
  };

  return (
    <group>
      <instancedMesh
        ref={bodies}
        args={[GEO.body, undefined, MAX]}
        castShadow
        frustumCulled={false}
        onClick={click}
        onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial roughness={0.65} flatShading />
      </instancedMesh>
      <instancedMesh ref={heads} args={[GEO.head, MAT.skin, MAX]} castShadow frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={alerts} args={[GEO.marker, lampMaterial('#ef4444'), MAX]} frustumCulled={false} raycast={() => null} />
      {selectedId && figures.some((f) => f.id === selectedId) && (
        <group ref={ring}>
          <SelectionRing radius={1.3} />
        </group>
      )}
    </group>
  );
});

/**
 * Next point on the way to (tx, tz): trips to another zone go out to the road,
 * along it, and back in, instead of cutting through buildings.
 */
function roadWaypoint(x: number, z: number, tx: number, tz: number) {
  const crossZone = Math.abs(tx - x) > ZONE_SPACING / 3;
  if (!crossZone) return { x: tx, z: tz };
  if (Math.abs(z - ROAD_Z) > 0.2) return { x, z: ROAD_Z };
  return { x: tx, z: ROAD_Z };
}
