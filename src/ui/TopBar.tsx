import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { STAGE_ORDER } from '../data/layout';
import type { StageKey } from '../data/types';
import { useMaestroStore } from '../store/useMaestroStore';
import { computeKpis } from '../store/selectors';
import { STAGE_COLOR } from '../theme';
import { clock, pct } from './format';

export function TopBar() {
  const { stages, view, setView, running, setRunning, now, generation } = useMaestroStore(
    useShallow((s) => ({
      stages: s.stages,
      view: s.view,
      setView: s.setView,
      running: s.running,
      setRunning: s.setRunning,
      now: s.now,
      generation: s.stats.generation,
    })),
  );

  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo">◆</div>
        <div>
          <div className="brand-title">AI MAESTRO</div>
          <div className="brand-sub">교직원 AI 인재 양성 여정 · {generation}기 모집 중</div>
        </div>
      </div>

      <nav className="site-tabs" aria-label="단계 선택">
        <button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>
          <span className="code">ALL</span>
          전체 여정
        </button>
        {STAGE_ORDER.map((id) => (
          <button
            key={id}
            className={view === id ? 'active' : ''}
            onClick={() => setView(id)}
            title={stages[id].subtitle}
            style={{ ['--stage' as string]: STAGE_COLOR[id] }}
          >
            <span className="code">0{stages[id].order}</span>
            {stages[id].name}
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
  const { participants, teams, stats, setView } = useMaestroStore(
    useShallow((s) => ({ participants: s.participants, teams: s.teams, stats: s.stats, setView: s.setView })),
  );
  const k = useMemo(() => computeKpis({ participants, teams, stats }), [participants, teams, stats]);

  return (
    <div className="kpis">
      <Kpi
        stage="selection"
        label="선발률"
        value={pct(k.selectionRate)}
        sub={`지원 ${k.applied} · 선발 ${k.selected} · 심사 중 ${k.inSelection}`}
        onClick={setView}
      />
      <Kpi
        stage="training"
        label="평균 출석률"
        value={pct(k.attendance)}
        sub={`수강 ${k.inTraining}명 · 과제 제출 ${pct(k.assignmentRate)}`}
        tone={k.attendance !== null && k.attendance < 0.85 ? 'warn' : undefined}
        onClick={setView}
      />
      <Kpi
        stage="study"
        label="스터디 평균 진행률"
        value={pct(k.studyProgress)}
        sub={`활동 ${k.studyTeams}팀 · 정체 ${k.stalledTeams}팀`}
        tone={k.stalledTeams > 0 ? 'warn' : undefined}
        meter={k.studyProgress ?? 0}
        onClick={setView}
      />
      <Kpi
        stage="showcase"
        label="누적 수료"
        value={`${k.graduated}명`}
        sub={`발표 완료 ${k.presentedTeams}팀 · 대기 ${k.readyTeams}팀`}
        onClick={setView}
      />
    </div>
  );
}

function Kpi(props: {
  stage: StageKey;
  label: string;
  value: string;
  sub: string;
  tone?: string;
  meter?: number;
  onClick: (stage: StageKey) => void;
}) {
  return (
    <button
      className={`kpi ${props.tone ?? ''}`}
      style={{ ['--stage' as string]: STAGE_COLOR[props.stage] }}
      onClick={() => props.onClick(props.stage)}
      title="이 단계로 이동"
    >
      <div className="kpi-label">{props.label}</div>
      <div className="kpi-value">{props.value}</div>
      <div className="kpi-sub">{props.sub}</div>
      {props.meter !== undefined && (
        <div className="meter">
          <div style={{ width: `${Math.round(props.meter * 100)}%` }} />
        </div>
      )}
    </button>
  );
}
