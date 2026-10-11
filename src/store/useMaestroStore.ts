import { create } from 'zustand';
import { mulberry32, createSeed } from '../data/seed';
import type { StageKey, WorldData } from '../data/types';
import { simulateTick } from '../sim/simulate';

export type SelectionKind = 'participant' | 'team' | 'facility';
export interface Selection {
  kind: SelectionKind;
  id: string;
}

export type StageFilter = StageKey | 'all';

export interface Filters {
  /** Only show people who need attention (weak attendance, stalled team). */
  attentionOnly: boolean;
  /** Only show people in this stage. */
  stage: StageFilter;
}

export interface CameraFocus {
  x: number;
  z: number;
  distance: number;
  /** Bumped on every request so re-selecting the same stage re-flies. */
  seq: number;
}

interface MaestroState extends WorldData {
  now: number;
  running: boolean;
  selection: Selection | null;
  view: StageFilter;
  filters: Filters;
  cameraFocus: CameraFocus;

  tick: () => void;
  setRunning: (running: boolean) => void;
  select: (selection: Selection | null) => void;
  setView: (view: StageFilter) => void;
  setFilters: (patch: Partial<Filters>) => void;
}

export const SIM_INTERVAL_MS = 2000;
const STAGE_DISTANCE = 80;
const OVERVIEW_DISTANCE = 250;

const simRand = mulberry32(Date.now() & 0xffffffff);
const seed = createSeed();

/** `#selection`, `#training`, `#study` or `#showcase` opens the app on that stage. */
function initialView(): StageFilter {
  const hash = typeof location === 'undefined' ? '' : location.hash.slice(1);
  return hash in seed.stages ? (hash as StageKey) : 'all';
}
const startView = initialView();

function focusFor(world: WorldData, view: StageFilter, seq: number): CameraFocus {
  // Shifted west so the first zone clears the left panel.
  if (view === 'all') return { x: -14, z: 4, distance: OVERVIEW_DISTANCE, seq };
  const { origin } = world.stages[view];
  return { x: origin.x - 4, z: origin.z + 6, distance: STAGE_DISTANCE, seq };
}

export const useMaestroStore = create<MaestroState>()((set, get) => ({
  ...seed,
  now: Date.now(),
  running: true,
  selection: null,
  view: startView,
  filters: { attentionOnly: false, stage: 'all' },
  cameraFocus: focusFor(seed, startView, 0),

  tick: () => {
    const now = Date.now();
    set((s) => ({ ...simulateTick(s, now, simRand), now }));
  },
  setRunning: (running) => set({ running }),
  select: (selection) => set({ selection }),
  setView: (view) => set({ view, cameraFocus: focusFor(get(), view, get().cameraFocus.seq + 1) }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
}));
