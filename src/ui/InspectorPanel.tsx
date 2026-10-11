import { useEffect, useState, type ReactNode } from 'react';
import type { Shipment } from '../data/types';
import { useWarehouseStore } from '../store/useWarehouseStore';
import { isLowStock, parseRackKey } from '../store/selectors';
import { DOCK_STATUS, FORKLIFT_STATUS, SHIPMENT_STATUS, TRUCK_STATUS } from '../theme';
import { ago, clock, relEta } from './format';

/** Re-render every second so "n초 전" stays accurate between sim ticks. */
function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function InspectorPanel() {
  const selection = useWarehouseStore((s) => s.selection);
  const select = useWarehouseStore((s) => s.select);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && select(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  return (
    <aside className={`panel inspector${selection ? ' open' : ''}`} aria-hidden={!selection}>
      {selection && (
        <>
          <button className="close" onClick={() => select(null)} aria-label="닫기">
            ✕
          </button>
          {selection.kind === 'truck' && <TruckDetails id={selection.id} />}
          {selection.kind === 'forklift' && <ForkliftDetails id={selection.id} />}
          {selection.kind === 'dock' && <DockDetails id={selection.id} />}
          {selection.kind === 'rack' && <RackDetails rackKey={selection.id} />}
        </>
      )}
    </aside>
  );
}

function Header(props: { kind: string; title: string; status: { label: string; color: string }; sub?: string }) {
  return (
    <div className="insp-head">
      <div className="kind">{props.kind}</div>
      <h3>{props.title}</h3>
      {props.sub && <div className="muted">{props.sub}</div>}
      <div className="pill" style={{ color: props.status.color, borderColor: props.status.color }}>
        <span className="dot" style={{ background: props.status.color }} />
        {props.status.label}
      </div>
    </div>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <dl className="rows">{children}</dl>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Updated({ ts }: { ts: number }) {
  const now = useNow();
  return (
    <div className="updated" key={ts}>
      <span className="pulse" />
      마지막 업데이트 {clock(ts)} · {ago(ts, now)}
    </div>
  );
}

function ShipmentCard({ shipment }: { shipment: Shipment | null }) {
  const inventory = useWarehouseStore((s) => s.inventory);
  const now = useNow();
  if (!shipment) return <div className="card muted">진행 중인 배송 없음</div>;
  const st = SHIPMENT_STATUS[shipment.status];
  const late = shipment.arrivedAt !== null ? shipment.arrivedAt > shipment.eta : shipment.eta < now;
  return (
    <div className="card">
      <div className="row">
        <strong>{shipment.reference}</strong>
        <span style={{ color: st.color }}>{st.label}</span>
      </div>
      <Rows>
        <Row label="유형">{shipment.direction === 'inbound' ? '입고' : '출고'}</Row>
        <Row label="ETA">
          {clock(shipment.eta)} <span className={late ? 'bad-text' : 'muted'}>({relEta(shipment.eta, now)})</span>
        </Row>
        {shipment.arrivedAt && <Row label="도착">{clock(shipment.arrivedAt)}</Row>}
      </Rows>
      <ul className="lines">
        {shipment.lines.map((l, i) => {
          const item = inventory[l.itemId];
          return (
            <li key={i}>
              <span>{item?.name ?? l.itemId}</span>
              <span className="muted">{l.quantity} ea</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TruckDetails({ id }: { id: string }) {
  const truck = useWarehouseStore((s) => s.trucks[id]);
  const dock = useWarehouseStore((s) => (truck?.dockId ? s.docks[truck.dockId] : null));
  const shipment = useWarehouseStore((s) => (truck?.shipmentId ? s.shipments[truck.shipmentId] : null));
  const site = useWarehouseStore((s) => (truck ? s.sites[truck.siteId] : null));
  if (!truck || !site) return null;
  return (
    <>
      <Header kind="트럭" title={truck.plate} status={TRUCK_STATUS[truck.status]} sub={`${truck.carrier} · ${site.name}`} />
      <Rows>
        <Row label="기사">{truck.driver}</Row>
        <Row label="적재 용량">{(truck.capacityKg / 1000).toFixed(0)} t</Row>
        <Row label="도크">{dock?.label ?? '—'}</Row>
      </Rows>
      <h4>현재 배송</h4>
      <ShipmentCard shipment={shipment} />
      <Updated ts={truck.lastUpdate} />
    </>
  );
}

function ForkliftDetails({ id }: { id: string }) {
  const fl = useWarehouseStore((s) => s.forklifts[id]);
  const shipment = useWarehouseStore((s) => (fl?.shipmentId ? s.shipments[fl.shipmentId] : null));
  const site = useWarehouseStore((s) => (fl ? s.sites[fl.siteId] : null));
  if (!fl || !site) return null;
  const batteryTone = fl.battery < 20 ? 'bad' : fl.battery < 50 ? 'warn' : 'good';
  return (
    <>
      <Header kind="지게차" title={fl.name} status={FORKLIFT_STATUS[fl.status]} sub={site.name} />
      <Rows>
        <Row label="운전자">{fl.operator}</Row>
        <Row label="배터리">
          <div className={`battery ${batteryTone}`}>
            <div style={{ width: `${fl.battery}%` }} />
          </div>
          {Math.round(fl.battery)}%
        </Row>
        <Row label="위치">
          x {fl.position.x.toFixed(1)}, z {fl.position.z.toFixed(1)}
        </Row>
      </Rows>
      <h4>현재 작업 배송</h4>
      <ShipmentCard shipment={shipment} />
      <Updated ts={fl.lastUpdate} />
    </>
  );
}

function DockDetails({ id }: { id: string }) {
  const dock = useWarehouseStore((s) => s.docks[id]);
  const truck = useWarehouseStore((s) => (dock?.truckId ? s.trucks[dock.truckId] : null));
  const shipment = useWarehouseStore((s) => (truck?.shipmentId ? s.shipments[truck.shipmentId] : null));
  const site = useWarehouseStore((s) => (dock ? s.sites[dock.siteId] : null));
  const select = useWarehouseStore((s) => s.select);
  if (!dock || !site) return null;
  return (
    <>
      <Header kind="도크" title={dock.label} status={DOCK_STATUS[dock.status]} sub={site.name} />
      <Rows>
        <Row label="접안 트럭">
          {truck ? (
            <button className="link" onClick={() => select({ kind: 'truck', id: truck.id })}>
              {truck.plate} · {TRUCK_STATUS[truck.status].label}
            </button>
          ) : (
            '—'
          )}
        </Row>
      </Rows>
      <h4>현재 배송</h4>
      <ShipmentCard shipment={shipment} />
      <Updated ts={dock.lastUpdate} />
    </>
  );
}

function RackDetails({ rackKey }: { rackKey: string }) {
  const { siteId, aisle, bay } = parseRackKey(rackKey);
  const site = useWarehouseStore((s) => s.sites[siteId]);
  const inventory = useWarehouseStore((s) => s.inventory);
  const items = Object.values(inventory)
    .filter((it) => it.siteId === siteId && it.location.aisle === aisle && it.location.bay === bay)
    .sort((a, b) => b.location.level - a.location.level);
  const low = items.some(isLowStock);
  const now = useNow();
  return (
    <>
      <Header
        kind="선반"
        title={`${aisle}열 ${bay}번 랙`}
        sub={site?.name}
        status={low ? { label: '재고 부족', color: '#ef4444' } : { label: items.length ? '정상' : '추적 SKU 없음', color: items.length ? '#22c55e' : '#6b7280' }}
      />
      <h4>보관 품목</h4>
      {items.length === 0 && <div className="card muted">이 랙에 등록된 SKU가 없습니다.</div>}
      {items.map((it) => {
        const ratio = Math.min(1, it.quantity / (it.reorderPoint * 3));
        const isLow = isLowStock(it);
        return (
          <div className="card" key={it.id}>
            <div className="row">
              <strong>{it.name}</strong>
              <span className="muted">L{it.location.level}</span>
            </div>
            <div className="row muted">
              <span>{it.sku}</span>
              <span className={isLow ? 'bad-text' : ''}>
                {it.quantity} / 재주문점 {it.reorderPoint}
              </span>
            </div>
            <div className={`battery ${isLow ? 'bad' : 'good'}`}>
              <div style={{ width: `${ratio * 100}%` }} />
            </div>
          </div>
        );
      })}
      <div className="updated">
        <span className="pulse" />
        재고 실시간 반영 · {clock(now)}
      </div>
    </>
  );
}
