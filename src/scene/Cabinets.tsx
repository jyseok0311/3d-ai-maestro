import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Edges, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { AISLES, BAYS, LEVELS, RACK_ROW_Z, RACK_SIZE, rackX } from '../data/layout';
import type { Campus } from '../data/types';
import { GEO, MAT } from './assets';
import { ACCENT } from '../theme';

interface CabinetInfo {
  key: string;
  campusId: string;
  aisle: string;
  bay: number;
  x: number;
  z: number;
}

interface Props {
  campuses: Campus[];
  /** Tracked stock per slot, keyed `${campusId}:${aisle}:${bay}:${level}`. */
  slots: Map<string, SlotFill>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

const SHELF_Y = [0.2, 1.4, 2.6];
const BOX = { w: 1.05, h: 0.85, d: 1.1 };
export interface SlotFill {
  /** 0–1 share of a comfortable stock level. */
  fill: number;
  low: boolean;
  color: string;
}

const UNTRACKED = new THREE.Color('#7c8796');
const LOW = new THREE.Color('#ef4444');
const SHADE = new THREE.Color('#0c0e11');

/** Cheap, stable pseudo-random value per string. */
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * All storage cabinets of all campuses in four instanced draw calls: frames,
 * shelves, material boxes and an invisible hit-box layer that receives the clicks.
 */
export const Cabinets = memo(function Cabinets({ campuses, slots, selectedKey, onSelect }: Props) {
  const racks = useMemo<CabinetInfo[]>(
    () =>
      campuses.flatMap((campus) =>
        AISLES.flatMap((aisle, ai) =>
          Array.from({ length: BAYS }, (_, b) => ({
            key: `${campus.id}:${aisle}:${b + 1}`,
            campusId: campus.id,
            aisle,
            bay: b + 1,
            x: campus.origin.x + rackX(b + 1),
            z: campus.origin.z + RACK_ROW_Z[ai],
          })),
        ),
      ),
    [campuses],
  );

  const uprights = useRef<THREE.InstancedMesh>(null);
  const shelves = useRef<THREE.InstancedMesh>(null);
  const cargo = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const cargoCount = racks.length * LEVELS * 2;

  // Static frame: written once per layout change.
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const v = new THREE.Vector3();
    racks.forEach((r, i) => {
      for (const side of [0, 1]) {
        v.set(r.x + (side ? 1 : -1) * (RACK_SIZE.w / 2), RACK_SIZE.h / 2, r.z);
        s.set(0.12, RACK_SIZE.h, RACK_SIZE.d);
        uprights.current!.setMatrixAt(i * 2 + side, m.compose(v, q, s));
      }
      SHELF_Y.forEach((y, l) => {
        v.set(r.x, y, r.z);
        s.set(RACK_SIZE.w, 0.08, RACK_SIZE.d);
        shelves.current!.setMatrixAt(i * LEVELS + l, m.compose(v, q, s));
      });
      v.set(r.x, RACK_SIZE.h / 2, r.z);
      s.set(RACK_SIZE.w, RACK_SIZE.h, RACK_SIZE.d);
      hits.current!.setMatrixAt(i, m.compose(v, q, s));
    });
    for (const mesh of [uprights.current!, shelves.current!, hits.current!]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [racks]);

  // Material boxes reflect live stock levels.
  useLayoutEffect(() => {
    const mesh = cargo.current!;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    let i = 0;
    for (const r of racks) {
      for (let l = 0; l < LEVELS; l++) {
        const slotKey = `${r.key}:${l + 1}`;
        const slot = slots.get(slotKey);
        // Slots without a tracked material get a stable decorative fill.
        const amount = slot === undefined ? (hash01(slotKey) > 0.35 ? hash01(slotKey + 'n') : 0) : slot.fill;
        const boxes = amount <= 0 ? 0 : amount < 0.5 ? 1 : 2;
        for (let k = 0; k < 2; k++) {
          const visible = k < boxes;
          v.set(r.x + (k ? 0.68 : -0.68), SHELF_Y[l] + 0.04 + BOX.h / 2, r.z);
          s.set(visible ? BOX.w : 0, visible ? BOX.h : 0, visible ? BOX.d : 0);
          mesh.setMatrixAt(i, m.compose(v, q, s));
          if (!slot) c.copy(UNTRACKED);
          else if (slot.low) c.copy(LOW);
          else c.set(slot.color);
          c.lerp(SHADE, hash01(slotKey + k) * 0.25);
          mesh.setColorAt(i, c);
          i++;
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [racks, slots]);

  const selected = selectedKey ? racks.find((r) => r.key === selectedKey) : undefined;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 6 && e.instanceId !== undefined) onSelect(racks[e.instanceId].key);
  };

  return (
    <group>
      <instancedMesh ref={uprights} args={[GEO.box, MAT.rackFrame, racks.length * 2]} castShadow receiveShadow raycast={() => null} />
      <instancedMesh ref={shelves} args={[GEO.box, MAT.rackShelf, racks.length * LEVELS]} castShadow receiveShadow raycast={() => null} />
      <instancedMesh ref={cargo} args={[GEO.box, undefined, cargoCount]} castShadow receiveShadow raycast={() => null}>
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={hits}
        args={[GEO.box, undefined, racks.length]}
        onClick={click}
        onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
        onPointerOut={() => setHovered(false)}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </instancedMesh>
      {selected && (
        <mesh position={[selected.x, RACK_SIZE.h / 2, selected.z]} scale={[RACK_SIZE.w + 0.3, RACK_SIZE.h + 0.3, RACK_SIZE.d + 0.3]} raycast={() => null}>
          <boxGeometry />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.12} depthWrite={false} />
          <Edges color={ACCENT} lineWidth={2} />
        </mesh>
      )}
    </group>
  );
});
