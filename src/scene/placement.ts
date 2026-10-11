import { LOBBY_Z, LOUNGE_X, LOUNGE_Z, POD_CENTER_Z, WALKWAY_Z, roomX } from '../data/layout';
import type { Campus, Cohort, Room } from '../data/types';

/** World-space transform of a cohort group; rot is a Y rotation (group faces +z). */
export interface Placement {
  x: number;
  z: number;
  rot: number;
  /** Seated in a classroom (desk grid) rather than standing as a group. */
  seated: boolean;
}

/**
 * Pure geometry: where each cohort should stand given its status. Cohorts of
 * the same status on the same campus get consecutive slots, ordered by id.
 */
export function computeCohortPlacements(
  cohorts: Record<string, Cohort>,
  rooms: Record<string, Room>,
  campuses: Record<string, Campus>,
): Record<string, Placement> {
  const out: Record<string, Placement> = {};
  const slots = new Map<string, number>();
  const nextSlot = (key: string) => {
    const n = slots.get(key) ?? 0;
    slots.set(key, n + 1);
    return n;
  };

  const sorted = Object.values(cohorts).sort((a, b) => a.id.localeCompare(b.id));
  for (const c of sorted) {
    const o = campuses[c.campusId].origin;
    const room = c.roomId ? rooms[c.roomId] : null;
    let p: Omit<Placement, 'seated'>;
    let seated = false;

    switch (c.status) {
      case 'checked_in':
      case 'lecture':
      case 'practice':
        if (room) {
          // Facing the screen on the building side of the pod.
          p = { x: roomX(room.index), z: POD_CENTER_Z + 0.6, rot: Math.PI };
          seated = c.status !== 'checked_in';
        } else {
          p = { x: 0, z: LOBBY_Z, rot: Math.PI };
        }
        break;
      case 'waiting':
        p = { x: 30 - nextSlot(`${c.campusId}:w`) * 9, z: LOBBY_Z, rot: Math.PI };
        break;
      case 'moving':
        p = { x: -46 + nextSlot(`${c.campusId}:m`) * 12, z: WALKWAY_Z + 2, rot: Math.PI / 2 };
        break;
      case 'leaving':
        p = { x: 40 - nextSlot(`${c.campusId}:l`) * 12, z: WALKWAY_Z - 2, rot: -Math.PI / 2 };
        break;
      case 'break':
      default:
        p = { x: LOUNGE_X, z: LOUNGE_Z + nextSlot(`${c.campusId}:b`) * 5, rot: -Math.PI / 2 };
    }
    out[c.id] = { x: o.x + p.x, z: o.z + p.z, rot: p.rot, seated };
  }
  return out;
}
