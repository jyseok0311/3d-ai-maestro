/**
 * WareTrack data model.
 *
 * Site 1─N Dock, Truck, Forklift, InventoryItem, Shipment
 * Truck  0..1 Dock      (truck.dockId  <-> dock.truckId)
 * Truck  0..1 Shipment  (truck.shipmentId <-> shipment.truckId)
 * Shipment N─N InventoryItem via ShipmentLine
 * Forklift 0..1 Shipment (the shipment it is currently handling)
 */

export type ID = string;

/** Site-local ground coordinates in metres (x → east, z → south). */
export interface Vec2 {
  x: number;
  z: number;
}

export interface Site {
  id: ID;
  code: string;
  name: string;
  city: string;
  /** World-space centre of the site. All other positions are site-local. */
  origin: Vec2;
}

export type DockStatus = 'free' | 'occupied' | 'maintenance';

export interface Dock {
  id: ID;
  siteId: ID;
  /** 0-based slot along the dock wall. */
  index: number;
  label: string;
  status: DockStatus;
  truckId: ID | null;
  lastUpdate: number;
}

export type TruckStatus =
  | 'idle'
  | 'en_route'
  | 'queued'
  | 'docked'
  | 'loading'
  | 'unloading'
  | 'departing';

export interface Truck {
  id: ID;
  plate: string;
  carrier: string;
  driver: string;
  siteId: ID;
  status: TruckStatus;
  dockId: ID | null;
  shipmentId: ID | null;
  capacityKg: number;
  lastUpdate: number;
}

export type ForkliftStatus = 'idle' | 'moving' | 'lifting' | 'charging' | 'fault';

export interface Forklift {
  id: ID;
  name: string;
  operator: string;
  siteId: ID;
  status: ForkliftStatus;
  /** 0–100 %. */
  battery: number;
  position: Vec2;
  target: Vec2;
  shipmentId: ID | null;
  lastUpdate: number;
}

export type ItemCategory = 'electronics' | 'food' | 'apparel' | 'auto_parts' | 'chemicals' | 'furniture';

export interface StorageLocation {
  /** Rack row, 'A'–'F'. */
  aisle: string;
  /** Rack column, 1–10. */
  bay: number;
  /** Shelf level, 1–3. */
  level: number;
}

export interface InventoryItem {
  id: ID;
  siteId: ID;
  sku: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  reorderPoint: number;
  location: StorageLocation;
}

export type ShipmentDirection = 'inbound' | 'outbound';

export type ShipmentStatus = 'scheduled' | 'in_transit' | 'delayed' | 'at_dock' | 'completed';

export interface ShipmentLine {
  itemId: ID;
  quantity: number;
}

export interface Shipment {
  id: ID;
  reference: string;
  siteId: ID;
  direction: ShipmentDirection;
  status: ShipmentStatus;
  truckId: ID | null;
  dockId: ID | null;
  lines: ShipmentLine[];
  /** Promised arrival time at the dock (epoch ms). */
  eta: number;
  /** Actual arrival time at the dock (epoch ms), once it happened. */
  arrivedAt: number | null;
  lastUpdate: number;
}

/** Normalised world state: every collection is keyed by id. */
export interface WorldData {
  sites: Record<ID, Site>;
  docks: Record<ID, Dock>;
  trucks: Record<ID, Truck>;
  forklifts: Record<ID, Forklift>;
  inventory: Record<ID, InventoryItem>;
  shipments: Record<ID, Shipment>;
}
