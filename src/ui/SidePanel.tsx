import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { STAGE_ORDER } from '../data/layout';
import { useMaestroStore } from '../store/useMaestroStore';
import { computeKpis, sortTeams } from '../store/selectors';
import { STAGE_COLOR, STALLED_COLOR, TEAM_PHASE, milestone } from '../theme';
import { ago } from './format';

export function SidePanel() {
  const { participants, teams, stats, stages, events, filters, setFilters, select, selection, now } = useMaestroStore(
    useShallow((s) => ({
      participants: s.participants,
      teams: s.teams,
      stats: s.stats,
      stages: s.stages,
      events: s.events,
      filters: s.filters,
      setFilters: s.setFilters,
      select: s.select,
      selection: s.selection,
      now: s.now,
    })),
  );

  const counts = useMemo(() => {
    const c = { selection: 0, training: 0, study: 0, showcase: 0 };
    for (const p of Object.values(participants)) if (p.status !== 'not_selected' && p.status !== 'graduated') c[p.stage] += 1;
    return c;
  }, [participants]);
  const attention = useMemo(() => computeKpis({ participants, teams, stats }).attention, [participants, teams, stats]);
  const teamList = useMemo(() => sortTeams(teams).filter((t) => t.phase !== 'done'), [teams]);

  return (
    <aside className="panel filters">
      {/* journey funnel doubles as the stage filter */}
      <div className="panel-head">
        <h2>여정 단계</h2>
        {(filters.attentionOnly || filters.stage !== 'all') && (
          <button className="link" onClick={() => setFilters({ attentionOnly: false, stage: 'all' })}>
            초기화
          </button>
        )}
      </div>
      <div className="funnel">
        {STAGE_ORDER.map((id) => (
          <button
            key={id}
            className={filters.stage === id ? 'active' : ''}
            style={{ ['--stage' as string]: STAGE_COLOR[id] }}
            onClick={() => setFilters({ stage: filters.stage === id ? 'all' : id })}
            title="이 단계 참가자만 보기"
          >
            <span className="step">0{stages[id].order}</span>
            <span className="name">{stages[id].name}</span>
            <span className="count">{counts[id]}명</span>
          </button>
        ))}
      </div>

      <label className="switch">
        <input type="checkbox" checked={filters.attentionOnly} onChange={(e) => setFilters({ attentionOnly: e.target.checked })} />
        <span className="track" />
        관리 필요 참가자만
        <span className="badge bad">{attention}</span>
      </label>
      <div className="hint">출석률 80% 미만 또는 정체된 팀의 참가자</div>

      <div className="panel-head sub">
        <h2>스터디 팀</h2>
        <span className="muted">{teamList.length}팀</span>
      </div>
      <ul className="ship-list">
        {teamList.length === 0 && <li className="empty">활동 중인 팀이 없습니다.</li>}
        {teamList.map((t) => {
          const color = t.stalled ? STALLED_COLOR : TEAM_PHASE[t.phase].color;
          return (
            <li key={t.id}>
              <button
                className={selection?.kind === 'team' && selection.id === t.id ? 'active' : ''}
                onClick={() => select({ kind: 'team', id: t.id })}
              >
                <div className="row">
                  <span className="ref">{t.name}</span>
                  <span className="status" style={{ color }}>
                    {t.stalled ? '정체' : TEAM_PHASE[t.phase].label}
                  </span>
                </div>
                <div className="row muted">
                  <span className="ellipsis">{t.topic}</span>
                  <span>{Math.round(t.progress)}%</span>
                </div>
                <div className="bar">
                  <div style={{ width: `${t.progress}%`, background: color }} />
                </div>
                {t.phase === 'studying' && <div className="row muted tiny">{milestone(t.progress)}</div>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="panel-head sub">
        <h2>실시간 활동</h2>
      </div>
      <ul className="feed">
        {events.length === 0 && <li className="empty">활동을 기다리는 중…</li>}
        {events.slice(0, 12).map((e) => (
          <li key={e.id}>
            <button disabled={!e.ref} onClick={() => e.ref && select(e.ref)}>
              <i style={{ background: STAGE_COLOR[e.stage] }} />
              <span className="text">{e.text}</span>
              <span className="muted when">{ago(e.ts, now)}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
