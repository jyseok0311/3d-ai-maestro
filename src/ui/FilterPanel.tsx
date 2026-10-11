import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { TruckStatus } from '../data/types';
import { useWarehouseStore } from '../store/useWarehouseStore';
import { listShipments } from '../store/selectors';
import { SHIPMENT_STATUS, TRUCK_STATUS } from '../theme';
import { relEta } from './format';

export function FilterPanel() {
  const { shipments, trucks, sites, siteId, filters, setFilters, select, selection, now } = useWarehouseStore(
    useShallow((s) => ({
      shipments: s.shipments,
      trucks: s.trucks,
      sites: s.sites,
      siteId: s.siteId,
      filters: s.filters,
      setFilters: s.setFilters,
      select: s.select,
      selection: s.selection,
      now: s.now,
    })),
  );

  const list = useMemo(() => listShipments(shipments, siteId, filters, trucks), [shipments, siteId, filters, trucks]);
  const delayedCount = useMemo(
    () => Object.values(shipments).filter((s) => s.status === 'delayed' && (siteId === 'all' || s.siteId === siteId)).length,
    [shipments, siteId],
  );

  return (
    <aside className="panel filters">
      <div className="panel-head">
        <h2>필터</h2>
        {(filters.delayedOnly || filters.truckStatus !== 'all') && (
          <button className="link" onClick={() => setFilters({ delayedOnly: false, truckStatus: 'all' })}>
            초기화
          </button>
        )}
      </div>

      <label className="switch">
        <input type="checkbox" checked={filters.delayedOnly} onChange={(e) => setFilters({ delayedOnly: e.target.checked })} />
        <span className="track" />
        지연 배송만 보기
        <span className="badge bad">{delayedCount}</span>
      </label>

      <div className="field">
        <div className="field-label">트럭 상태</div>
        <div className="chips">
          <button className={filters.truckStatus === 'all' ? 'chip active' : 'chip'} onClick={() => setFilters({ truckStatus: 'all' })}>
            전체
          </button>
          {(Object.keys(TRUCK_STATUS) as TruckStatus[]).map((st) => (
            <button
              key={st}
              className={filters.truckStatus === st ? 'chip active' : 'chip'}
              onClick={() => setFilters({ truckStatus: st })}
            >
              <i style={{ background: TRUCK_STATUS[st].color }} />
              {TRUCK_STATUS[st].label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-head sub">
        <h2>배송 목록</h2>
        <span className="muted">{list.length}건</span>
      </div>
      <ul className="ship-list">
        {list.length === 0 && <li className="empty">조건에 맞는 배송이 없습니다.</li>}
        {list.map((s) => {
          const truck = s.truckId ? trucks[s.truckId] : null;
          const active = selection?.kind === 'truck' && selection.id === s.truckId;
          return (
            <li key={s.id}>
              <button
                className={active ? 'active' : ''}
                disabled={!truck}
                onClick={() => truck && select({ kind: 'truck', id: truck.id })}
                title={truck ? '트럭 선택' : '배정된 트럭 없음'}
              >
                <div className="row">
                  <span className="ref">{s.reference}</span>
                  <span className="status" style={{ color: SHIPMENT_STATUS[s.status].color }}>
                    {SHIPMENT_STATUS[s.status].label}
                  </span>
                </div>
                <div className="row muted">
                  <span>
                    {s.direction === 'inbound' ? '입고' : '출고'} · {sites[s.siteId].code}
                    {truck ? ` · ${truck.plate}` : ' · 미배정'}
                  </span>
                  <span>ETA {s.arrivedAt ? '도착' : relEta(s.eta, now)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
