import { useEffect, useState, type ReactNode } from 'react';
import { STAGE_ORDER } from '../data/layout';
import type { Participant, StageKey } from '../data/types';
import { useMaestroStore } from '../store/useMaestroStore';
import { attendanceRate, needsAttention } from '../store/selectors';
import { STAGE_COLOR, STALLED_COLOR, STATUS, TEAM_PHASE, milestone } from '../theme';
import { ago, clock, pct } from './format';

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
  const selection = useMaestroStore((s) => s.selection);
  const select = useMaestroStore((s) => s.select);

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
          {selection.kind === 'participant' && <ParticipantDetails id={selection.id} />}
          {selection.kind === 'team' && <TeamDetails id={selection.id} />}
          {selection.kind === 'facility' && <FacilityDetails id={selection.id} />}
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

function Meter({ value, tone }: { value: number; tone: 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`battery ${tone}`}>
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
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

/** Four-step journey strip with the current stage lit. */
function Journey({ current, done }: { current: StageKey; done: boolean }) {
  const stages = useMaestroStore((s) => s.stages);
  const at = STAGE_ORDER.indexOf(current);
  return (
    <ol className="journey">
      {STAGE_ORDER.map((id, i) => (
        <li
          key={id}
          className={done || i < at ? 'past' : i === at ? 'now' : ''}
          style={{ ['--stage' as string]: STAGE_COLOR[id] }}
        >
          <span>0{i + 1}</span>
          {stages[id].name}
        </li>
      ))}
    </ol>
  );
}

function PersonLink({ p }: { p: Participant }) {
  const select = useMaestroStore((s) => s.select);
  return (
    <button className="link" onClick={() => select({ kind: 'participant', id: p.id })}>
      {p.name}
    </button>
  );
}

function ParticipantDetails({ id }: { id: string }) {
  const p = useMaestroStore((s) => s.participants[id]);
  const team = useMaestroStore((s) => (p?.teamId ? s.teams[p.teamId] : null));
  const teams = useMaestroStore((s) => s.teams);
  const facility = useMaestroStore((s) => (p?.facilityId ? s.facilities[p.facilityId] : null));
  const select = useMaestroStore((s) => s.select);
  if (!p) return <div className="card muted">이 참가자는 프로그램을 마치고 퇴장했습니다.</div>;

  const rate = attendanceRate(p);
  const rateTone = rate === null ? 'good' : rate < 0.8 ? 'bad' : rate < 0.9 ? 'warn' : 'good';
  return (
    <>
      <Header kind={`참가자 · ${p.generation}기`} title={p.name} status={STATUS[p.status]} sub={`${p.department} ${p.title}`} />
      <Journey current={p.stage} done={p.status === 'graduated'} />
      {needsAttention(p, teams) && <div className="alert">관리 필요: {p.status === 'training' ? '출석률 80% 미만' : '소속 팀 진행 정체'}</div>}
      <Rows>
        <Row label="현재 위치">{facility?.label ?? '이동·대기 중'}</Row>
        <Row label="선발 점수">{p.score !== null ? `${p.score}점` : '심사 전'}</Row>
        {p.sessionsHeld > 0 && (
          <Row label="출석률">
            <Meter value={rate ?? 0} tone={rateTone} />
            {pct(rate)} ({p.sessionsAttended}/{p.sessionsHeld}회)
          </Row>
        )}
        {(p.stage !== 'selection' || p.assignmentsDone > 0) && (
          <Row label="과제">
            <Meter value={p.assignmentsDone / p.assignmentsTotal} tone="good" />
            {p.assignmentsDone}/{p.assignmentsTotal}
          </Row>
        )}
        <Row label="스터디 팀">
          {team ? (
            <button className="link" onClick={() => select({ kind: 'team', id: team.id })}>
              {team.name}
            </button>
          ) : (
            '—'
          )}
        </Row>
      </Rows>
      <Updated ts={p.lastUpdate} />
    </>
  );
}

function TeamDetails({ id }: { id: string }) {
  const team = useMaestroStore((s) => s.teams[id]);
  const participants = useMaestroStore((s) => s.participants);
  if (!team) return <div className="card muted">이 팀은 성과공유회를 마치고 해산했습니다.</div>;
  const color = team.stalled ? STALLED_COLOR : TEAM_PHASE[team.phase].color;
  const members = team.memberIds.map((mid) => participants[mid]).filter(Boolean);
  return (
    <>
      <Header
        kind="스터디 팀"
        title={team.name}
        status={team.stalled ? { label: '진행 정체 · 멘토 지원 필요', color: STALLED_COLOR } : TEAM_PHASE[team.phase]}
        sub={`멘토 ${team.mentor}`}
      />
      <h4>프로젝트</h4>
      <div className="card">
        <div className="row">
          <strong>{team.topic}</strong>
          <span style={{ color }}>{Math.round(team.progress)}%</span>
        </div>
        <div className="bar big">
          <div style={{ width: `${team.progress}%`, background: color }} />
        </div>
        <div className="row muted tiny">현재 단계: {milestone(team.progress)}</div>
        {team.award && (
          <div className="row">
            <span>시상</span>
            <strong className="award">🏆 {team.award}</strong>
          </div>
        )}
      </div>
      <h4>팀원 {members.length}명</h4>
      <ul className="lines members">
        {members.map((m) => (
          <li key={m.id}>
            <PersonLink p={m} />
            <span className="muted">
              {m.department} · {STATUS[m.status].label}
            </span>
          </li>
        ))}
      </ul>
      <Updated ts={team.lastUpdate} />
    </>
  );
}

function FacilityDetails({ id }: { id: string }) {
  const f = useMaestroStore((s) => s.facilities[id]);
  const participants = useMaestroStore((s) => s.participants);
  const teams = useMaestroStore((s) => s.teams);
  const stages = useMaestroStore((s) => s.stages);
  const select = useMaestroStore((s) => s.select);
  if (!f) return null;
  const occupants = Object.values(participants)
    .filter((p) => p.facilityId === f.id)
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  const team =
    f.kind === 'table'
      ? Object.values(teams).find((t) => t.tableId === f.id)
      : f.kind === 'stage'
        ? Object.values(teams).find((t) => t.phase === 'presenting')
        : undefined;
  const busy = occupants.length > 0;
  return (
    <>
      <Header
        kind={`${stages[f.stage].name} 구역`}
        title={f.label}
        status={busy ? { label: `사용 중 ${occupants.length}/${f.capacity}`, color: STAGE_COLOR[f.stage] } : { label: '비어 있음', color: '#6b7280' }}
      />
      {team && (
        <Rows>
          <Row label={f.kind === 'stage' ? '발표 팀' : '사용 팀'}>
            <button className="link" onClick={() => select({ kind: 'team', id: team.id })}>
              {team.name} · {Math.round(team.progress)}%
            </button>
          </Row>
        </Rows>
      )}
      <h4>현재 인원</h4>
      {occupants.length === 0 && <div className="card muted">지금은 아무도 없습니다.</div>}
      <ul className="lines members">
        {occupants.map((p) => (
          <li key={p.id}>
            <PersonLink p={p} />
            <span className="muted">
              {p.department} · {STATUS[p.status].label}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
