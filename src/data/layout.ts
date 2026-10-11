import type { Facility, FacilityKind, StageKey } from './types';

/**
 * World layout: four zones side by side along one road, in journey order.
 *
 *   ┌ ① 선발 ┐   ┌ ② 교육 ┐   ┌ ③ 자율스터디 ┐   ┌ ④ 성과공유회 ┐
 *   │booths  │   │class×3 │   │ tables ×8     │   │ stage        │
 *   │interview│  │        │   │               │   │ audience     │
 *   └────────┘   └────────┘   └───────────────┘   └──────────────┘
 *  ═══════════════════════ road (z = 31) ═══════════════════════════  → exit
 *
 * Zone-local coordinates: x across the zone, z from back (-) to road (+).
 * Seats face -z (towards the back wall / screen / stage) unless noted.
 */

export const STAGE_ORDER: StageKey[] = ['selection', 'training', 'study', 'showcase'];
export const ZONE_SPACING = 72;
export const ZONE = { w: 60, d: 46 } as const;
export const ROAD_Z = 31;

export function zoneX(stage: StageKey): number {
  return (STAGE_ORDER.indexOf(stage) - 1.5) * ZONE_SPACING;
}

/** Where new applicants arrive and where people leave the map. */
export const ENTRY_X = zoneX('selection') - ZONE_SPACING / 2 - 8;
export const EXIT_X = zoneX('showcase') + ZONE_SPACING / 2 + 8;

// ── ① Selection ─────────────────────────────────────────────────────────
export const QUEUE_Z = 17;
export const BOOTH_X = [-17, 0, 17];
export const BOOTH_Z = 5;
export const INTERVIEW_X = [-14, 14];
export const INTERVIEW_Z = -10;
export const INTERVIEW_ROOM = { w: 15, d: 11 } as const;

// ── ② Training ──────────────────────────────────────────────────────────
export const CLASS_X = [-19.5, 0, 19.5];
export const CLASS_Z = -5;
export const CLASSROOM = { w: 17, d: 14 } as const;
export const LOBBY_Z = 16;

// ── ③ Study ─────────────────────────────────────────────────────────────
export const TABLE_X = [-21, -7, 7, 21];
export const TABLE_Z = [-10, 6];
export const TABLE_RADIUS = 2.4;

// ── ④ Showcase ──────────────────────────────────────────────────────────
export const STAGE_PLATFORM = { z: -14, w: 30, d: 8, h: 1 } as const;
export const AUDIENCE = { cols: 8, rows: 5, x0: -10.5, dx: 3, z0: -1, dz: 2.6 } as const;

export const FACILITY_SPECS: { stage: StageKey; kind: FacilityKind; count: number; capacity: number; label: (i: number) => string }[] = [
  { stage: 'selection', kind: 'booth', count: 3, capacity: 1, label: (i) => `서류심사 부스 ${i + 1}` },
  { stage: 'selection', kind: 'interview', count: 2, capacity: 1, label: (i) => `면접실 ${String.fromCharCode(65 + i)}` },
  { stage: 'training', kind: 'classroom', count: 3, capacity: 8, label: (i) => `AI 강의실 ${i + 1}` },
  { stage: 'study', kind: 'table', count: 8, capacity: 4, label: (i) => `스터디 테이블 ${i + 1}` },
  { stage: 'showcase', kind: 'stage', count: 1, capacity: 5, label: () => '발표 무대' },
  { stage: 'showcase', kind: 'audience', count: 1, capacity: AUDIENCE.cols * AUDIENCE.rows, label: () => '관람석' },
];

/** Zone-local centre of a facility (used for click targets and highlights). */
export function facilityCenter(f: Facility): { x: number; z: number } {
  switch (f.kind) {
    case 'booth':
      return { x: BOOTH_X[f.index], z: BOOTH_Z };
    case 'interview':
      return { x: INTERVIEW_X[f.index], z: INTERVIEW_Z };
    case 'classroom':
      return { x: CLASS_X[f.index], z: CLASS_Z };
    case 'table':
      return { x: TABLE_X[f.index % 4], z: TABLE_Z[Math.floor(f.index / 4)] };
    case 'stage':
      return { x: 0, z: STAGE_PLATFORM.z };
    case 'audience':
      return { x: 0, z: AUDIENCE.z0 + ((AUDIENCE.rows - 1) * AUDIENCE.dz) / 2 };
  }
}

export interface Spot {
  x: number;
  z: number;
  /** Y rotation; figures face +z at 0. */
  rot: number;
  seated: boolean;
  /** Height of the floor the figure stands on. */
  y?: number;
}

const FACE_BACK = Math.PI;

/** Zone-local position of seat `seat` in facility `f`. */
export function seatSpot(f: Facility, seat: number): Spot {
  const c = facilityCenter(f);
  switch (f.kind) {
    case 'booth':
      return { x: c.x, z: c.z + 2.2, rot: FACE_BACK, seated: true };
    case 'interview':
      return { x: c.x, z: c.z + 2.4, rot: FACE_BACK, seated: true };
    case 'classroom': {
      const col = seat % 4;
      const row = Math.floor(seat / 4);
      return { x: c.x + (col - 1.5) * 3.2, z: c.z + 0.5 + row * 3.4, rot: FACE_BACK, seated: true };
    }
    case 'table': {
      const a = (seat / 4) * Math.PI * 2 + Math.PI / 4;
      const x = c.x + Math.sin(a) * TABLE_RADIUS;
      const z = c.z + Math.cos(a) * TABLE_RADIUS;
      return { x, z, rot: Math.atan2(c.x - x, c.z - z), seated: true };
    }
    case 'stage':
      return { x: (seat - 2) * 2.4, z: STAGE_PLATFORM.z + 1, rot: 0, seated: false, y: STAGE_PLATFORM.h };
    case 'audience': {
      const col = seat % AUDIENCE.cols;
      const row = Math.floor(seat / AUDIENCE.cols);
      return { x: AUDIENCE.x0 + col * AUDIENCE.dx, z: AUDIENCE.z0 + row * AUDIENCE.dz, rot: FACE_BACK, seated: true };
    }
  }
}

export function worldBounds() {
  const half = 1.5 * ZONE_SPACING + 40;
  return { minX: -half, maxX: half, minZ: -50, maxZ: 70 };
}
