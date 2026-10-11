import { FACILITY_SPECS, STAGE_ORDER, zoneX } from './layout';
import { DEPARTMENTS, MENTORS, TEAM_NAMES, TITLES, TOPICS, makeName } from './people';
import type { Facility, Participant, ParticipantStatus, Stage, StageKey, Team, WorldData } from './types';

/** Deterministic PRNG so the seed is identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAGE_DEFS: Record<StageKey, { name: string; subtitle: string }> = {
  selection: { name: '선발', subtitle: '지원 · 서류심사 · 면접' },
  training: { name: '교육', subtitle: 'AI 실무 교육 8회차' },
  study: { name: '자율스터디', subtitle: '팀 프로젝트 · 멘토링' },
  showcase: { name: '성과공유회', subtitle: '발표 · 시상 · 수료' },
};

export const ASSIGNMENTS_TOTAL = 4;
export const SESSIONS_TO_FINISH = 8;

/** Stage a participant status belongs to. */
export function stageOf(status: ParticipantStatus): StageKey {
  switch (status) {
    case 'applied':
    case 'screening':
    case 'interview':
    case 'not_selected':
      return 'selection';
    case 'selected':
    case 'training':
      return 'training';
    case 'study_wait':
    case 'studying':
      return 'study';
    default:
      return 'showcase';
  }
}

export function newParticipant(
  rand: () => number,
  id: string,
  generation: number,
  status: ParticipantStatus,
  now: number,
): Participant {
  return {
    id,
    name: makeName(rand),
    department: DEPARTMENTS[Math.floor(rand() * DEPARTMENTS.length)],
    title: TITLES[Math.floor(rand() * TITLES.length)],
    generation,
    stage: stageOf(status),
    status,
    facilityId: null,
    seat: null,
    teamId: null,
    score: null,
    sessionsHeld: 0,
    sessionsAttended: 0,
    assignmentsDone: 0,
    assignmentsTotal: ASSIGNMENTS_TOTAL,
    lastUpdate: now,
  };
}

export function newTeam(id: string, n: number, now: number): Team {
  return {
    id,
    name: `${TEAM_NAMES[n % TEAM_NAMES.length]}팀`,
    topic: TOPICS[n % TOPICS.length],
    mentor: MENTORS[n % MENTORS.length],
    memberIds: [],
    tableId: null,
    phase: 'forming',
    progress: 0,
    stalled: false,
    award: null,
    readyAt: null,
    lastUpdate: now,
  };
}

/** Build the seed: one snapshot with people at every step of the journey. */
export function createSeed(now: number = Date.now()): WorldData {
  const rand = mulberry32(20261011);
  const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${String(++seq).padStart(3, '0')}`;

  const stages = Object.fromEntries(
    STAGE_ORDER.map((id, i) => [id, { id, order: i + 1, ...STAGE_DEFS[id], origin: { x: zoneX(id), z: 0 } } satisfies Stage]),
  ) as Record<StageKey, Stage>;

  const facilities: Record<string, Facility> = {};
  for (const spec of FACILITY_SPECS) {
    for (let i = 0; i < spec.count; i++) {
      const id = `${spec.kind}-${i + 1}`;
      facilities[id] = { id, stage: spec.stage, kind: spec.kind, index: i, label: spec.label(i), capacity: spec.capacity };
    }
  }

  const participants: Record<string, Participant> = {};
  const add = (generation: number, status: ParticipantStatus, patch: Partial<Participant> = {}) => {
    const p = { ...newParticipant(rand, nextId('p'), generation, status, now - randInt(1, 90) * 1000), ...patch };
    participants[p.id] = p;
    return p;
  };

  // ① Selection (5기): queue, three at booths, two in interviews.
  for (let i = 0; i < 6; i++) add(5, 'applied');
  for (let i = 0; i < 3; i++) add(5, 'screening', { facilityId: `booth-${i + 1}`, seat: 0 });
  for (let i = 0; i < 2; i++) add(5, 'interview', { facilityId: `interview-${i + 1}`, seat: 0, score: randInt(72, 92) });

  // ② Training (4기): two just selected, 19 in three classrooms.
  for (let i = 0; i < 2; i++) add(5, 'selected', { score: randInt(76, 95) });
  [7, 6, 6].forEach((n, c) => {
    for (let s = 0; s < n; s++) {
      const held = randInt(1, 5);
      add(4, 'training', {
        facilityId: `classroom-${c + 1}`,
        seat: s,
        score: randInt(75, 96),
        sessionsHeld: held,
        // A couple of learners start with weak attendance.
        sessionsAttended: rand() < 0.15 ? Math.max(0, held - 2) : held,
        assignmentsDone: randInt(0, Math.min(3, held)),
      });
    }
  });

  // ③ Study (3기): four teams at tables 1–4, one waiting for a team.
  const teams: Record<string, Team> = {};
  let teamCount = 0;
  const makeTeam = () => {
    const t = newTeam(nextId('team'), teamCount++, now);
    teams[t.id] = t;
    return t;
  };
  const finishedTraining = { score: 0, sessionsHeld: 8, sessionsAttended: 8, assignmentsDone: ASSIGNMENTS_TOTAL };
  for (let t = 0; t < 4; t++) {
    const team = makeTeam();
    team.phase = 'studying';
    team.tableId = `table-${t + 1}`;
    team.progress = [72, 45, 28, 61][t];
    team.stalled = t === 2;
    for (let s = 0; s < 4; s++) {
      const p = add(3, 'studying', { ...finishedTraining, score: randInt(75, 96), facilityId: team.tableId, seat: s, teamId: team.id });
      team.memberIds.push(p.id);
    }
  }
  add(4, 'study_wait', { ...finishedTraining, score: randInt(75, 96) });

  // ④ Showcase (3기): one team presenting, one waiting in the audience.
  let audienceSeat = 0;
  (['presenting', 'ready'] as const).forEach((phase) => {
    const team = makeTeam();
    team.phase = phase;
    team.progress = 100;
    team.readyAt = now - randInt(10, 60) * 1000;
    for (let s = 0; s < 4; s++) {
      const status = phase === 'presenting' ? 'presenting' : 'audience';
      const p = add(3, status, {
        ...finishedTraining,
        score: randInt(75, 96),
        teamId: team.id,
        facilityId: phase === 'presenting' ? 'stage-1' : 'audience-1',
        seat: phase === 'presenting' ? s : audienceSeat++,
      });
      team.memberIds.push(p.id);
    }
  });

  return {
    stages,
    facilities,
    participants,
    teams,
    events: [],
    stats: { generation: 5, applied: 132, selected: 81, notSelected: 38, graduated: 44, presentedTeams: 11 },
    seq,
  };
}
