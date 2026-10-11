import { TEAM_NAMES } from '../data/people';
import { ASSIGNMENTS_TOTAL, SESSIONS_TO_FINISH, newParticipant, newTeam, stageOf } from '../data/seed';
import type { ActivityEvent, Award, Participant, ParticipantStatus, StageKey, Team, WorldData } from '../data/types';

const MAX_PARTICIPANTS = 60;
const MAX_EVENTS = 40;
const TEAM_SIZE = 4;
const SELECTION_CUTOFF = { screening: 68, final: 75 };

/**
 * One step of the live simulation. Pure: returns a new WorldData and only
 * replaces the records that actually changed, so the scene and panels update
 * only for people and teams whose state moved.
 */
export function simulateTick(world: WorldData, now: number, rand: () => number): WorldData {
  const participants = { ...world.participants };
  const teams = { ...world.teams };
  const stats = { ...world.stats };
  const newEvents: ActivityEvent[] = [];
  let seq = world.seq;
  const nextId = (prefix: string) => `${prefix}-${String(++seq).padStart(3, '0')}`;

  const chance = (p: number) => rand() < p;
  const log = (stage: StageKey, text: string, ref: ActivityEvent['ref'] = null) =>
    newEvents.push({ id: nextId('ev'), ts: now, stage, text, ref });
  const patch = (p: Participant, change: Partial<Participant>) => {
    const status = change.status ?? p.status;
    return (participants[p.id] = { ...p, ...change, stage: stageOf(status), lastUpdate: now });
  };
  const patchTeam = (t: Team, change: Partial<Team>) => (teams[t.id] = { ...t, ...change, lastUpdate: now });
  const move = (p: Participant, status: ParticipantStatus, facilityId: string | null = null, seat: number | null = null, extra: Partial<Participant> = {}) =>
    patch(p, { status, facilityId, seat, ...extra });

  /** Lowest free seat in a facility, or null when it is full. */
  const freeSeat = (facilityId: string): number | null => {
    const f = world.facilities[facilityId];
    const taken = new Set(
      Object.values(participants)
        .filter((p) => p.facilityId === facilityId)
        .map((p) => p.seat),
    );
    for (let s = 0; s < f.capacity; s++) if (!taken.has(s)) return s;
    return null;
  };
  const firstFree = (kind: string): { facilityId: string; seat: number } | null => {
    for (const f of Object.values(world.facilities)) {
      if (f.kind !== kind) continue;
      const seat = freeSeat(f.id);
      if (seat !== null) return { facilityId: f.id, seat };
    }
    return null;
  };

  // ── Participants ──────────────────────────────────────────────────────
  // Oldest updates first, so queues are served in arrival order.
  const order = Object.values(participants).sort((a, b) => a.lastUpdate - b.lastUpdate);
  for (const snapshot of order) {
    const p = participants[snapshot.id];
    if (!p) continue;

    switch (p.status) {
      case 'applied': {
        const booth = firstFree('booth');
        if (booth && chance(0.5)) move(p, 'screening', booth.facilityId, booth.seat);
        break;
      }
      case 'screening': {
        if (!chance(0.3)) break;
        const score = p.score ?? 55 + Math.round(rand() * 45);
        if (score < SELECTION_CUTOFF.screening) {
          stats.notSelected += 1;
          move(p, 'not_selected', null, null, { score });
          log('selection', `${p.name} 서류심사 미통과`, { kind: 'participant', id: p.id });
          break;
        }
        const room = firstFree('interview');
        // Hold the booth until an interview room opens up.
        if (room) move(p, 'interview', room.facilityId, room.seat, { score });
        else patch(p, { score });
        break;
      }
      case 'interview': {
        if (!chance(0.3)) break;
        const score = Math.min(100, Math.round((p.score ?? 70) * 0.6 + (60 + rand() * 40) * 0.4));
        if (score >= SELECTION_CUTOFF.final) {
          stats.selected += 1;
          move(p, 'selected', null, null, { score });
          log('selection', `${p.name}(${p.department}) 최종 선발 · ${score}점`, { kind: 'participant', id: p.id });
        } else {
          stats.notSelected += 1;
          move(p, 'not_selected', null, null, { score });
          log('selection', `${p.name} 면접 후 미선발`, { kind: 'participant', id: p.id });
        }
        break;
      }
      case 'selected': {
        const seat = firstFree('classroom');
        if (seat && chance(0.5)) move(p, 'training', seat.facilityId, seat.seat);
        break;
      }
      case 'training': {
        let { sessionsHeld, sessionsAttended, assignmentsDone } = p;
        if (chance(0.3)) {
          sessionsHeld += 1;
          // Each person has a stable attendance habit derived from their id.
          const habit = 0.86 + (Number(p.id.split('-')[1]) % 7) * 0.02;
          if (rand() < habit) sessionsAttended += 1;
        }
        if (assignmentsDone < ASSIGNMENTS_TOTAL && chance(0.12)) assignmentsDone += 1;
        const done = sessionsHeld >= SESSIONS_TO_FINISH && assignmentsDone >= ASSIGNMENTS_TOTAL;
        if (done) {
          move(p, 'study_wait', null, null, { sessionsHeld, sessionsAttended, assignmentsDone });
          log('training', `${p.name} 교육 이수 · 출석 ${Math.round((sessionsAttended / sessionsHeld) * 100)}%`, {
            kind: 'participant',
            id: p.id,
          });
        } else if (sessionsHeld !== p.sessionsHeld || assignmentsDone !== p.assignmentsDone) {
          patch(p, { sessionsHeld, sessionsAttended, assignmentsDone });
        }
        break;
      }
      case 'study_wait': {
        if (!chance(0.5)) break;
        // Join a forming team with room, or start a new one at a free table.
        let team = Object.values(teams).find((t) => t.phase === 'forming' && t.memberIds.length < TEAM_SIZE);
        if (!team) {
          const table = Object.values(world.facilities).find(
            (f) => f.kind === 'table' && !Object.values(teams).some((t) => t.tableId === f.id),
          );
          if (!table) break;
          const used = new Set(Object.values(teams).map((t) => t.name));
          const n = Math.max(0, TEAM_NAMES.findIndex((name) => !used.has(`${name}팀`)));
          team = newTeam(nextId('team'), n, now);
          team.tableId = table.id;
          teams[team.id] = team;
        }
        const seat = freeSeat(team.tableId!);
        if (seat === null) break;
        const members = [...team.memberIds, p.id];
        const full = members.length >= TEAM_SIZE;
        patchTeam(team, { memberIds: members, phase: full ? 'studying' : 'forming' });
        move(p, 'studying', team.tableId, seat, { teamId: team.id });
        if (full) log('study', `${team.name} 결성 · 주제 「${team.topic}」`, { kind: 'team', id: team.id });
        break;
      }
      case 'not_selected':
      case 'graduated':
        // Walk off the map, then leave the simulation.
        if (chance(0.25)) delete participants[p.id];
        break;
    }
  }

  // ── Teams ─────────────────────────────────────────────────────────────
  for (const team of Object.values(teams)) {
    if (team.phase === 'studying') {
      if (team.stalled) {
        if (chance(0.15)) {
          patchTeam(team, { stalled: false });
          log('study', `${team.name} 멘토링으로 정체 해소 (${team.mentor})`, { kind: 'team', id: team.id });
        }
      } else if (chance(0.015)) {
        patchTeam(team, { stalled: true });
        log('study', `${team.name} 진행 정체 · 멘토 지원 필요`, { kind: 'team', id: team.id });
      } else {
        const progress = Math.min(100, team.progress + 1 + rand() * 3.5);
        if (progress >= 100) {
          patchTeam(team, { progress: 100, phase: 'ready', readyAt: now, tableId: null });
          for (const id of team.memberIds) {
            const m = participants[id];
            const seat = freeSeat('audience-1');
            if (m) move(m, 'audience', seat === null ? null : 'audience-1', seat);
          }
          log('showcase', `${team.name} 발표 준비 완료 · 성과공유회 대기`, { kind: 'team', id: team.id });
        } else {
          patchTeam(team, { progress });
        }
      }
    }
  }

  // One team presents at a time; the next ready team goes on stage after it.
  const presenting = Object.values(teams).find((t) => t.phase === 'presenting');
  if (presenting) {
    if (chance(0.2)) {
      const award = drawAward(rand);
      stats.presentedTeams += 1;
      stats.graduated += presenting.memberIds.length;
      patchTeam(presenting, { phase: 'done', award });
      for (const id of presenting.memberIds) {
        const m = participants[id];
        if (m) move(m, 'graduated');
      }
      log('showcase', `${presenting.name} 발표 완료 · ${award} · ${presenting.memberIds.length}명 수료`, {
        kind: 'team',
        id: presenting.id,
      });
    }
  } else {
    const next = Object.values(teams)
      .filter((t) => t.phase === 'ready')
      .sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0))[0];
    if (next && chance(0.5)) {
      patchTeam(next, { phase: 'presenting' });
      next.memberIds.forEach((id, i) => {
        const m = participants[id];
        if (m) move(m, 'presenting', 'stage-1', i);
      });
      log('showcase', `${next.name} 발표 시작 「${next.topic}」`, { kind: 'team', id: next.id });
    }
  }

  // Finished teams disappear once all members have left the map.
  for (const team of Object.values(teams)) {
    if (team.phase === 'done' && team.memberIds.every((id) => !participants[id])) delete teams[team.id];
  }

  // ── New applicants ────────────────────────────────────────────────────
  if (Object.keys(participants).length < MAX_PARTICIPANTS && chance(0.35)) {
    stats.applied += 1;
    // A new generation opens every 30 applications.
    if (stats.applied % 30 === 0) {
      stats.generation += 1;
      log('selection', `${stats.generation}기 모집 시작`);
    }
    const p = newParticipant(rand, nextId('p'), stats.generation, 'applied', now);
    participants[p.id] = p;
    log('selection', `${p.name}(${p.department}) ${p.generation}기 지원`, { kind: 'participant', id: p.id });
  }

  const events = newEvents.length ? [...newEvents.reverse(), ...world.events].slice(0, MAX_EVENTS) : world.events;
  return { ...world, participants, teams, stats, events, seq };
}

function drawAward(rand: () => number): Award {
  const r = rand();
  if (r < 0.1) return '대상';
  if (r < 0.3) return '최우수상';
  if (r < 0.6) return '우수상';
  return '장려상';
}
