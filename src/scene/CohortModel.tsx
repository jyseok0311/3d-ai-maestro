import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Edges, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { FRONT_Z, POD } from '../data/layout';
import { GEO, MAT, dampAngle, lampMaterial } from './assets';
import { SelectionRing } from './SelectionMarker';
import { ACCENT } from '../theme';

interface Props {
  id: string;
  x: number;
  z: number;
  rot: number;
  seated: boolean;
  /** Number of figures drawn for the class. */
  figures: number;
  trackColor: string;
  statusColor: string;
  visible: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

const MAX_FIGURES = 12;
const WALK_SPEED = 7;
/** Sideways walking happens only in front of the pods (z beyond the pod rows). */
const POD_FRONT_Z = FRONT_Z + 0.7 + POD.d + 1;
const CORRIDOR_Z = POD_FRONT_Z + 2;

/**
 * Next point on the way to (tx, tz): groups step out in front of the pods
 * before moving sideways, so they never walk through a neighbouring pod.
 * Campus origins sit on z = 0, so world z equals campus-local z.
 */
function corridorWaypoint(x: number, z: number, tx: number, tz: number) {
  if (Math.abs(tx - x) < 0.5) return { x: tx, z: tz };
  if (z < POD_FRONT_Z) return { x, z: CORRIDOR_Z };
  if (tz < POD_FRONT_Z) return { x: tx, z };
  return { x: tx, z: tz };
}

/** Local offsets: a loose walking group, or a seated desk grid (3 columns). */
function formation(count: number, seated: boolean): THREE.Vector3[] {
  return Array.from({ length: count }, (_, i) => {
    if (seated) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      return new THREE.Vector3((col - 1) * 2.4, 0, (row - 1.5) * 1.6 + 0.4);
    }
    const col = i % 3;
    const row = Math.floor(i / 3);
    const jitter = ((i * 37) % 10) / 25;
    return new THREE.Vector3((col - 1) * 1.3 + jitter, 0, (row - 1.5) * 1.3 - jitter);
  });
}

/**
 * One training class drawn as instanced learner figures (two draw calls).
 * The group glides to (x, z, rot); figures re-form between walking and seats.
 */
export const CohortModel = memo(function CohortModel(p: Props) {
  const group = useRef<THREE.Group>(null);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const marker = useRef<THREE.Mesh>(null);
  // Initial transform only: later moves are animated in useFrame, not via props.
  const [initial] = useState(() => ({ position: [p.x, 0, p.z] as [number, number, number], rot: p.rot }));
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && p.visible);

  const count = Math.min(MAX_FIGURES, p.figures);
  const targets = useMemo(() => formation(count, p.seated), [count, p.seated]);
  const current = useRef<THREE.Vector3[]>(formation(MAX_FIGURES, p.seated));
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), v: new THREE.Vector3() }), []);

  useLayoutEffect(() => {
    const c = new THREE.Color(p.trackColor);
    for (let i = 0; i < MAX_FIGURES; i++) bodies.current!.setColorAt(i, c);
    bodies.current!.instanceColor!.needsUpdate = true;
  }, [p.trackColor]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(dt, 0.1);
    const wp = corridorWaypoint(g.position.x, g.position.z, p.x, p.z);
    const dx = wp.x - g.position.x;
    const dz = wp.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    const moving = Math.hypot(g.position.x - p.x, g.position.z - p.z) > 0.3;
    if (dist > 0.01) {
      const step = Math.min(dist, WALK_SPEED * d);
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
    }
    // Face the walking direction, then the placement's heading once arrived.
    g.rotation.y = dampAngle(g.rotation.y, moving && dist > 0.01 ? Math.atan2(dx, dz) : p.rot, 4, d);

    const t = state.clock.elapsedTime;
    for (let i = 0; i < MAX_FIGURES; i++) {
      const cur = current.current[i];
      if (i < count) cur.lerp(targets[i], 1 - Math.exp(-3 * d));
      // Walking bob, or a slight sink when sitting at a desk.
      const y = i >= count ? -50 : moving ? Math.abs(Math.sin(t * 9 + i)) * 0.16 : p.seated ? -0.55 : 0;
      tmp.m.makeTranslation(tmp.v.set(cur.x, y, cur.z));
      bodies.current!.setMatrixAt(i, tmp.m);
      heads.current!.setMatrixAt(i, tmp.m);
    }
    bodies.current!.instanceMatrix.needsUpdate = true;
    heads.current!.instanceMatrix.needsUpdate = true;

    if (marker.current) {
      marker.current.position.y = 3.6 + Math.sin(t * 2) * 0.15;
      marker.current.rotation.y = t;
    }
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 6) p.onSelect(p.id);
  };
  const box: [number, number, number] = p.seated ? [7.6, 2.4, 7] : [4.6, 2.4, 5.6];

  return (
    <group ref={group} position={initial.position} rotation-y={initial.rot} visible={p.visible}>
      <instancedMesh ref={bodies} args={[GEO.body, undefined, MAX_FIGURES]} castShadow frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial roughness={0.7} flatShading />
      </instancedMesh>
      <instancedMesh ref={heads} args={[GEO.head, MAT.skin, MAX_FIGURES]} castShadow frustumCulled={false} raycast={() => null} />
      <mesh ref={marker} geometry={GEO.marker} material={lampMaterial(p.statusColor)} position-y={3.6} scale={0.7} raycast={() => null} />
      {/* click target and selection outline */}
      <mesh
        position-y={box[1] / 2}
        scale={box}
        onClick={p.visible ? click : undefined}
        onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry />
        <meshBasicMaterial color={ACCENT} transparent opacity={p.selected ? 0.08 : 0} depthWrite={false} />
        {p.selected && <Edges color={ACCENT} lineWidth={2} />}
      </mesh>
      {p.selected && <SelectionRing radius={p.seated ? 5.2 : 3} />}
    </group>
  );
});
