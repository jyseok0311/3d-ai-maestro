import {
  BAYS,
  CHARGER,
  CROSS_AISLE_X,
  STAGING,
  TRAVEL_AISLE_Z,
  dockX,
  DOCK_WALL_Z,
  rackX,
} from '../data/layout';
import type { Dock, Forklift, Shipment, Truck, Vec2, WorldData } from '../data/types';

/** Completed shipments kept for the rolling on-time KPI. */
const MAX_COMPLETED = 40;

/**
 * One step of the live simulation. Pure: returns a new WorldData and only
 * replaces the records that actually changed, so React components that
 * subscribe to a single truck or forklift re-render only when it moves.
 */
export function simulateTick(world: WorldData, now: number, rand: () => number): WorldData {
  const docks = { ...world.docks };
  const trucks = { ...world.trucks };
  const shipments = { ...world.shipments };
  const inventory = { ...world.inventory };
  const forklifts = { ...world.forklifts };

  const chance = (p: number) => rand() < p;
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const patchTruck = (t: Truck, p: Partial<Truck>) => (trucks[t.id] = { ...t, ...p, lastUpdate: now });
  const patchDock = (d: Dock, p: Partial<Dock>) => (docks[d.id] = { ...d, ...p, lastUpdate: now });
  const patchShipment = (s: Shipment, p: Partial<Shipment>) => (shipments[s.id] = { ...s, ...p, lastUpdate: now });
  const patchForklift = (f: Forklift, p: Partial<Forklift>) => (forklifts[f.id] = { ...f, ...p, lastUpdate: now });

  let shipmentSeq = Math.max(0, ...Object.keys(shipments).map((id) => Number(id.split('-')[1]) || 0));

  // ── Trucks: idle → en_route → queued → docked → (un)loading → departing → idle
  for (const id of Object.keys(trucks)) {
    const truck = trucks[id];
    const shipment = truck.shipmentId ? shipments[truck.shipmentId] : null;

    switch (truck.status) {
      case 'idle': {
        if (!chance(0.12)) break;
        let next = Object.values(shipments).find(
          (s) => s.siteId === truck.siteId && !s.truckId && !s.arrivedAt && (s.status === 'scheduled' || s.status === 'delayed'),
        );
        if (!next) {
          shipmentSeq += 1;
          const direction = chance(0.5) ? 'inbound' : 'outbound';
          const siteItems = Object.values(inventory).filter((it) => it.siteId === truck.siteId);
          next = {
            id: `shp-${String(shipmentSeq).padStart(3, '0')}`,
            reference: `${direction === 'inbound' ? 'IN' : 'OUT'}-2610-${String(shipmentSeq).padStart(4, '0')}`,
            siteId: truck.siteId,
            direction,
            status: 'scheduled',
            truckId: null,
            dockId: null,
            lines: [{ itemId: pick(siteItems).id, quantity: 5 + Math.floor(rand() * 8) * 5 }],
            // Tight promises (sim time is compressed), so some arrive late.
            eta: now + (8 + Math.floor(rand() * 24)) * 1000,
            arrivedAt: null,
            lastUpdate: now,
          };
        }
        patchShipment(next, { status: next.eta < now ? 'delayed' : 'in_transit', truckId: truck.id });
        patchTruck(truck, { status: 'en_route', shipmentId: next.id });
        break;
      }
      case 'en_route':
        if (chance(0.25)) patchTruck(truck, { status: 'queued' });
        break;
      case 'queued': {
        const dock = Object.values(docks).find(
          (d) => d.siteId === truck.siteId && d.status === 'free' && !d.truckId,
        );
        if (!dock || !chance(0.6)) break;
        patchDock(dock, { status: 'occupied', truckId: truck.id });
        patchTruck(truck, { status: 'docked', dockId: dock.id });
        if (shipment) patchShipment(shipment, { status: 'at_dock', dockId: dock.id, arrivedAt: now });
        break;
      }
      case 'docked':
        if (chance(0.45)) {
          patchTruck(truck, { status: shipment?.direction === 'inbound' ? 'unloading' : 'loading' });
        }
        break;
      case 'loading':
      case 'unloading': {
        if (!chance(0.22)) break;
        if (shipment) {
          const sign = shipment.direction === 'inbound' ? 1 : -1;
          for (const line of shipment.lines) {
            const item = inventory[line.itemId];
            if (item) inventory[item.id] = { ...item, quantity: Math.max(0, item.quantity + sign * line.quantity) };
          }
          patchShipment(shipment, { status: 'completed', truckId: null });
        }
        const dock = truck.dockId ? docks[truck.dockId] : null;
        if (dock) patchDock(dock, { status: 'free', truckId: null });
        patchTruck(truck, { status: 'departing', dockId: null, shipmentId: null });
        break;
      }
      case 'departing':
        if (chance(0.4)) patchTruck(truck, { status: 'idle' });
        break;
    }
  }

  // ── Shipments: flag late arrivals.
  for (const s of Object.values(shipments)) {
    if ((s.status === 'in_transit' || s.status === 'scheduled') && s.eta < now) {
      patchShipment(s, { status: 'delayed' });
    }
  }

  // ── Keep a rolling history: drop the oldest completed shipments.
  const completed = Object.values(shipments)
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.lastUpdate - a.lastUpdate);
  for (const s of completed.slice(MAX_COMPLETED)) delete shipments[s.id];

  // ── Docks: occasional maintenance windows.
  for (const dock of Object.values(docks)) {
    if (dock.status === 'free' && chance(0.004)) patchDock(dock, { status: 'maintenance' });
    else if (dock.status === 'maintenance' && chance(0.08)) patchDock(dock, { status: 'free' });
  }

  // ── Replenishment: low items at a site slowly get restocked.
  for (const item of Object.values(inventory)) {
    if (item.quantity <= item.reorderPoint && chance(0.03)) {
      inventory[item.id] = { ...item, quantity: item.quantity + item.reorderPoint * 2 };
    }
  }

  // ── Forklifts.
  const atDockBySite = new Map<string, Shipment[]>();
  for (const s of Object.values(shipments)) {
    if (s.status !== 'at_dock') continue;
    atDockBySite.set(s.siteId, [...(atDockBySite.get(s.siteId) ?? []), s]);
  }

  for (const id of Object.keys(forklifts)) {
    const fl = forklifts[id];
    const drain = fl.status === 'moving' ? 1.6 : fl.status === 'lifting' ? 2.2 : 0.2;

    switch (fl.status) {
      case 'fault':
        if (chance(0.15)) patchForklift(fl, { status: 'idle' });
        break;
      case 'charging':
        if (dist(fl.position, CHARGER) > 0.1) {
          patchForklift(fl, { position: stepTowards(fl.position, CHARGER, 6), target: { ...CHARGER } });
        } else if (fl.battery >= 95) {
          patchForklift(fl, { status: 'idle', battery: 100 });
        } else {
          patchForklift(fl, { battery: Math.min(100, fl.battery + 9) });
        }
        break;
      case 'idle':
        if (chance(0.004)) {
          patchForklift(fl, { status: 'fault' });
        } else if (fl.battery < 20) {
          patchForklift(fl, { status: 'charging', shipmentId: null });
        } else if (chance(0.45)) {
          const work = atDockBySite.get(fl.siteId);
          const task = work && chance(0.7) ? pick(work) : null;
          patchForklift(fl, {
            status: 'moving',
            target: task ? dockApron(task, docks) : randomPickPoint(rand),
            shipmentId: task?.id ?? null,
            battery: Math.max(0, fl.battery - drain),
          });
        }
        break;
      case 'moving': {
        const position = stepTowards(fl.position, fl.target, 6);
        const arrived = dist(position, fl.target) < 0.1;
        patchForklift(fl, {
          position,
          status: arrived ? 'lifting' : 'moving',
          battery: Math.max(0, fl.battery - drain),
        });
        break;
      }
      case 'lifting':
        if (chance(0.5)) {
          patchForklift(fl, {
            status: fl.battery < 20 ? 'charging' : 'idle',
            shipmentId: null,
            battery: Math.max(0, fl.battery - drain),
          });
        }
        break;
    }
  }

  return { ...world, docks, trucks, shipments, inventory, forklifts };
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Move up to `maxStep` metres towards `target`, following the aisles:
 * forklifts only change rows on a cross aisle or inside the open staging zone.
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

function dockApron(shipment: Shipment, docks: Record<string, Dock>): Vec2 {
  const dock = shipment.dockId ? docks[shipment.dockId] : null;
  return { x: dock ? dockX(dock.index) : 20, z: DOCK_WALL_Z - 3 };
}

function randomPickPoint(rand: () => number): Vec2 {
  if (rand() < 0.35) {
    return {
      x: STAGING.minX + 2 + rand() * (STAGING.maxX - STAGING.minX - 4),
      z: STAGING.minZ + 4 + rand() * (STAGING.maxZ - STAGING.minZ - 6),
    };
  }
  const bay = 1 + Math.floor(rand() * BAYS);
  return { x: rackX(bay), z: TRAVEL_AISLE_Z[Math.floor(rand() * TRAVEL_AISLE_Z.length)] };
}

