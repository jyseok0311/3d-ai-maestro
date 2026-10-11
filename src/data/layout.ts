import type { Vec2 } from './types';

/**
 * Shared site-local floor plan. Every site uses the same layout, so both the
 * simulation (forklift routes) and the 3D scene read from here.
 *
 *            z = -26  ┌──────────── building ────────────┐
 *   rack rows A–F     │ ▤▤▤▤▤  ▤▤▤▤▤        staging zone │
 *                     │ ▤▤▤▤▤  ▤▤▤▤▤          ⚡ charger  │
 *            z =  14  └──D1───D2───D3───D4───D5───D6─────┘  dock wall
 *                          trucks at docks
 *            z =  31     queue lane
 *            z =  41  ═══════════ road ═══════════
 *   All truck slots lie in the yard (z > 14), so straight moves between
 *   them never cross the building.
 */

export const SITE_SPACING = 125;

export const BUILDING = { minX: -36, maxX: 36, minZ: -26, maxZ: 14 } as const;
export const DOCK_WALL_Z = BUILDING.maxZ;

export const AISLES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const BAYS = 10;
export const LEVELS = 3;
export const RACK_ROW_Z = [-22, -17, -12, -7, -2, 3];
export const RACK_SIZE = { w: 2.8, d: 1.4, h: 3.6 } as const;

export function rackX(bay: number): number {
  const j = bay - 1;
  return j < 5 ? -30 + j * 3 : -9 + (j - 5) * 3;
}

/** Cross aisles where forklifts can change rack rows. */
export const CROSS_AISLE_X = [-13.5, 8];
/** z values of the travel aisles between rack rows. */
export const TRAVEL_AISLE_Z = RACK_ROW_Z.slice(0, -1).map((z) => z + 2.5);

export const STAGING = { minX: 11, maxX: 33, minZ: -23, maxZ: 10 } as const;
export const CHARGER: Vec2 = { x: 31, z: -22 };

export const DOCK_COUNT = 6;
export function dockX(index: number): number {
  return -27.5 + index * 11;
}

export const TRUCK_LENGTH = 9;
export const QUEUE_Z = 31;
export const ROAD_Z = 41;
/** Idle trucks park in the south-east yard, outside the building. */
export const PARKING_X = 48;
export const PARKING_Z = 18;

export function worldBounds(siteCount: number) {
  const half = ((siteCount - 1) / 2) * SITE_SPACING + 55;
  return { minX: -half, maxX: half, minZ: -60, maxZ: 75 };
}
