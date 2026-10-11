import { STATUS } from '../theme';

const groups = [
  { title: '선발', keys: ['applied', 'screening', 'interview', 'not_selected'] as const },
  { title: '교육', keys: ['selected', 'training'] as const },
  { title: '스터디', keys: ['study_wait', 'studying'] as const },
  { title: '성과공유회', keys: ['audience', 'presenting', 'graduated'] as const },
];

export function Legend() {
  return (
    <div className="legend">
      {groups.map((g) => (
        <div key={g.title} className="legend-group">
          <span className="legend-title">{g.title}</span>
          {g.keys.map((k) => (
            <span key={k} className="legend-item">
              <i style={{ background: STATUS[k].color }} />
              {STATUS[k].label}
            </span>
          ))}
        </div>
      ))}
      <span className="legend-item">
        <i className="diamond" />
        관리 필요
      </span>
      <div className="legend-hint">드래그: 이동 · 휠: 줌 · 클릭: 상세 · Esc: 닫기</div>
    </div>
  );
}
