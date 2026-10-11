import {
  DOCK_WALL_Z,
  PARKING_X,
  PARKING_Z,
  QUEUE_Z,
  ROAD_Z,
  TRUCK_LENGTH,
  dockX,
} from '../data/layout';
import type { Dock, Site, Truck } from '../data/types';

/** World-space transform of a truck; rot is a Y rotation (model faces +z). */
export interface Placement {
  x: number;
  z: number;
  rot: number;
}

/**
 * Pure geometry: where each truck should stand given its status. Trucks of the
 * same status at the same site are given consecutive slots, ordered by id.
 */
export function computeTruckPlacements(
  trucks: Record<string, Truck>,
  docks: Record<string, Dock>,
  sites: Record<string, Site>,
): Record<string, Placement> {
  const out: Record<string, Placement> = {};
  const slots = new Map<string, number>();
  const nextSlot = (key: string) => {
    const n = slots.get(key) ?? 0;
    slots.set(key, n + 1);
    return n;
  };

  const sorted = Object.values(trucks).sort((a, b) => a.id.localeCompare(b.id));
  for (const t of sorted) {
    const o = sites[t.siteId].origin;
    const dock = t.dockId ? docks[t.dockId] : null;
    let p: Placement;

    switch (t.status) {
      case 'docked':
      case 'loading':
      case 'unloading':
        p = dock
          ? { x: dockX(dock.index), z: DOCK_WALL_Z + 0.7 + TRUCK_LENGTH / 2, rot: 0 }
          : { x: 0, z: QUEUE_Z, rot: -Math.PI / 2 };
        break;
      case 'queued':
        p = { x: 32 - nextSlot(`${t.siteId}:q`) * 11, z: QUEUE_Z, rot: -Math.PI / 2 };
        break;
      case 'en_route':
        p = { x: -48 + nextSlot(`${t.siteId}:r`) * 13, z: ROAD_Z + 2, rot: Math.PI / 2 };
        break;
      case 'departing':
        p = { x: 40 - nextSlot(`${t.siteId}:d`) * 12, z: ROAD_Z - 2, rot: -Math.PI / 2 };
        break;
      case 'idle':
      default:
        p = { x: PARKING_X, z: PARKING_Z + nextSlot(`${t.siteId}:p`) * 4.5, rot: Math.PI / 2 };
    }
    out[t.id] = { x: o.x + p.x, z: o.z + p.z, rot: p.rot };
  }
  return out;
}
