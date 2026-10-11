import type { ParticipantStatus, StageKey, TeamPhase } from './data/types';

export const ACCENT = '#4f9dff';

export const STAGE_COLOR: Record<StageKey, string> = {
  selection: '#a78bfa',
  training: '#4f9dff',
  study: '#34d399',
  showcase: '#fbbf24',
};

export const STATUS: Record<ParticipantStatus, { label: string; color: string }> = {
  applied: { label: '지원 접수', color: '#c4b5fd' },
  screening: { label: '서류심사', color: '#a78bfa' },
  interview: { label: '면접', color: '#8b5cf6' },
  selected: { label: '선발 확정', color: '#93c5fd' },
  not_selected: { label: '미선발', color: '#6b7280' },
  training: { label: '교육 수강', color: '#4f9dff' },
  study_wait: { label: '팀 배정 대기', color: '#6ee7b7' },
  studying: { label: '팀 스터디', color: '#34d399' },
  audience: { label: '발표 대기', color: '#fcd34d' },
  presenting: { label: '발표 중', color: '#f59e0b' },
  graduated: { label: '수료', color: '#fde68a' },
};

export const TEAM_PHASE: Record<TeamPhase, { label: string; color: string }> = {
  forming: { label: '팀 구성 중', color: '#6ee7b7' },
  studying: { label: '스터디 진행', color: '#34d399' },
  ready: { label: '발표 대기', color: '#fcd34d' },
  presenting: { label: '발표 중', color: '#f59e0b' },
  done: { label: '발표 완료', color: '#fde68a' },
};

export const STALLED_COLOR = '#ef4444';

/** Study milestone shown for a team's progress. */
export function milestone(progress: number): string {
  if (progress >= 100) return '발표 준비 완료';
  if (progress >= 75) return '발표 자료 준비';
  if (progress >= 45) return '프로토타입 제작';
  if (progress >= 20) return '데이터·업무 분석';
  return '주제 구체화';
}
