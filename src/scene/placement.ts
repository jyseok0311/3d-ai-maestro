import { ENTRY_X, EXIT_X, LOBBY_Z, QUEUE_Z, ROAD_Z, seatSpot, zoneX, type Spot } from '../data/layout';
import type { Facility, Participant, StageKey } from '../data/types';

/** Standing slots in a row (wrapping to a second row), zone-local. */
function rowSlot(i: number, z: number): { x: number; z: number } {
  const perRow = 18;
  return { x: -21 + (i % perRow) * 2.5, z: z + Math.floor(i / perRow) * 2.4 };
}

/**
 * Pure geometry: the world-space spot for every participant given status,
 * facility and seat. People without a seat queue in their zone's lobby row,
 * ordered by id so the slots stay stable between ticks.
 */
export function computeSpots(
  participants: Record<string, Participant>,
  facilities: Record<string, Facility>,
): Record<string, Spot> {
  const out: Record<string, Spot> = {};
  const counters = new Map<string, number>();
  const next = (key: string) => {
    const n = counters.get(key) ?? 0;
    counters.set(key, n + 1);
    return n;
  };
  const inZone = (stage: StageKey, s: { x: number; z: number }, extra: Partial<Spot> = {}): Spot => ({
    x: zoneX(stage) + s.x,
    z: s.z,
    rot: Math.PI,
    seated: false,
    ...extra,
  });

  const sorted = Object.values(participants).sort((a, b) => a.id.localeCompare(b.id));
  for (const p of sorted) {
    const f = p.facilityId ? facilities[p.facilityId] : null;
    if (f && p.seat !== null) {
      const s = seatSpot(f, p.seat);
      out[p.id] = { ...s, x: zoneX(f.stage) + s.x };
      continue;
    }
    switch (p.status) {
      case 'applied':
        out[p.id] = inZone('selection', rowSlot(next('queue'), QUEUE_Z));
        break;
      case 'selected':
        out[p.id] = inZone('training', rowSlot(next('train-lobby'), LOBBY_Z));
        break;
      case 'study_wait':
        out[p.id] = inZone('study', rowSlot(next('study-lobby'), LOBBY_Z));
        break;
      case 'not_selected':
        // Back along the road to where they came in.
        out[p.id] = { x: ENTRY_X - next('out-left') * 2, z: ROAD_Z - 1.5, rot: -Math.PI / 2, seated: false };
        break;
      case 'graduated':
        out[p.id] = { x: EXIT_X + next('out-right') * 2, z: ROAD_Z + 1.5, rot: Math.PI / 2, seated: false };
        break;
      default:
        // E.g. a full audience: stand at the back of the hall.
        out[p.id] = inZone('showcase', rowSlot(next('showcase-standing'), LOBBY_Z));
    }
  }
  return out;
}
