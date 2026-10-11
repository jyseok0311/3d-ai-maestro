import type { InventoryItem, Shipment, Truck, WorldData } from '../data/types';
import type { Filters, SiteFilter } from './useWarehouseStore';

export const isLowStock = (item: InventoryItem) => item.quantity <= item.reorderPoint;

const inSite = (siteId: SiteFilter) => (x: { siteId: string }) => siteId === 'all' || x.siteId === siteId;

export interface Kpis {
  onTimeRate: number | null;
  onTimeCount: number;
  arrivedCount: number;
  docksInUse: number;
  docksTotal: number;
  activeTrucks: number;
  trucksTotal: number;
  lowStock: number;
  delayed: number;
}

export function computeKpis(
  world: Pick<WorldData, 'docks' | 'trucks' | 'inventory' | 'shipments'>,
  siteId: SiteFilter,
): Kpis {
  const f = inSite(siteId);
  const shipments = Object.values(world.shipments).filter(f);
  const arrived = shipments.filter((s) => s.arrivedAt !== null);
  const onTime = arrived.filter((s) => (s.arrivedAt as number) <= s.eta);
  const docks = Object.values(world.docks).filter(f);
  const trucks = Object.values(world.trucks).filter(f);
  return {
    onTimeRate: arrived.length ? onTime.length / arrived.length : null,
    onTimeCount: onTime.length,
    arrivedCount: arrived.length,
    docksInUse: docks.filter((d) => d.status === 'occupied').length,
    docksTotal: docks.length,
    activeTrucks: trucks.filter((t) => t.status !== 'idle').length,
    trucksTotal: trucks.length,
    lowStock: Object.values(world.inventory).filter(f).filter(isLowStock).length,
    delayed: shipments.filter((s) => s.status === 'delayed').length,
  };
}

/** Whether a truck passes the current filters (used to hide it in the scene). */
export function truckMatches(truck: Truck, shipments: Record<string, Shipment>, filters: Filters): boolean {
  if (filters.truckStatus !== 'all' && truck.status !== filters.truckStatus) return false;
  if (filters.delayedOnly) {
    const s = truck.shipmentId ? shipments[truck.shipmentId] : null;
    if (!s || s.status !== 'delayed') return false;
  }
  return true;
}

/** Shipments shown in the side list, most urgent first. */
export function listShipments(
  shipments: Record<string, Shipment>,
  siteId: SiteFilter,
  filters: Filters,
  trucks: Record<string, Truck>,
): Shipment[] {
  const rank = { delayed: 0, at_dock: 1, in_transit: 2, scheduled: 3, completed: 4 } as const;
  return Object.values(shipments)
    .filter(inSite(siteId))
    .filter((s) => (filters.delayedOnly ? s.status === 'delayed' : s.status !== 'completed'))
    .filter((s) => {
      if (filters.truckStatus === 'all') return true;
      const t = s.truckId ? trucks[s.truckId] : null;
      return t?.status === filters.truckStatus;
    })
    .sort((a, b) => rank[a.status] - rank[b.status] || a.eta - b.eta);
}

export function parseRackKey(key: string) {
  const [siteId, aisle, bay] = key.split(':');
  return { siteId, aisle, bay: Number(bay) };
}
