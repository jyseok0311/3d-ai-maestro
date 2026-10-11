import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Props {
  focus: { x: number; z: number; distance: number; seq: number };
  bounds: Bounds;
}

/** Isometric-style viewing direction: ~32° yaw, ~40° elevation, docks facing the camera. */
const VIEW_DIR = new THREE.Vector3(0.62, 1.15, 1).normalize();
const MIN_DIST = 30;
const MAX_DIST = 320;

/**
 * Strategy-game camera: drag to pan on the ground plane, wheel to zoom,
 * the look-at point is clamped to the map, and focus changes fly smoothly.
 */
export function CameraRig({ focus, bounds }: Props) {
  const controls = useRef<MapControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const flight = useRef<{ target: THREE.Vector3; distance: number } | null>(null);
  const tmp = useRef(new THREE.Vector3());
  const [initialTarget] = useState<[number, number, number]>(() => [focus.x, 0, focus.z]);

  // Place the camera once at the initial focus.
  useEffect(() => {
    camera.position.set(focus.x, 0, focus.z).addScaledVector(VIEW_DIR, focus.distance * 1.6);
    camera.lookAt(focus.x, 0, focus.z);
  }, []);

  useEffect(() => {
    flight.current = { target: new THREE.Vector3(focus.x, 0, focus.z), distance: focus.distance };
  }, [focus.seq, focus.x, focus.z, focus.distance]);

  useFrame((_, dt) => {
    const c = controls.current;
    const f = flight.current;
    if (!c || !f) return;
    const k = 1 - Math.exp(-3.5 * Math.min(dt, 0.1));
    const offset = tmp.current.copy(camera.position).sub(c.target);
    const dist = THREE.MathUtils.lerp(offset.length(), f.distance, k);
    c.target.lerp(f.target, k);
    camera.position.copy(c.target).addScaledVector(offset.normalize(), dist);
    if (c.target.distanceTo(f.target) < 0.05 && Math.abs(dist - f.distance) < 0.05) flight.current = null;
    c.update();
  });

  const clamp = () => {
    const c = controls.current;
    if (!c) return;
    const x = THREE.MathUtils.clamp(c.target.x, bounds.minX, bounds.maxX);
    const z = THREE.MathUtils.clamp(c.target.z, bounds.minZ, bounds.maxZ);
    const dx = x - c.target.x;
    const dz = z - c.target.z;
    if (dx || dz) {
      c.target.x = x;
      c.target.z = z;
      camera.position.x += dx;
      camera.position.z += dz;
    }
  };

  return (
    <MapControls
      ref={controls}
      makeDefault
      target={initialTarget}
      enableRotate={false}
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning={false}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      zoomSpeed={1.2}
      panSpeed={1.4}
      onStart={() => (flight.current = null)}
      onChange={clamp}
    />
  );
}
