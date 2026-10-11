/**
 * AI Maestro programme-journey data model.
 *
 * Stage    1─N Facility  (booths, interview rooms, classrooms, study tables, stage, audience)
 * Participant 0..1 Facility + seat  (where the person currently sits or stands)
 * Participant 0..1 Team             (participant.teamId <-> team.memberIds)
 * Team     0..1 Facility            (the study table it works at)
 *
 * Journey: applied → screening → interview → selected → training → study_wait
 *          → studying → audience → presenting → graduated   (or → not_selected)
 */

export type ID = string;

/** World ground coordinates in metres (x → east, z → south). */
export interface Vec2 {
  x: number;
  z: number;
}

export type StageKey = 'selection' | 'training' | 'study' | 'showcase';

export interface Stage {
  id: StageKey;
  /** 1-based position in the journey. */
  order: number;
  name: string;
  subtitle: string;
  /** World-space centre of the stage's zone. */
  origin: Vec2;
}

export type FacilityKind = 'booth' | 'interview' | 'classroom' | 'table' | 'stage' | 'audience';

export interface Facility {
  id: ID;
  stage: StageKey;
  kind: FacilityKind;
  /** 0-based index among facilities of the same kind. */
  index: number;
  label: string;
  capacity: number;
}

export type ParticipantStatus =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'selected'
  | 'not_selected'
  | 'training'
  | 'study_wait'
  | 'studying'
  | 'audience'
  | 'presenting'
  | 'graduated';

export interface Participant {
  id: ID;
  name: string;
  department: string;
  title: string;
  /** Programme generation (기수) the person applied to. */
  generation: number;
  stage: StageKey;
  status: ParticipantStatus;
  facilityId: ID | null;
  seat: number | null;
  teamId: ID | null;
  /** Combined screening + interview score, once assessed. */
  score: number | null;
  sessionsHeld: number;
  sessionsAttended: number;
  assignmentsDone: number;
  assignmentsTotal: number;
  lastUpdate: number;
}

export type TeamPhase = 'forming' | 'studying' | 'ready' | 'presenting' | 'done';
export type Award = '대상' | '최우수상' | '우수상' | '장려상';

export interface Team {
  id: ID;
  name: string;
  topic: string;
  mentor: string;
  memberIds: ID[];
  tableId: ID | null;
  phase: TeamPhase;
  /** 0–100 %. */
  progress: number;
  /** No progress until a mentor steps in. */
  stalled: boolean;
  award: Award | null;
  readyAt: number | null;
  lastUpdate: number;
}

export interface ActivityEvent {
  id: ID;
  ts: number;
  stage: StageKey;
  text: string;
  /** Selection target for a click on the log line. */
  ref: { kind: 'participant' | 'team'; id: ID } | null;
}

/** Cumulative programme counters (include people who already left the map). */
export interface ProgramStats {
  generation: number;
  applied: number;
  selected: number;
  notSelected: number;
  graduated: number;
  presentedTeams: number;
}

/** Normalised world state: every collection is keyed by id. */
export interface WorldData {
  stages: Record<StageKey, Stage>;
  facilities: Record<ID, Facility>;
  participants: Record<ID, Participant>;
  teams: Record<ID, Team>;
  events: ActivityEvent[];
  stats: ProgramStats;
  /** Monotonic counter for new ids. */
  seq: number;
}
