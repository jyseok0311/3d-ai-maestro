import type { AssistantStatus, CohortStatus, MaterialCategory, RoomStatus, SessionStatus, Track } from './data/types';

export const ACCENT = '#4f9dff';

export const COHORT_STATUS: Record<CohortStatus, { label: string; color: string }> = {
  break: { label: '휴식', color: '#6b7280' },
  moving: { label: '이동 중', color: '#22d3ee' },
  waiting: { label: '입실 대기', color: '#a78bfa' },
  checked_in: { label: '입실 완료', color: '#4f9dff' },
  lecture: { label: '강의 중', color: '#22c55e' },
  practice: { label: '실습 중', color: '#f59e0b' },
  leaving: { label: '퇴실', color: '#94a3b8' },
};

export const ASSISTANT_STATUS: Record<AssistantStatus, { label: string; color: string }> = {
  idle: { label: '대기', color: '#6b7280' },
  moving: { label: '이동 중', color: '#22d3ee' },
  assisting: { label: '실습 지원', color: '#22c55e' },
  charging: { label: '충전 중', color: '#facc15' },
  fault: { label: '점검 필요', color: '#ef4444' },
};

export const ROOM_STATUS: Record<RoomStatus, { label: string; color: string }> = {
  free: { label: '비어 있음', color: '#22c55e' },
  in_session: { label: '교육 중', color: '#4f9dff' },
  maintenance: { label: '장비 점검', color: '#ef4444' },
};

export const SESSION_STATUS: Record<SessionStatus, { label: string; color: string }> = {
  scheduled: { label: '예정', color: '#94a3b8' },
  moving: { label: '이동 중', color: '#22d3ee' },
  late: { label: '지연', color: '#ef4444' },
  in_progress: { label: '진행 중', color: '#4f9dff' },
  completed: { label: '완료', color: '#22c55e' },
};

export const TRACK: Record<Track, { label: string; color: string }> = {
  basic: { label: 'AI 기초', color: '#60a5fa' },
  prompt: { label: '프롬프트 실무', color: '#c084fc' },
  automation: { label: '업무 자동화', color: '#34d399' },
  data: { label: '데이터 분석', color: '#fb923c' },
};

/** Box colours for each kind of material stored in the cabinets. */
export const MATERIAL_COLOR: Record<MaterialCategory, string> = {
  device: '#3b82f6',
  kit: '#14b8a6',
  textbook: '#e2c08d',
  av: '#8b5cf6',
  consumable: '#cbd5e1',
};
