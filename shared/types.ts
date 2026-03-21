// ─── Media ───────────────────────────────────────────────────────────────────

export type MediaType = 'photo' | 'gif' | 'note' | 'clip' | 'link' | 'youtube' | 'interview' | 'ticker';
export type MediaStatus = 'pending' | 'ready' | 'played' | 'evicted';
export type MediaEventType = 'displayed' | 'skipped' | 'held' | 'evicted' | 'enriched' | 'replayed';

export interface MediaItem {
  id: string;
  type: MediaType;
  content: MediaContent;
  queuePosition: number | null; // position in queue.main (null = not yet placed or played)
  status: MediaStatus;
  submittedAt: number; // timestamp ms
  author: MediaAuthor;
}

export type MediaContent =
  | PhotoContent
  | GifContent
  | NoteContent
  | ClipContent
  | LinkContent
  | YoutubeContent
  | InterviewContent
  | TickerContent;

export interface PhotoContent  { url: string; caption: string | null }
export interface GifContent    { url: string; caption: string | null }
export interface NoteContent   { text: string }
export interface ClipContent   { url: string; duration: number; mimeType: string; caption: string | null }
export interface LinkContent   { url: string; title: string | null; description: string | null; thumbnail: string | null; siteName: string | null; caption: string | null }
export interface YoutubeContent { url: string; youtubeId: string; title: string; duration: number; thumbnail: string; caption: string | null }
export interface TickerContent { text: string; label?: string }
export interface InterviewContent {
  segments: InterviewSegment[];
  subject: InterviewSubject;
}
export interface InterviewSegment {
  question: string;
  video: string | null;
  duration: number | null;
  textOnly: string | null;
  photos: string[];
}
export interface InterviewSubject {
  type: 'self' | 'participant' | 'manual';
  participantId: string | null;
  displayName: string;
  team: string;
  role: string;
}

export interface MediaAuthor {
  participantId: string; // 'system:admin' | uuid
  displayName: string;
  team: string;
  role: string;
}

// ─── Scored item (admin queue view) ──────────────────────────────────────────

export interface ScoredMediaItem extends MediaItem {
  displayedCount: number;
  skippedCount: number;
}

export interface MediaEvent {
  id: string;
  itemId: string;
  type: MediaEventType;
  appId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: number;
}

// ─── Participant ──────────────────────────────────────────────────────────────

export interface Participant {
  id: string;
  username: string | null; // null for phantom system accounts (system:admin)
  displayName: string;
  team: string;
  role: string;
  avatarUrl: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  banned: boolean;
  bannedAt: number | null;
  banReason: string | null;
}

// ─── Author stats (pool/authors endpoint) ────────────────────────────────────

export interface AuthorStats {
  id:             string;
  displayName:    string;
  team:           string;
  readyCount:     number;       // items currently ready in pool
  displayedCount: number;       // items displayed this session
  skippedCount:   number;       // items skipped this session
  banned:         boolean;
}

// ─── Broadcast ───────────────────────────────────────────────────────────────

export type JamStatus = 'idle' | 'running' | 'ended';
export type AppId = string;

export interface GlobalState {
  jam: {
    status: JamStatus;
    startedAt: number | null;
    endsAt: number | null;
    timeRemaining: number | null;
  };
  broadcast: {
    activeApp:     AppId;
    transition:    'idle' | 'in_progress';
    panicState:    boolean;
    panicMessage:  string;        // message shown on TV panic overlay
    nextTriggerAt: number | null; // absolute ms of next unfired schedule trigger
    activeItemIds: string[];      // IDs of items currently displayed by jam-mode (0-3)
    regime:        'normal' | 'hold' | 'buffer'; // jam-mode fetch pipeline state
  };
  pool: {
    total:         number;
    fresh:         number;
    queueSnapshot: MediaItem[];
    // Health fields
    byType:    Record<string, number>; // { photo: 5, note: 12, … }
    holdCount: number;                 // cumulative times jam-mode entered hold regime since JAM start
  };
}

// ─── App contract ─────────────────────────────────────────────────────────────

export interface App {
  readonly id: AppId;
  readonly outroMode: 'sequential' | 'concurrent' | 'none';
  load(signal: AbortSignal): void;
  play(): void;
  stop(): Promise<void>;
  remove(): void;
  onPoolUpdate(item: MediaItem): void;
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

export interface MarketTrigger {
  type: 'market';
  appId: AppId;
  source: 'admin' | 'system';
}

export interface LimitTrigger {
  type: 'limit';
  condition: TimeCondition;
  appId: AppId;
  fired: boolean;
}

export type TimeCondition =
  | { at: 'absolute'; value: string }   // ISO timestamp
  | { at: 'H+';       value: number }   // ms après jam.startedAt
  | { at: 'T-';       value: number };  // ms avant jam.endsAt

// ─── Broadcast Events (caisse noire) ─────────────────────────────────────────

export type BroadcastEventType =
  | 'transition'
  | 'trigger_fired'
  | 'jam_state_change'
  | 'app_error'
  | 'panic_activated'
  | 'panic_cleared'
  | 'lifecycle_timeout';

export interface BroadcastEvent {
  id: string;
  type: BroadcastEventType;
  payload: Record<string, unknown> | null;
  createdAt: number;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export type ScheduleEntryStatus = 'pending' | 'fired' | 'skipped';

export interface ScheduleEntry {
  id:         number;
  at:         string;              // "H+00:10:00" | "T-04:00:00" | ISO 8601
  app:        AppId;
  label:      string | null;
  status:     ScheduleEntryStatus;
  firedAt:    number | null;       // unix timestamp ms
  createdAt:  number;
  modifiedAt: number;
}

// ─── JAM config (config/jam.json) ─────────────────────────────────────────────

export interface JamConfig {
  jam: {
    startAt: string; // ISO 8601 — informational, JAM_START is a manual admin action
    endsAt:  string; // ISO 8601 — used by startJam()
  };
  broadcast: {
    transitionFailsafeMs:   number; // ms — max wait for client ack before forcing transition
    statePersistIntervalMs: number; // ms — interval between state.json writes
    postJamIdleDelayMs:     number; // ms — delay after JAM end before switching to post-jam-idle
  };
  pool: {
    clipQuotaPerParticipant: number; // max clips per participant per JAM
  };
  client: {
    watchdogTimeoutMs: number; // ms — without server ping before broadcast client reloads
  };
}
