import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWarehouseStore } from '../store/useWarehouseStore';
import { computeKpis } from '../store/selectors';
import { clock, pct } from './format';

export function TopBar() {
  const { sites, siteId, setSite, running, setRunning, now } = useWarehouseStore(
    useShallow((s) => ({
      sites: s.sites,
      siteId: s.siteId,
      setSite: s.setSite,
      running: s.running,
      setRunning: s.setRunning,
      now: s.now,
    })),
  );

  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo">◆</div>
        <div>
          <div className="brand-title">3D AI MAESTRO</div>
          <div className="brand-sub">WareTrack · 물류센터 관제</div>
        </div>
      </div>

      <nav className="site-tabs" aria-label="사이트 선택">
        <button className={siteId === 'all' ? 'active' : ''} onClick={() => setSite('all')}>
          전체
        </button>
        {Object.values(sites).map((s) => (
          <button key={s.id} className={siteId === s.id ? 'active' : ''} onClick={() => setSite(s.id)} title={s.city}>
            <span className="code">{s.code}</span>
            {s.name}
          </button>
        ))}
      </nav>

      <KpiCards />

      <div className="live">
        <button className={`live-toggle${running ? ' on' : ''}`} onClick={() => setRunning(!running)}>
          <span className="dot" />
          {running ? 'LIVE' : '일시정지'}
        </button>
        <div className="clock">{clock(now)}</div>
      </div>
    </header>
  );
}

function KpiCards() {
  const { docks, trucks, inventory, shipments, siteId } = useWarehouseStore(
    useShallow((s) => ({
      docks: s.docks,
      trucks: s.trucks,
      inventory: s.inventory,
      shipments: s.shipments,
      siteId: s.siteId,
    })),
  );
  const k = useMemo(
    () => computeKpis({ docks, trucks, inventory, shipments }, siteId),
    [docks, trucks, inventory, shipments, siteId],
  );
  const onTimeTone = k.onTimeRate === null ? '' : k.onTimeRate >= 0.9 ? 'good' : k.onTimeRate >= 0.75 ? 'warn' : 'bad';

  return (
    <div className="kpis">
      <Kpi label="정시 도착률" value={pct(k.onTimeRate)} sub={`${k.onTimeCount}/${k.arrivedCount}건 · 지연 ${k.delayed}`} tone={onTimeTone} />
      <Kpi
        label="도크 사용"
        value={`${k.docksInUse}/${k.docksTotal}`}
        sub="사용 중 / 전체"
        meter={k.docksTotal ? k.docksInUse / k.docksTotal : 0}
      />
      <Kpi label="운행 트럭" value={`${k.activeTrucks}`} sub={`전체 ${k.trucksTotal}대 중`} />
      <Kpi label="재고 부족 알림" value={`${k.lowStock}`} sub="재주문점 이하 SKU" tone={k.lowStock > 0 ? 'bad' : 'good'} />
    </div>
  );
}

function Kpi(props: { label: string; value: string; sub: string; tone?: string; meter?: number }) {
  return (
    <div className={`kpi ${props.tone ?? ''}`}>
      <div className="kpi-label">{props.label}</div>
      <div className="kpi-value">{props.value}</div>
      <div className="kpi-sub">{props.sub}</div>
      {props.meter !== undefined && (
        <div className="meter">
          <div style={{ width: `${Math.round(props.meter * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
