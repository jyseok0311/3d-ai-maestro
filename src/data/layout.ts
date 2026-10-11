import type { Vec2 } from './types';

/**
 * Shared campus-local floor plan. Every campus uses the same layout, so both
 * the simulation (robot routes) and the 3D scene read from here.
 *
 *            z = -26  ┌────────── training centre ──────────┐
 *   cabinet rows A–F  │ ▤▤▤▤▤  ▤▤▤▤▤      practice prep zone │
 *                     │ ▤▤▤▤▤  ▤▤▤▤▤            ⚡ charger  │
 *            z =  14  └──R1───R2───R3───R4───R5───R6───────┘  front entrances
 *                       [glass classroom pods R1–R6]
 *            z =  31     lobby queue                     lounge →
 *            z =  41  ═══════════ campus walkway ═══════════
 *   All cohort slots lie outside the building (z > 14), so straight moves
 *   between them never cross it.
 */

export const CAMPUS_SPACING = 125;

export const BUILDING = { minX: -36, maxX: 36, minZ: -26, maxZ: 14 } as const;
export const FRONT_Z = BUILDING.maxZ;

export const AISLES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const BAYS = 10;
export const LEVELS = 3;
export const RACK_ROW_Z = [-22, -17, -12, -7, -2, 3];
export const RACK_SIZE = { w: 2.8, d: 1.4, h: 3.6 } as const;

export function rackX(bay: number): number {
  const j = bay - 1;
  return j < 5 ? -30 + j * 3 : -9 + (j - 5) * 3;
}

/** Cross aisles where robots can change cabinet rows. */
export const CROSS_AISLE_X = [-13.5, 8];
/** z values of the travel aisles between cabinet rows. */
export const TRAVEL_AISLE_Z = RACK_ROW_Z.slice(0, -1).map((z) => z + 2.5);

export const PREP_ZONE = { minX: 11, maxX: 33, minZ: -23, maxZ: 10 } as const;
export const CHARGER: Vec2 = { x: 31, z: -22 };

export const ROOM_COUNT = 6;
export function roomX(index: number): number {
  return -27.5 + index * 11;
}
/** Classroom pod footprint, in front of each entrance. */
export const POD = { w: 9, d: 8.6 } as const;
export const POD_CENTER_Z = FRONT_Z + 0.7 + POD.d / 2;

export const LOBBY_Z = 31;
export const WALKWAY_Z = 41;
/** Cohorts on a break gather in the south-east lounge, outside the building. */
export const LOUNGE_X = 48;
export const LOUNGE_Z = 18;

export function worldBounds(campusCount: number) {
  const half = ((campusCount - 1) / 2) * CAMPUS_SPACING + 55;
  return { minX: -half, maxX: half, minZ: -60, maxZ: 75 };
}
