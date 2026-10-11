import type { Participant, Team, WorldData } from '../data/types';
import type { Filters } from './useMaestroStore';

export const ATTENDANCE_WARNING = 0.8;

export function attendanceRate(p: Participant): number | null {
  return p.sessionsHeld ? p.sessionsAttended / p.sessionsHeld : null;
}

/** Weak attendance in training, or a member of a stalled study team. */
export function needsAttention(p: Participant, teams: Record<string, Team>): boolean {
  if (p.status === 'training') {
    const rate = attendanceRate(p);
    return rate !== null && p.sessionsHeld >= 3 && rate < ATTENDANCE_WARNING;
  }
  if (p.status === 'studying' && p.teamId) return teams[p.teamId]?.stalled ?? false;
  return false;
}

export function participantMatches(p: Participant, teams: Record<string, Team>, filters: Filters): boolean {
  if (filters.stage !== 'all' && p.stage !== filters.stage) return false;
  if (filters.attentionOnly && !needsAttention(p, teams)) return false;
  return true;
}

export interface Kpis {
  selectionRate: number | null;
  applied: number;
  selected: number;
  inSelection: number;
  attendance: number | null;
  assignmentRate: number | null;
  inTraining: number;
  studyProgress: number | null;
  studyTeams: number;
  stalledTeams: number;
  graduated: number;
  presentedTeams: number;
  readyTeams: number;
  attention: number;
}

export function computeKpis(world: Pick<WorldData, 'participants' | 'teams' | 'stats'>): Kpis {
  const people = Object.values(world.participants);
  const teams = Object.values(world.teams);
  const { stats } = world;

  const training = people.filter((p) => p.status === 'training');
  const held = training.reduce((n, p) => n + p.sessionsHeld, 0);
  const attended = training.reduce((n, p) => n + p.sessionsAttended, 0);
  const assignments = training.reduce((n, p) => n + p.assignmentsDone, 0);
  const assignmentSlots = training.reduce((n, p) => n + p.assignmentsTotal, 0);

  const studying = teams.filter((t) => t.phase === 'studying' || t.phase === 'forming');
  const decided = stats.selected + stats.notSelected;

  return {
    selectionRate: decided ? stats.selected / decided : null,
    applied: stats.applied,
    selected: stats.selected,
    inSelection: people.filter((p) => p.stage === 'selection' && p.status !== 'not_selected').length,
    attendance: held ? attended / held : null,
    assignmentRate: assignmentSlots ? assignments / assignmentSlots : null,
    inTraining: training.length,
    studyProgress: studying.length ? studying.reduce((n, t) => n + t.progress, 0) / studying.length / 100 : null,
    studyTeams: studying.length,
    stalledTeams: studying.filter((t) => t.stalled).length,
    graduated: stats.graduated,
    presentedTeams: stats.presentedTeams,
    readyTeams: teams.filter((t) => t.phase === 'ready').length,
    attention: people.filter((p) => needsAttention(p, world.teams)).length,
  };
}

/** Teams in journey order: on stage, ready, then studying by progress. */
export function sortTeams(teams: Record<string, Team>): Team[] {
  const rank = { presenting: 0, ready: 1, studying: 2, forming: 3, done: 4 } as const;
  return Object.values(teams).sort((a, b) => rank[a.phase] - rank[b.phase] || b.progress - a.progress);
}
