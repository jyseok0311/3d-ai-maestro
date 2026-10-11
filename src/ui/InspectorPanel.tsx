import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '../data/types';
import { useMaestroStore } from '../store/useMaestroStore';
import { isLowStock, parseCabinetKey } from '../store/selectors';
import { ASSISTANT_STATUS, COHORT_STATUS, ROOM_STATUS, SESSION_STATUS, TRACK } from '../theme';
import { ago, clock, relTime } from './format';

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
          {selection.kind === 'cohort' && <CohortDetails id={selection.id} />}
          {selection.kind === 'assistant' && <AssistantDetails id={selection.id} />}
          {selection.kind === 'room' && <RoomDetails id={selection.id} />}
          {selection.kind === 'cabinet' && <CabinetDetails cabinetKey={selection.id} />}
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

function SessionCard({ session }: { session: Session | null }) {
  const materials = useMaestroStore((s) => s.materials);
  const now = useNow();
  if (!session) return <div className="card muted">진행 중인 세션 없음</div>;
  const st = SESSION_STATUS[session.status];
  const late = session.checkedInAt !== null ? session.checkedInAt > session.startAt : session.startAt < now;
  return (
    <div className="card">
      <div className="row">
        <strong>{session.title}</strong>
        <span style={{ color: st.color }}>{st.label}</span>
      </div>
      <Rows>
        <Row label="유형">{session.kind === 'lecture' ? '강의' : '실습'} · {session.reference}</Row>
        <Row label="시작">
          {clock(session.startAt)} <span className={late ? 'bad-text' : 'muted'}>({relTime(session.startAt, now)})</span>
        </Row>
        {session.checkedInAt && <Row label="입실">{clock(session.checkedInAt)}</Row>}
      </Rows>
      <ul className="lines">
        {session.lines.map((l, i) => {
          const m = materials[l.materialId];
          return (
            <li key={i}>
              <span>{m?.name ?? l.materialId}</span>
              <span className="muted">{l.quantity}개</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CohortDetails({ id }: { id: string }) {
  const cohort = useMaestroStore((s) => s.cohorts[id]);
  const room = useMaestroStore((s) => (cohort?.roomId ? s.rooms[cohort.roomId] : null));
  const session = useMaestroStore((s) => (cohort?.sessionId ? s.sessions[cohort.sessionId] : null));
  const campus = useMaestroStore((s) => (cohort ? s.campuses[cohort.campusId] : null));
  if (!cohort || !campus) return null;
  const track = TRACK[cohort.track];
  return (
    <>
      <Header kind="교육 차수" title={cohort.name} status={COHORT_STATUS[cohort.status]} sub={`${track.label} 과정 · ${campus.name}`} />
      <Rows>
        <Row label="강사">{cohort.instructor}</Row>
        <Row label="수강 인원">{cohort.learners}명</Row>
        <Row label="주요 소속">{cohort.department}</Row>
        <Row label="교육실">{room?.label ?? '—'}</Row>
      </Rows>
      <h4>현재 세션</h4>
      <SessionCard session={session} />
      <Updated ts={cohort.lastUpdate} />
    </>
  );
}

function AssistantDetails({ id }: { id: string }) {
  const bot = useMaestroStore((s) => s.assistants[id]);
  const session = useMaestroStore((s) => (bot?.sessionId ? s.sessions[bot.sessionId] : null));
  const campus = useMaestroStore((s) => (bot ? s.campuses[bot.campusId] : null));
  if (!bot || !campus) return null;
  const batteryTone = bot.battery < 20 ? 'bad' : bot.battery < 50 ? 'warn' : 'good';
  return (
    <>
      <Header kind="실습 지원 로봇" title={bot.name} status={ASSISTANT_STATUS[bot.status]} sub={campus.name} />
      <Rows>
        <Row label="담당 조교">{bot.supervisor}</Row>
        <Row label="배터리">
          <div className={`battery ${batteryTone}`}>
            <div style={{ width: `${bot.battery}%` }} />
          </div>
          {Math.round(bot.battery)}%
        </Row>
        <Row label="위치">
          x {bot.position.x.toFixed(1)}, z {bot.position.z.toFixed(1)}
        </Row>
      </Rows>
      <h4>지원 중인 세션</h4>
      <SessionCard session={session} />
      <Updated ts={bot.lastUpdate} />
    </>
  );
}

function RoomDetails({ id }: { id: string }) {
  const room = useMaestroStore((s) => s.rooms[id]);
  const cohort = useMaestroStore((s) => (room?.cohortId ? s.cohorts[room.cohortId] : null));
  const session = useMaestroStore((s) => (cohort?.sessionId ? s.sessions[cohort.sessionId] : null));
  const campus = useMaestroStore((s) => (room ? s.campuses[room.campusId] : null));
  const select = useMaestroStore((s) => s.select);
  if (!room || !campus) return null;
  return (
    <>
      <Header kind="교육실" title={room.label} status={ROOM_STATUS[room.status]} sub={campus.name} />
      <Rows>
        <Row label="좌석">{room.seats}석</Row>
        <Row label="사용 차수">
          {cohort ? (
            <button className="link" onClick={() => select({ kind: 'cohort', id: cohort.id })}>
              {cohort.name} · {COHORT_STATUS[cohort.status].label}
            </button>
          ) : (
            '—'
          )}
        </Row>
      </Rows>
      <h4>현재 세션</h4>
      <SessionCard session={session} />
      <Updated ts={room.lastUpdate} />
    </>
  );
}

function CabinetDetails({ cabinetKey }: { cabinetKey: string }) {
  const { campusId, aisle, bay } = parseCabinetKey(cabinetKey);
  const campus = useMaestroStore((s) => s.campuses[campusId]);
  const materials = useMaestroStore((s) => s.materials);
  const items = Object.values(materials)
    .filter((m) => m.campusId === campusId && m.location.aisle === aisle && m.location.bay === bay)
    .sort((a, b) => b.location.level - a.location.level);
  const low = items.some(isLowStock);
  const now = useNow();
  return (
    <>
      <Header
        kind="교보재 보관함"
        title={`${aisle}열 ${bay}번 보관함`}
        sub={campus?.name}
        status={low ? { label: '교보재 부족', color: '#ef4444' } : { label: items.length ? '정상' : '등록 품목 없음', color: items.length ? '#22c55e' : '#6b7280' }}
      />
      <h4>보관 품목</h4>
      {items.length === 0 && <div className="card muted">이 보관함에 등록된 교보재가 없습니다.</div>}
      {items.map((it) => {
        const ratio = Math.min(1, it.quantity / (it.reorderPoint * 3));
        const isLow = isLowStock(it);
        return (
          <div className="card" key={it.id}>
            <div className="row">
              <strong>{it.name}</strong>
              <span className="muted">{it.location.level}단</span>
            </div>
            <div className="row muted">
              <span>{it.sku}</span>
              <span className={isLow ? 'bad-text' : ''}>
                {it.quantity}개 / 재주문점 {it.reorderPoint}
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
