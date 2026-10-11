import type { DockStatus, ForkliftStatus, ShipmentStatus, TruckStatus } from './data/types';

export const AMBER = '#f5a524';

export const TRUCK_STATUS: Record<TruckStatus, { label: string; color: string }> = {
  idle: { label: '대기(주차)', color: '#6b7280' },
  en_route: { label: '이동 중', color: '#38bdf8' },
  queued: { label: '입차 대기', color: '#a78bfa' },
  docked: { label: '도크 접안', color: '#f5a524' },
  loading: { label: '상차 중', color: '#22c55e' },
  unloading: { label: '하차 중', color: '#14b8a6' },
  departing: { label: '출차', color: '#94a3b8' },
};

export const FORKLIFT_STATUS: Record<ForkliftStatus, { label: string; color: string }> = {
  idle: { label: '대기', color: '#6b7280' },
  moving: { label: '이동 중', color: '#38bdf8' },
  lifting: { label: '적재/하역', color: '#22c55e' },
  charging: { label: '충전 중', color: '#facc15' },
  fault: { label: '고장', color: '#ef4444' },
};

export const DOCK_STATUS: Record<DockStatus, { label: string; color: string }> = {
  free: { label: '비어 있음', color: '#22c55e' },
  occupied: { label: '사용 중', color: '#f5a524' },
  maintenance: { label: '정비 중', color: '#ef4444' },
};

export const SHIPMENT_STATUS: Record<ShipmentStatus, { label: string; color: string }> = {
  scheduled: { label: '예정', color: '#94a3b8' },
  in_transit: { label: '운송 중', color: '#38bdf8' },
  delayed: { label: '지연', color: '#ef4444' },
  at_dock: { label: '도크 처리 중', color: '#f5a524' },
  completed: { label: '완료', color: '#22c55e' },
};

export const CARRIER_COLORS: Record<string, string> = {
  한진로지스: '#2563eb',
  CJ대한통운: '#dc2626',
  롯데글로벌: '#e5e7eb',
  현대글로비스: '#0f766e',
};
