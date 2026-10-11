import {
  BAYS,
  CHARGER,
  CROSS_AISLE_X,
  FRONT_Z,
  PREP_ZONE,
  TRAVEL_AISLE_Z,
  rackX,
  roomX,
} from '../data/layout';
import { SESSION_TITLES } from '../data/seed';
import type { Assistant, Cohort, Room, Session, Vec2, WorldData } from '../data/types';

/** Completed sessions kept for the rolling on-time KPI. */
const MAX_COMPLETED = 40;

/**
 * One step of the live simulation. Pure: returns a new WorldData and only
 * replaces the records that actually changed, so React components that
 * subscribe to a single cohort or robot re-render only when it changes.
 */
export function simulateTick(world: WorldData, now: number, rand: () => number): WorldData {
  const rooms = { ...world.rooms };
  const cohorts = { ...world.cohorts };
  const sessions = { ...world.sessions };
  const materials = { ...world.materials };
  const assistants = { ...world.assistants };

  const chance = (p: number) => rand() < p;
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const patchCohort = (c: Cohort, p: Partial<Cohort>) => (cohorts[c.id] = { ...c, ...p, lastUpdate: now });
  const patchRoom = (r: Room, p: Partial<Room>) => (rooms[r.id] = { ...r, ...p, lastUpdate: now });
  const patchSession = (s: Session, p: Partial<Session>) => (sessions[s.id] = { ...s, ...p, lastUpdate: now });
  const patchAssistant = (a: Assistant, p: Partial<Assistant>) => (assistants[a.id] = { ...a, ...p, lastUpdate: now });

  let sessionSeq = Math.max(0, ...Object.keys(sessions).map((id) => Number(id.split('-')[1]) || 0));

  // ── Cohorts: break → moving → waiting → checked_in → lecture/practice → leaving → break
  for (const id of Object.keys(cohorts)) {
    const cohort = cohorts[id];
    const session = cohort.sessionId ? sessions[cohort.sessionId] : null;

    switch (cohort.status) {
      case 'break': {
        if (!chance(0.12)) break;
        let next = Object.values(sessions).find(
          (s) => s.campusId === cohort.campusId && !s.cohortId && !s.checkedInAt && (s.status === 'scheduled' || s.status === 'late'),
        );
        if (!next) {
          sessionSeq += 1;
          const campusMaterials = Object.values(materials).filter((m) => m.campusId === cohort.campusId);
          next = {
            id: `ses-${String(sessionSeq).padStart(3, '0')}`,
            reference: `S-2610-${String(sessionSeq).padStart(4, '0')}`,
            title: pick(SESSION_TITLES[cohort.track]),
            campusId: cohort.campusId,
            kind: chance(0.5) ? 'lecture' : 'practice',
            status: 'scheduled',
            cohortId: null,
            roomId: null,
            lines: [{ materialId: pick(campusMaterials).id, quantity: 5 + Math.floor(rand() * 3) * 5 }],
            // Tight schedule (sim time is compressed), so some classes arrive late.
            startAt: now + (8 + Math.floor(rand() * 24)) * 1000,
            checkedInAt: null,
            lastUpdate: now,
          };
        }
        patchSession(next, { status: next.startAt < now ? 'late' : 'moving', cohortId: cohort.id });
        patchCohort(cohort, { status: 'moving', sessionId: next.id });
        break;
      }
      case 'moving':
        if (chance(0.25)) patchCohort(cohort, { status: 'waiting' });
        break;
      case 'waiting': {
        const room = Object.values(rooms).find(
          (r) => r.campusId === cohort.campusId && r.status === 'free' && !r.cohortId,
        );
        if (!room || !chance(0.6)) break;
        patchRoom(room, { status: 'in_session', cohortId: cohort.id });
        patchCohort(cohort, { status: 'checked_in', roomId: room.id });
        if (session) patchSession(session, { status: 'in_progress', roomId: room.id, checkedInAt: now });
        break;
      }
      case 'checked_in':
        if (chance(0.45)) patchCohort(cohort, { status: session?.kind === 'practice' ? 'practice' : 'lecture' });
        break;
      case 'lecture':
      case 'practice': {
        if (!chance(0.22)) break;
        if (session) {
          // Materials handed out during the class leave the cabinets.
          for (const line of session.lines) {
            const m = materials[line.materialId];
            if (m) materials[m.id] = { ...m, quantity: Math.max(0, m.quantity - line.quantity) };
          }
          patchSession(session, { status: 'completed', cohortId: null });
        }
        const room = cohort.roomId ? rooms[cohort.roomId] : null;
        if (room) patchRoom(room, { status: 'free', cohortId: null });
        patchCohort(cohort, { status: 'leaving', roomId: null, sessionId: null });
        break;
      }
      case 'leaving':
        if (chance(0.4)) patchCohort(cohort, { status: 'break' });
        break;
    }
  }

  // ── Sessions: flag classes that missed their start time.
  for (const s of Object.values(sessions)) {
    if ((s.status === 'moving' || s.status === 'scheduled') && s.startAt < now) {
      patchSession(s, { status: 'late' });
    }
  }

  // ── Keep a rolling history: drop the oldest completed sessions.
  const completed = Object.values(sessions)
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.lastUpdate - a.lastUpdate);
  for (const s of completed.slice(MAX_COMPLETED)) delete sessions[s.id];

  // ── Rooms: occasional equipment checks.
  for (const room of Object.values(rooms)) {
    if (room.status === 'free' && chance(0.004)) patchRoom(room, { status: 'maintenance' });
    else if (room.status === 'maintenance' && chance(0.08)) patchRoom(room, { status: 'free' });
  }

  // ── Restocking: low materials get replenished from time to time.
  for (const m of Object.values(materials)) {
    if (m.quantity <= m.reorderPoint && chance(0.05)) {
      materials[m.id] = { ...m, quantity: m.quantity + m.reorderPoint * 3 };
    }
  }

  // ── Assistant robots.
  const activeByCampus = new Map<string, Session[]>();
  for (const s of Object.values(sessions)) {
    if (s.status !== 'in_progress') continue;
    activeByCampus.set(s.campusId, [...(activeByCampus.get(s.campusId) ?? []), s]);
  }

  for (const id of Object.keys(assistants)) {
    const bot = assistants[id];
    const drain = bot.status === 'moving' ? 1.6 : bot.status === 'assisting' ? 2.2 : 0.2;

    switch (bot.status) {
      case 'fault':
        if (chance(0.15)) patchAssistant(bot, { status: 'idle' });
        break;
      case 'charging':
        if (dist(bot.position, CHARGER) > 0.1) {
          patchAssistant(bot, { position: stepTowards(bot.position, CHARGER, 6), target: { ...CHARGER } });
        } else if (bot.battery >= 95) {
          patchAssistant(bot, { status: 'idle', battery: 100 });
        } else {
          patchAssistant(bot, { battery: Math.min(100, bot.battery + 9) });
        }
        break;
      case 'idle':
        if (chance(0.004)) {
          patchAssistant(bot, { status: 'fault' });
        } else if (bot.battery < 20) {
          patchAssistant(bot, { status: 'charging', sessionId: null });
        } else if (chance(0.45)) {
          const work = activeByCampus.get(bot.campusId);
          const task = work && chance(0.7) ? pick(work) : null;
          patchAssistant(bot, {
            status: 'moving',
            target: task ? roomEntrance(task, rooms) : randomPickPoint(rand),
            sessionId: task?.id ?? null,
            battery: Math.max(0, bot.battery - drain),
          });
        }
        break;
      case 'moving': {
        const position = stepTowards(bot.position, bot.target, 6);
        const arrived = dist(position, bot.target) < 0.1;
        patchAssistant(bot, {
          position,
          status: arrived ? 'assisting' : 'moving',
          battery: Math.max(0, bot.battery - drain),
        });
        break;
      }
      case 'assisting':
        if (chance(0.5)) {
          patchAssistant(bot, {
            status: bot.battery < 20 ? 'charging' : 'idle',
            sessionId: null,
            battery: Math.max(0, bot.battery - drain),
          });
        }
        break;
    }
  }

  return { ...world, rooms, cohorts, sessions, materials, assistants };
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Move up to `maxStep` metres towards `target`, following the aisles:
 * robots only change rows on a cross aisle or inside the open prep zone.
 */
export function stepTowards(from: Vec2, target: Vec2, maxStep: number): Vec2 {
  // One straight segment per tick, so the scene animates along the aisles.
  const wp = nextWaypoint(from, target);
  const d = dist(from, wp);
  if (d <= maxStep) return { ...wp };
  const k = maxStep / d;
  return { x: from.x + (wp.x - from.x) * k, z: from.z + (wp.z - from.z) * k };
}

function nextWaypoint(pos: Vec2, target: Vec2): Vec2 {
  if (Math.abs(pos.z - target.z) < 1e-6) return target;
  const inOpenArea = pos.x >= CROSS_AISLE_X[1] - 1e-6;
  const onCross = CROSS_AISLE_X.some((x) => Math.abs(pos.x - x) < 1e-6);
  if (inOpenArea || onCross) return { x: pos.x, z: target.z };
  const nearest = CROSS_AISLE_X.reduce((a, b) => (Math.abs(b - pos.x) < Math.abs(a - pos.x) ? b : a));
  return { x: nearest, z: pos.z };
}

/** Just inside the entrance of the room a session runs in. */
function roomEntrance(session: Session, rooms: Record<string, Room>): Vec2 {
  const room = session.roomId ? rooms[session.roomId] : null;
  return { x: room ? roomX(room.index) : 20, z: FRONT_Z - 3 };
}

function randomPickPoint(rand: () => number): Vec2 {
  if (rand() < 0.35) {
    return {
      x: PREP_ZONE.minX + 2 + rand() * (PREP_ZONE.maxX - PREP_ZONE.minX - 4),
      z: PREP_ZONE.minZ + 4 + rand() * (PREP_ZONE.maxZ - PREP_ZONE.minZ - 6),
    };
  }
  const bay = 1 + Math.floor(rand() * BAYS);
  return { x: rackX(bay), z: TRAVEL_AISLE_Z[Math.floor(rand() * TRAVEL_AISLE_Z.length)] };
}
