export function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  return `${Math.floor(m / 60)}시간 전`;
}

/** "3분 후" / "5분 지남" relative to now. */
export function relTime(ts: number, now: number): string {
  const diff = Math.round((ts - now) / 1000);
  const abs = Math.abs(diff);
  const text = abs < 60 ? `${abs}초` : abs < 3600 ? `${Math.round(abs / 60)}분` : `${Math.round(abs / 3600)}시간`;
  return diff >= 0 ? `${text} 후` : `${text} 지남`;
}

export function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}
