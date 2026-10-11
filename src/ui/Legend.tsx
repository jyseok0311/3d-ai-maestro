import { ASSISTANT_STATUS, COHORT_STATUS, ROOM_STATUS, TRACK } from '../theme';

const groups = [
  { title: '차수', items: Object.values(COHORT_STATUS) },
  { title: '과정', items: Object.values(TRACK) },
  { title: '로봇', items: Object.values(ASSISTANT_STATUS) },
  { title: '교육실', items: Object.values(ROOM_STATUS) },
];

export function Legend() {
  return (
    <div className="legend">
      {groups.map((g) => (
        <div key={g.title} className="legend-group">
          <span className="legend-title">{g.title}</span>
          {g.items.map((it) => (
            <span key={it.label} className="legend-item">
              <i style={{ background: it.color }} />
              {it.label}
            </span>
          ))}
        </div>
      ))}
      <div className="legend-hint">드래그: 이동 · 휠: 줌 · 클릭: 상세 · Esc: 닫기</div>
    </div>
  );
}
