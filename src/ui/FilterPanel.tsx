import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { CohortStatus } from '../data/types';
import { useMaestroStore } from '../store/useMaestroStore';
import { listSessions } from '../store/selectors';
import { COHORT_STATUS, SESSION_STATUS } from '../theme';
import { relTime } from './format';

export function FilterPanel() {
  const { sessions, cohorts, campuses, campusId, filters, setFilters, select, selection, now } = useMaestroStore(
    useShallow((s) => ({
      sessions: s.sessions,
      cohorts: s.cohorts,
      campuses: s.campuses,
      campusId: s.campusId,
      filters: s.filters,
      setFilters: s.setFilters,
      select: s.select,
      selection: s.selection,
      now: s.now,
    })),
  );

  const list = useMemo(() => listSessions(sessions, campusId, filters, cohorts), [sessions, campusId, filters, cohorts]);
  const lateCount = useMemo(
    () => Object.values(sessions).filter((s) => s.status === 'late' && (campusId === 'all' || s.campusId === campusId)).length,
    [sessions, campusId],
  );

  return (
    <aside className="panel filters">
      <div className="panel-head">
        <h2>필터</h2>
        {(filters.lateOnly || filters.cohortStatus !== 'all') && (
          <button className="link" onClick={() => setFilters({ lateOnly: false, cohortStatus: 'all' })}>
            초기화
          </button>
        )}
      </div>

      <label className="switch">
        <input type="checkbox" checked={filters.lateOnly} onChange={(e) => setFilters({ lateOnly: e.target.checked })} />
        <span className="track" />
        지연 세션만 보기
        <span className="badge bad">{lateCount}</span>
      </label>

      <div className="field">
        <div className="field-label">교육 차수 상태</div>
        <div className="chips">
          <button className={filters.cohortStatus === 'all' ? 'chip active' : 'chip'} onClick={() => setFilters({ cohortStatus: 'all' })}>
            전체
          </button>
          {(Object.keys(COHORT_STATUS) as CohortStatus[]).map((st) => (
            <button
              key={st}
              className={filters.cohortStatus === st ? 'chip active' : 'chip'}
              onClick={() => setFilters({ cohortStatus: st })}
            >
              <i style={{ background: COHORT_STATUS[st].color }} />
              {COHORT_STATUS[st].label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-head sub">
        <h2>교육 세션</h2>
        <span className="muted">{list.length}건</span>
      </div>
      <ul className="ship-list">
        {list.length === 0 && <li className="empty">조건에 맞는 세션이 없습니다.</li>}
        {list.map((s) => {
          const cohort = s.cohortId ? cohorts[s.cohortId] : null;
          const active = selection?.kind === 'cohort' && selection.id === s.cohortId;
          return (
            <li key={s.id}>
              <button
                className={active ? 'active' : ''}
                disabled={!cohort}
                onClick={() => cohort && select({ kind: 'cohort', id: cohort.id })}
                title={cohort ? '차수 선택' : '배정된 차수 없음'}
              >
                <div className="row">
                  <span className="ref">{s.title}</span>
                  <span className="status" style={{ color: SESSION_STATUS[s.status].color }}>
                    {SESSION_STATUS[s.status].label}
                  </span>
                </div>
                <div className="row muted">
                  <span>
                    {s.kind === 'lecture' ? '강의' : '실습'} · {campuses[s.campusId].code}
                    {cohort ? ` · ${cohort.name}` : ' · 미배정'}
                  </span>
                  <span>시작 {s.checkedInAt ? '입실' : relTime(s.startAt, now)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
