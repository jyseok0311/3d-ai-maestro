import { create } from 'zustand';
import { mulberry32, createSeed } from '../data/seed';
import type { CohortStatus, ID, WorldData } from '../data/types';
import { simulateTick } from '../sim/simulate';

export type SelectionKind = 'cohort' | 'assistant' | 'room' | 'cabinet';
export interface Selection {
  kind: SelectionKind;
  /** For cabinets: `${campusId}:${aisle}:${bay}`. */
  id: string;
}

export type CampusFilter = ID | 'all';

export interface Filters {
  lateOnly: boolean;
  cohortStatus: CohortStatus | 'all';
}

export interface CameraFocus {
  x: number;
  z: number;
  distance: number;
  /** Bumped on every request so re-selecting the same campus re-flies. */
  seq: number;
}

interface MaestroState extends WorldData {
  now: number;
  running: boolean;
  selection: Selection | null;
  campusId: CampusFilter;
  filters: Filters;
  cameraFocus: CameraFocus;

  tick: () => void;
  setRunning: (running: boolean) => void;
  select: (selection: Selection | null) => void;
  setCampus: (campusId: CampusFilter) => void;
  setFilters: (patch: Partial<Filters>) => void;
}

export const SIM_INTERVAL_MS = 2000;
const CAMPUS_DISTANCE = 105;
const OVERVIEW_DISTANCE = 260;

const simRand = mulberry32(Date.now() & 0xffffffff);
const seed = createSeed();

function focusFor(world: WorldData, campusId: CampusFilter, seq: number): CameraFocus {
  if (campusId === 'all') return { x: 0, z: 5, distance: OVERVIEW_DISTANCE, seq };
  const { origin } = world.campuses[campusId];
  return { x: origin.x - 6, z: origin.z + 9, distance: CAMPUS_DISTANCE, seq };
}

const initialCampus = Object.keys(seed.campuses)[0];

export const useMaestroStore = create<MaestroState>()((set, get) => ({
  ...seed,
  now: Date.now(),
  running: true,
  selection: null,
  campusId: initialCampus,
  filters: { lateOnly: false, cohortStatus: 'all' },
  cameraFocus: focusFor(seed, initialCampus, 0),

  tick: () => {
    const now = Date.now();
    set((s) => ({ ...simulateTick(s, now, simRand), now }));
  },
  setRunning: (running) => set({ running }),
  select: (selection) => set({ selection }),
  setCampus: (campusId) =>
    set({ campusId, cameraFocus: focusFor(get(), campusId, get().cameraFocus.seq + 1) }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
}));
