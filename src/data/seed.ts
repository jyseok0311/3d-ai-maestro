import {
  AISLES,
  BAYS,
  CHARGER,
  DOCK_COUNT,
  LEVELS,
  SITE_SPACING,
  STAGING,
  TRAVEL_AISLE_Z,
} from './layout';
import type {
  Dock,
  Forklift,
  InventoryItem,
  ItemCategory,
  Shipment,
  Site,
  Truck,
  TruckStatus,
  WorldData,
} from './types';

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

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((x) => [x.id, x]));
}

const SITE_DEFS = [
  { code: 'BNP', name: '부산신항 물류센터', city: '부산 강서구' },
  { code: 'GHE', name: '김해 풀필먼트센터', city: '경남 김해시' },
  { code: 'YSN', name: '양산 내륙 허브', city: '경남 양산시' },
];

const CARRIERS = ['한진로지스', 'CJ대한통운', '롯데글로벌', '현대글로비스'];
const DRIVERS = ['김도윤', '이서준', '박지호', '최민재', '정우진', '강하준', '조은우', '윤시우', '장예준', '임주원', '한건우', '오현준'];
const OPERATORS = ['서지안', '권하린', '황유나', '송민서', '안채원', '배지우', '유수아', '홍다은'];

const ITEM_DEFS: { name: string; category: ItemCategory }[] = [
  { name: '27인치 모니터', category: 'electronics' },
  { name: '무선 이어폰', category: 'electronics' },
  { name: '노트북 어댑터', category: 'electronics' },
  { name: '스마트워치', category: 'electronics' },
  { name: '라면 박스(40입)', category: 'food' },
  { name: '생수 2L(6입)', category: 'food' },
  { name: '커피 원두 1kg', category: 'food' },
  { name: '냉동 만두', category: 'food' },
  { name: '면 티셔츠', category: 'apparel' },
  { name: '방한 패딩', category: 'apparel' },
  { name: '러닝화', category: 'apparel' },
  { name: '브레이크 패드', category: 'auto_parts' },
  { name: '엔진 오일 4L', category: 'auto_parts' },
  { name: '타이어 18인치', category: 'auto_parts' },
  { name: '차량용 배터리', category: 'auto_parts' },
  { name: '산업용 세정제', category: 'chemicals' },
  { name: '페인트 18L', category: 'chemicals' },
  { name: '사무용 의자', category: 'furniture' },
  { name: '조립식 선반', category: 'furniture' },
  { name: '접이식 테이블', category: 'furniture' },
];

/** Build the seed relative to `now` so ETAs are always meaningful. */
export function createSeed(now: number = Date.now()): WorldData {
  const rand = mulberry32(20261011);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

  // ── Sites ──────────────────────────────────────────────────────────────
  const sites: Site[] = SITE_DEFS.map((def, i) => ({
    id: `site-${i + 1}`,
    ...def,
    origin: { x: (i - (SITE_DEFS.length - 1) / 2) * SITE_SPACING, z: 0 },
  }));

  // ── Docks: 6 per site ──────────────────────────────────────────────────
  const docks: Dock[] = sites.flatMap((site) =>
    Array.from({ length: DOCK_COUNT }, (_, i) => ({
      id: `${site.id}-dock-${i + 1}`,
      siteId: site.id,
      index: i,
      label: `${site.code}-D${i + 1}`,
      status: 'free' as const,
      truckId: null,
      lastUpdate: now,
    })),
  );
  // One dock under maintenance at the second site.
  docks[DOCK_COUNT + 5].status = 'maintenance';

  // ── Inventory: 40 items spread across sites and racks ────────────────
  const usedSlots = new Set<string>();
  const inventory: InventoryItem[] = Array.from({ length: 40 }, (_, i) => {
    const site = sites[i % sites.length];
    const def = ITEM_DEFS[i % ITEM_DEFS.length];
    let location;
    do {
      location = { aisle: pick(AISLES), bay: randInt(1, BAYS), level: randInt(1, LEVELS) };
    } while (usedSlots.has(`${site.id}${location.aisle}${location.bay}${location.level}`));
    usedSlots.add(`${site.id}${location.aisle}${location.bay}${location.level}`);
    const reorderPoint = randInt(4, 12) * 10;
    // ~20 % of items start at or below their reorder point.
    const quantity = rand() < 0.2 ? randInt(5, reorderPoint) : randInt(reorderPoint + 20, reorderPoint * 5);
    return {
      id: `item-${pad(i + 1, 3)}`,
      siteId: site.id,
      sku: `${def.category.slice(0, 3).toUpperCase()}-${pad(1000 + i * 37, 5)}`,
      name: def.name,
      category: def.category,
      quantity,
      reorderPoint,
      location,
    };
  });

  // ── Trucks: 12, four per site, in a spread of lifecycle states ───────
  const truckStates: TruckStatus[] = ['loading', 'unloading', 'docked', 'queued', 'en_route', 'idle'];
  const trucks: Truck[] = Array.from({ length: 12 }, (_, i) => ({
    id: `truck-${pad(i + 1)}`,
    plate: `${randInt(80, 99)}${pick(['바', '사', '아', '자'])} ${randInt(1000, 9999)}`,
    carrier: CARRIERS[i % CARRIERS.length],
    driver: DRIVERS[i],
    siteId: sites[i % sites.length].id,
    status: truckStates[(i + Math.floor(i / 3)) % truckStates.length],
    dockId: null,
    shipmentId: null,
    capacityKg: pick([5000, 11000, 14000, 25000]),
    lastUpdate: now - randInt(5, 120) * 1000,
  }));

  // Park every truck that is at a dock into a free dock of its site.
  for (const truck of trucks) {
    if (!['docked', 'loading', 'unloading'].includes(truck.status)) continue;
    const dock = docks.find((d) => d.siteId === truck.siteId && d.status === 'free');
    if (!dock) {
      truck.status = 'queued';
      continue;
    }
    dock.status = 'occupied';
    dock.truckId = truck.id;
    truck.dockId = dock.id;
  }

  // ── Shipments: 25 with ETAs ──────────────────────────────────────────
  const shipments: Shipment[] = [];
  const minute = 60_000;
  const makeLines = (siteId: string) => {
    const siteItems = inventory.filter((it) => it.siteId === siteId);
    return Array.from({ length: randInt(1, 3) }, () => ({
      itemId: pick(siteItems).id,
      quantity: randInt(2, 8) * 5,
    }));
  };
  const addShipment = (s: Omit<Shipment, 'id' | 'reference' | 'lines' | 'lastUpdate'>) => {
    const n = shipments.length + 1;
    shipments.push({
      id: `shp-${pad(n, 3)}`,
      reference: `${s.direction === 'inbound' ? 'IN' : 'OUT'}-2610-${pad(n, 4)}`,
      lines: makeLines(s.siteId),
      lastUpdate: now,
      ...s,
    });
    return shipments[shipments.length - 1];
  };

  // 1) One shipment for every non-idle truck.
  for (const truck of trucks) {
    if (truck.status === 'idle') continue;
    const atDock = truck.dockId !== null;
    const direction = truck.status === 'loading' ? 'outbound' : truck.status === 'unloading' ? 'inbound' : pick(['inbound', 'outbound'] as const);
    const eta = atDock ? now - randInt(5, 40) * minute : now + randInt(-6, 4) * minute;
    const shipment = addShipment({
      siteId: truck.siteId,
      direction,
      status: atDock ? 'at_dock' : eta < now ? 'delayed' : 'in_transit',
      truckId: truck.id,
      dockId: truck.dockId,
      eta,
      arrivedAt: atDock ? eta + randInt(-10, 12) * minute : null,
    });
    truck.shipmentId = shipment.id;
  }

  // 2) Completed history so the on-time rate starts meaningful.
  while (shipments.length < 19) {
    const site = pick(sites);
    const eta = now - randInt(60, 360) * minute;
    addShipment({
      siteId: site.id,
      direction: pick(['inbound', 'outbound'] as const),
      status: 'completed',
      truckId: null,
      dockId: pick(docks.filter((d) => d.siteId === site.id)).id,
      eta,
      arrivedAt: eta + (rand() < 0.75 ? -randInt(1, 20) : randInt(5, 45)) * minute,
    });
  }

  // 3) Upcoming scheduled work without a truck yet.
  while (shipments.length < 25) {
    addShipment({
      siteId: pick(sites).id,
      direction: pick(['inbound', 'outbound'] as const),
      status: 'scheduled',
      truckId: null,
      dockId: null,
      eta: now + randInt(1, 6) * minute,
      arrivedAt: null,
    });
  }

  // ── Forklifts: 8 spread over sites ───────────────────────────────────
  const forklifts: Forklift[] = Array.from({ length: 8 }, (_, i) => {
    const onAisle = i % 2 === 0;
    const position = onAisle
      ? { x: randInt(-28, 4), z: TRAVEL_AISLE_Z[i % TRAVEL_AISLE_Z.length] }
      : { x: randInt(STAGING.minX + 2, STAGING.maxX - 2), z: randInt(STAGING.minZ + 4, STAGING.maxZ - 2) };
    const status = i === 7 ? 'charging' : i === 3 ? 'lifting' : 'idle';
    return {
      id: `fl-${pad(i + 1)}`,
      name: `FL-${pad(i + 1)}`,
      operator: OPERATORS[i],
      siteId: sites[i % sites.length].id,
      status,
      battery: status === 'charging' ? 18 : randInt(35, 98),
      position: status === 'charging' ? { ...CHARGER } : position,
      target: status === 'charging' ? { ...CHARGER } : position,
      shipmentId: null,
      lastUpdate: now - randInt(1, 30) * 1000,
    };
  });

  return {
    sites: byId(sites),
    docks: byId(docks),
    trucks: byId(trucks),
    forklifts: byId(forklifts),
    inventory: byId(inventory),
    shipments: byId(shipments),
  };
}
