/**
 * AI Maestro training-operations data model.
 *
 * Campus 1─N Room, Cohort, Assistant, Material, Session
 * Cohort    0..1 Room     (cohort.roomId    <-> room.cohortId)
 * Cohort    0..1 Session  (cohort.sessionId <-> session.cohortId)
 * Session   N─N Material  via SessionLine (materials handed out)
 * Assistant 0..1 Session  (the session it is currently supporting)
 */

export type ID = string;

/** Campus-local ground coordinates in metres (x → east, z → south). */
export interface Vec2 {
  x: number;
  z: number;
}

export interface Campus {
  id: ID;
  code: string;
  name: string;
  address: string;
  /** World-space centre of the campus. All other positions are campus-local. */
  origin: Vec2;
}

export type RoomStatus = 'free' | 'in_session' | 'maintenance';

export interface Room {
  id: ID;
  campusId: ID;
  /** 0-based slot along the training-centre front. */
  index: number;
  label: string;
  seats: number;
  status: RoomStatus;
  cohortId: ID | null;
  lastUpdate: number;
}

export type Track = 'basic' | 'prompt' | 'automation' | 'data';

export type CohortStatus =
  | 'break'
  | 'moving'
  | 'waiting'
  | 'checked_in'
  | 'lecture'
  | 'practice'
  | 'leaving';

/** A training class of staff learners that moves around campus as a group. */
export interface Cohort {
  id: ID;
  name: string;
  track: Track;
  instructor: string;
  /** Home department of most learners in the class. */
  department: string;
  learners: number;
  campusId: ID;
  status: CohortStatus;
  roomId: ID | null;
  sessionId: ID | null;
  lastUpdate: number;
}

export type AssistantStatus = 'idle' | 'moving' | 'assisting' | 'charging' | 'fault';

/** Teaching-assistant robot that ferries devices and kits to classrooms. */
export interface Assistant {
  id: ID;
  name: string;
  /** Human TA responsible for the robot. */
  supervisor: string;
  campusId: ID;
  status: AssistantStatus;
  /** 0–100 %. */
  battery: number;
  position: Vec2;
  target: Vec2;
  sessionId: ID | null;
  lastUpdate: number;
}

export type MaterialCategory = 'device' | 'kit' | 'textbook' | 'av' | 'consumable';

export interface StorageLocation {
  /** Cabinet row, 'A'–'F'. */
  aisle: string;
  /** Cabinet column, 1–10. */
  bay: number;
  /** Shelf level, 1–3. */
  level: number;
}

export interface Material {
  id: ID;
  campusId: ID;
  sku: string;
  name: string;
  category: MaterialCategory;
  quantity: number;
  reorderPoint: number;
  location: StorageLocation;
}

export type SessionKind = 'lecture' | 'practice';

export type SessionStatus = 'scheduled' | 'moving' | 'late' | 'in_progress' | 'completed';

export interface SessionLine {
  materialId: ID;
  quantity: number;
}

export interface Session {
  id: ID;
  reference: string;
  title: string;
  campusId: ID;
  kind: SessionKind;
  status: SessionStatus;
  cohortId: ID | null;
  roomId: ID | null;
  lines: SessionLine[];
  /** Scheduled start (epoch ms): the class should be checked in by then. */
  startAt: number;
  /** Actual check-in time (epoch ms), once it happened. */
  checkedInAt: number | null;
  lastUpdate: number;
}

/** Normalised world state: every collection is keyed by id. */
export interface WorldData {
  campuses: Record<ID, Campus>;
  rooms: Record<ID, Room>;
  cohorts: Record<ID, Cohort>;
  assistants: Record<ID, Assistant>;
  materials: Record<ID, Material>;
  sessions: Record<ID, Session>;
}
