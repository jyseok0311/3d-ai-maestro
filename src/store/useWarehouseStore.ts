import { create } from 'zustand';
import { mulberry32, createSeed } from '../data/seed';
import type { ID, TruckStatus, WorldData } from '../data/types';
import { simulateTick } from '../sim/simulate';

export type SelectionKind = 'truck' | 'forklift' | 'dock' | 'rack';
export interface Selection {
  kind: SelectionKind;
  /** For racks: `${siteId}:${aisle}:${bay}`. */
  id: string;
}

export type SiteFilter = ID | 'all';

export interface Filters {
  delayedOnly: boolean;
  truckStatus: TruckStatus | 'all';
}

export interface CameraFocus {
  x: number;
  z: number;
  distance: number;
  /** Bumped on every request so re-selecting the same site re-flies. */
  seq: number;
}

interface WarehouseState extends WorldData {
  now: number;
  running: boolean;
  selection: Selection | null;
  siteId: SiteFilter;
  filters: Filters;
  cameraFocus: CameraFocus;

  tick: () => void;
  setRunning: (running: boolean) => void;
  select: (selection: Selection | null) => void;
  setSite: (siteId: SiteFilter) => void;
  setFilters: (patch: Partial<Filters>) => void;
}

export const SIM_INTERVAL_MS = 2000;
const SITE_DISTANCE = 105;
const OVERVIEW_DISTANCE = 260;

const simRand = mulberry32(Date.now() & 0xffffffff);
const seed = createSeed();

function focusFor(world: WorldData, siteId: SiteFilter, seq: number): CameraFocus {
  if (siteId === 'all') return { x: 0, z: 5, distance: OVERVIEW_DISTANCE, seq };
  const { origin } = world.sites[siteId];
  return { x: origin.x - 6, z: origin.z + 9, distance: SITE_DISTANCE, seq };
}

const initialSite = Object.keys(seed.sites)[0];

export const useWarehouseStore = create<WarehouseState>()((set, get) => ({
  ...seed,
  now: Date.now(),
  running: true,
  selection: null,
  siteId: initialSite,
  filters: { delayedOnly: false, truckStatus: 'all' },
  cameraFocus: focusFor(seed, initialSite, 0),

  tick: () => {
    const now = Date.now();
    set((s) => ({ ...simulateTick(s, now, simRand), now }));
  },
  setRunning: (running) => set({ running }),
  select: (selection) => set({ selection }),
  setSite: (siteId) => set({ siteId, cameraFocus: focusFor(get(), siteId, get().cameraFocus.seq + 1) }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
}));
