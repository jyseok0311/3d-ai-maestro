import type { Cohort, Material, Session, WorldData } from '../data/types';
import type { CampusFilter, Filters } from './useMaestroStore';

export const isLowStock = (m: Material) => m.quantity <= m.reorderPoint;

const inCampus = (campusId: CampusFilter) => (x: { campusId: string }) => campusId === 'all' || x.campusId === campusId;

export interface Kpis {
  onTimeRate: number | null;
  onTimeCount: number;
  checkedInCount: number;
  roomsInUse: number;
  roomsTotal: number;
  activeCohorts: number;
  cohortsTotal: number;
  lowStock: number;
  late: number;
}

export function computeKpis(
  world: Pick<WorldData, 'rooms' | 'cohorts' | 'materials' | 'sessions'>,
  campusId: CampusFilter,
): Kpis {
  const f = inCampus(campusId);
  const sessions = Object.values(world.sessions).filter(f);
  const checkedIn = sessions.filter((s) => s.checkedInAt !== null);
  const onTime = checkedIn.filter((s) => (s.checkedInAt as number) <= s.startAt);
  const rooms = Object.values(world.rooms).filter(f);
  const cohorts = Object.values(world.cohorts).filter(f);
  return {
    onTimeRate: checkedIn.length ? onTime.length / checkedIn.length : null,
    onTimeCount: onTime.length,
    checkedInCount: checkedIn.length,
    roomsInUse: rooms.filter((r) => r.status === 'in_session').length,
    roomsTotal: rooms.length,
    activeCohorts: cohorts.filter((c) => c.status !== 'break').length,
    cohortsTotal: cohorts.length,
    lowStock: Object.values(world.materials).filter(f).filter(isLowStock).length,
    late: sessions.filter((s) => s.status === 'late').length,
  };
}

/** Whether a cohort passes the current filters (used to hide it in the scene). */
export function cohortMatches(cohort: Cohort, sessions: Record<string, Session>, filters: Filters): boolean {
  if (filters.cohortStatus !== 'all' && cohort.status !== filters.cohortStatus) return false;
  if (filters.lateOnly) {
    const s = cohort.sessionId ? sessions[cohort.sessionId] : null;
    if (!s || s.status !== 'late') return false;
  }
  return true;
}

/** Sessions shown in the side list, most urgent first. */
export function listSessions(
  sessions: Record<string, Session>,
  campusId: CampusFilter,
  filters: Filters,
  cohorts: Record<string, Cohort>,
): Session[] {
  const rank = { late: 0, in_progress: 1, moving: 2, scheduled: 3, completed: 4 } as const;
  return Object.values(sessions)
    .filter(inCampus(campusId))
    .filter((s) => (filters.lateOnly ? s.status === 'late' : s.status !== 'completed'))
    .filter((s) => {
      if (filters.cohortStatus === 'all') return true;
      const c = s.cohortId ? cohorts[s.cohortId] : null;
      return c?.status === filters.cohortStatus;
    })
    .sort((a, b) => rank[a.status] - rank[b.status] || a.startAt - b.startAt);
}

export function parseCabinetKey(key: string) {
  const [campusId, aisle, bay] = key.split(':');
  return { campusId, aisle, bay: Number(bay) };
}
