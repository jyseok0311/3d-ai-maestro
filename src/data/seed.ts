import {
  AISLES,
  BAYS,
  CAMPUS_SPACING,
  CHARGER,
  LEVELS,
  PREP_ZONE,
  ROOM_COUNT,
  TRAVEL_AISLE_Z,
} from './layout';
import type {
  Assistant,
  Campus,
  Cohort,
  CohortStatus,
  Material,
  MaterialCategory,
  Room,
  Session,
  SessionKind,
  Track,
  WorldData,
} from './types';

/** Deterministic PRNG so the seed is identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((x) => [x.id, x]));
}

const CAMPUS_DEFS = [
  { code: 'JJ', name: '장전캠퍼스 AI교육관', address: '부산 금정구' },
  { code: 'YS', name: '양산캠퍼스 AI교육관', address: '경남 양산시' },
  { code: 'MY', name: '밀양캠퍼스 AI교육관', address: '경남 밀양시' },
];

const ROOM_NAMES = ['AI 실습실 1', 'AI 실습실 2', '프롬프트 랩', '자동화 랩', '데이터 랩', '세미나실'];

const TRACKS: Track[] = ['basic', 'prompt', 'automation', 'data'];
const DEPARTMENTS = ['학사과', '입학과', '재무과', '연구지원과', '시설과', '국제교류과', '도서관', '총무과'];
const INSTRUCTORS = ['김하늘', '이도현', '박서연', '최지훈', '정예린', '강민준', '조수빈', '윤태호', '장은지', '임재원', '한소희', '오성민'];
const TA_NAMES = ['서지안', '권하린', '황유나', '송민서', '안채원', '배지우', '유수아', '홍다은'];

const MATERIAL_DEFS: { name: string; category: MaterialCategory }[] = [
  { name: 'AI 실습용 노트북', category: 'device' },
  { name: '태블릿 PC', category: 'device' },
  { name: 'VR 헤드셋', category: 'device' },
  { name: '웹캠·마이크 세트', category: 'av' },
  { name: '무선 프레젠터', category: 'av' },
  { name: '휴대용 스피커', category: 'av' },
  { name: 'GPU 클라우드 실습 키트', category: 'kit' },
  { name: '업무자동화 실습 키트', category: 'kit' },
  { name: '데이터 분석 샘플셋', category: 'kit' },
  { name: '챗봇 만들기 키트', category: 'kit' },
  { name: '생성형 AI 기초 교재', category: 'textbook' },
  { name: '프롬프트 워크북', category: 'textbook' },
  { name: '업무자동화 가이드북', category: 'textbook' },
  { name: '데이터 리터러시 교재', category: 'textbook' },
  { name: 'AI 윤리·보안 핸드북', category: 'textbook' },
  { name: '실습 계정 안내 카드', category: 'consumable' },
  { name: '수료증 용지', category: 'consumable' },
  { name: '명찰·이름표', category: 'consumable' },
  { name: '포스트잇·필기구 세트', category: 'consumable' },
  { name: '설문지·평가지', category: 'consumable' },
];

export const SESSION_TITLES: Record<Track, string[]> = {
  basic: ['생성형 AI 이해', 'AI 도구 첫걸음', 'AI 윤리와 보안'],
  prompt: ['업무 프롬프트 설계', '공문서 초안 작성', '회의록 요약 실습'],
  automation: ['반복업무 자동화', '엑셀 업무 AI 활용', '메일 자동 분류'],
  data: ['데이터 시각화 기초', '행정 데이터 분석', '대시보드 만들기'],
};

/** Build the seed relative to `now` so start times are always meaningful. */
export function createSeed(now: number = Date.now()): WorldData {
  const rand = mulberry32(20261011);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

  // ── Campuses ──────────────────────────────────────────────────────────
  const campuses: Campus[] = CAMPUS_DEFS.map((def, i) => ({
    id: `campus-${i + 1}`,
    ...def,
    origin: { x: (i - (CAMPUS_DEFS.length - 1) / 2) * CAMPUS_SPACING, z: 0 },
  }));

  // ── Rooms: 6 per campus ───────────────────────────────────────────────
  const rooms: Room[] = campuses.flatMap((campus) =>
    Array.from({ length: ROOM_COUNT }, (_, i) => ({
      id: `${campus.id}-room-${i + 1}`,
      campusId: campus.id,
      index: i,
      label: `${campus.code}-${ROOM_NAMES[i]}`,
      seats: i === 5 ? 40 : 24,
      status: 'free' as const,
      cohortId: null,
      lastUpdate: now,
    })),
  );
  // One room is being serviced on the second campus.
  rooms[ROOM_COUNT + 5].status = 'maintenance';

  // ── Materials: 40 spread across campuses and cabinets ────────────────
  const usedSlots = new Set<string>();
  const materials: Material[] = Array.from({ length: 40 }, (_, i) => {
    const campus = campuses[i % campuses.length];
    const def = MATERIAL_DEFS[i % MATERIAL_DEFS.length];
    let location;
    do {
      location = { aisle: pick(AISLES), bay: randInt(1, BAYS), level: randInt(1, LEVELS) };
    } while (usedSlots.has(`${campus.id}${location.aisle}${location.bay}${location.level}`));
    usedSlots.add(`${campus.id}${location.aisle}${location.bay}${location.level}`);
    const reorderPoint = randInt(2, 6) * 5;
    // ~20 % of materials start at or below their reorder point.
    const quantity = rand() < 0.2 ? randInt(2, reorderPoint) : randInt(reorderPoint + 10, reorderPoint * 5);
    return {
      id: `mat-${pad(i + 1, 3)}`,
      campusId: campus.id,
      sku: `${def.category.slice(0, 3).toUpperCase()}-${pad(100 + i * 7, 4)}`,
      name: def.name,
      category: def.category,
      quantity,
      reorderPoint,
      location,
    };
  });

  // ── Cohorts: 12, four per campus, in a spread of lifecycle states ────
  const cohortStates: CohortStatus[] = ['practice', 'lecture', 'checked_in', 'waiting', 'moving', 'break'];
  const cohorts: Cohort[] = Array.from({ length: 12 }, (_, i) => {
    const track = TRACKS[i % TRACKS.length];
    return {
      id: `cohort-${pad(i + 1)}`,
      name: `${3 + Math.floor(i / 6)}기 ${(i % 6) + 1}반`,
      track,
      instructor: INSTRUCTORS[i],
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      learners: randInt(14, 24),
      campusId: campuses[i % campuses.length].id,
      status: cohortStates[(i + Math.floor(i / 3)) % cohortStates.length],
      roomId: null,
      sessionId: null,
      lastUpdate: now - randInt(5, 120) * 1000,
    };
  });

  // Seat every cohort that is in class into a free room of its campus.
  for (const cohort of cohorts) {
    if (!['checked_in', 'lecture', 'practice'].includes(cohort.status)) continue;
    const room = rooms.find((r) => r.campusId === cohort.campusId && r.status === 'free');
    if (!room) {
      cohort.status = 'waiting';
      continue;
    }
    room.status = 'in_session';
    room.cohortId = cohort.id;
    cohort.roomId = room.id;
  }

  // ── Sessions: 25 with start times ─────────────────────────────────────
  const sessions: Session[] = [];
  const minute = 60_000;
  const makeLines = (campusId: string) => {
    const campusMaterials = materials.filter((m) => m.campusId === campusId);
    return Array.from({ length: randInt(1, 3) }, () => ({
      materialId: pick(campusMaterials).id,
      quantity: randInt(1, 4) * 5,
    }));
  };
  const addSession = (s: Omit<Session, 'id' | 'reference' | 'title' | 'lines' | 'lastUpdate'>, track: Track) => {
    const n = sessions.length + 1;
    sessions.push({
      id: `ses-${pad(n, 3)}`,
      reference: `S-2610-${pad(n, 4)}`,
      title: pick(SESSION_TITLES[track]),
      lines: makeLines(s.campusId),
      lastUpdate: now,
      ...s,
    });
    return sessions[sessions.length - 1];
  };

  // 1) One session for every cohort that is not on a break.
  for (const cohort of cohorts) {
    if (cohort.status === 'break') continue;
    const inRoom = cohort.roomId !== null;
    const kind: SessionKind = cohort.status === 'practice' ? 'practice' : cohort.status === 'lecture' ? 'lecture' : pick(['lecture', 'practice'] as const);
    const startAt = inRoom ? now - randInt(5, 40) * minute : now + randInt(-6, 4) * minute;
    const session = addSession(
      {
        campusId: cohort.campusId,
        kind,
        status: inRoom ? 'in_progress' : startAt < now ? 'late' : 'moving',
        cohortId: cohort.id,
        roomId: cohort.roomId,
        startAt,
        checkedInAt: inRoom ? startAt + randInt(-10, 12) * minute : null,
      },
      cohort.track,
    );
    cohort.sessionId = session.id;
  }

  // 2) Completed history so the on-time rate starts meaningful.
  while (sessions.length < 19) {
    const campus = pick(campuses);
    const startAt = now - randInt(60, 360) * minute;
    addSession(
      {
        campusId: campus.id,
        kind: pick(['lecture', 'practice'] as const),
        status: 'completed',
        cohortId: null,
        roomId: pick(rooms.filter((r) => r.campusId === campus.id)).id,
        startAt,
        checkedInAt: startAt + (rand() < 0.75 ? -randInt(1, 15) : randInt(3, 25)) * minute,
      },
      pick(TRACKS),
    );
  }

  // 3) Upcoming sessions with no class assigned yet.
  while (sessions.length < 25) {
    addSession(
      {
        campusId: pick(campuses).id,
        kind: pick(['lecture', 'practice'] as const),
        status: 'scheduled',
        cohortId: null,
        roomId: null,
        startAt: now + randInt(1, 6) * minute,
        checkedInAt: null,
      },
      pick(TRACKS),
    );
  }

  // ── Assistant robots: 8 spread over campuses ─────────────────────────
  const assistants: Assistant[] = Array.from({ length: 8 }, (_, i) => {
    const onAisle = i % 2 === 0;
    const position = onAisle
      ? { x: randInt(-28, 4), z: TRAVEL_AISLE_Z[i % TRAVEL_AISLE_Z.length] }
      : { x: randInt(PREP_ZONE.minX + 2, PREP_ZONE.maxX - 2), z: randInt(PREP_ZONE.minZ + 4, PREP_ZONE.maxZ - 2) };
    const status = i === 7 ? 'charging' : i === 3 ? 'assisting' : 'idle';
    return {
      id: `ta-${pad(i + 1)}`,
      name: `TA-${pad(i + 1)}`,
      supervisor: TA_NAMES[i],
      campusId: campuses[i % campuses.length].id,
      status,
      battery: status === 'charging' ? 18 : randInt(35, 98),
      position: status === 'charging' ? { ...CHARGER } : position,
      target: status === 'charging' ? { ...CHARGER } : position,
      sessionId: null,
      lastUpdate: now - randInt(1, 30) * 1000,
    };
  });

  return {
    campuses: byId(campuses),
    rooms: byId(rooms),
    cohorts: byId(cohorts),
    assistants: byId(assistants),
    materials: byId(materials),
    sessions: byId(sessions),
  };
}
