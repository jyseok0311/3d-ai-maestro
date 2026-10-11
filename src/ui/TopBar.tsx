import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMaestroStore } from '../store/useMaestroStore';
import { computeKpis } from '../store/selectors';
import { clock, pct } from './format';

export function TopBar() {
  const { campuses, campusId, setCampus, running, setRunning, now } = useMaestroStore(
    useShallow((s) => ({
      campuses: s.campuses,
      campusId: s.campusId,
      setCampus: s.setCampus,
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
          <div className="brand-title">AI MAESTRO</div>
          <div className="brand-sub">교직원 AI 교육 운영 관제</div>
        </div>
      </div>

      <nav className="site-tabs" aria-label="캠퍼스 선택">
        <button className={campusId === 'all' ? 'active' : ''} onClick={() => setCampus('all')}>
          전체
        </button>
        {Object.values(campuses).map((c) => (
          <button key={c.id} className={campusId === c.id ? 'active' : ''} onClick={() => setCampus(c.id)} title={c.address}>
            <span className="code">{c.code}</span>
            {c.name.replace(' AI교육관', '')}
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
  const { rooms, cohorts, materials, sessions, campusId } = useMaestroStore(
    useShallow((s) => ({
      rooms: s.rooms,
      cohorts: s.cohorts,
      materials: s.materials,
      sessions: s.sessions,
      campusId: s.campusId,
    })),
  );
  const k = useMemo(
    () => computeKpis({ rooms, cohorts, materials, sessions }, campusId),
    [rooms, cohorts, materials, sessions, campusId],
  );
  const onTimeTone = k.onTimeRate === null ? '' : k.onTimeRate >= 0.9 ? 'good' : k.onTimeRate >= 0.75 ? 'warn' : 'bad';

  return (
    <div className="kpis">
      <Kpi label="정시 입실률" value={pct(k.onTimeRate)} sub={`${k.onTimeCount}/${k.checkedInCount}회 · 지연 ${k.late}`} tone={onTimeTone} />
      <Kpi
        label="교육실 사용"
        value={`${k.roomsInUse}/${k.roomsTotal}`}
        sub="교육 중 / 전체"
        meter={k.roomsTotal ? k.roomsInUse / k.roomsTotal : 0}
      />
      <Kpi label="진행 중 차수" value={`${k.activeCohorts}`} sub={`전체 ${k.cohortsTotal}개 반 중`} />
      <Kpi label="부족 교보재" value={`${k.lowStock}`} sub="재주문점 이하 품목" tone={k.lowStock > 0 ? 'bad' : 'good'} />
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
