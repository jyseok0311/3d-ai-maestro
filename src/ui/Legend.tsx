import { DOCK_STATUS, FORKLIFT_STATUS, TRUCK_STATUS } from '../theme';

const groups = [
  { title: '트럭', items: Object.values(TRUCK_STATUS) },
  { title: '지게차', items: Object.values(FORKLIFT_STATUS) },
  { title: '도크', items: Object.values(DOCK_STATUS) },
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
