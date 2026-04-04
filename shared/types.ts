// ─── Media ───────────────────────────────────────────────────────────────────

export type MediaType = 'photo' | 'gif' | 'giphy' | 'note' | 'clip' | 'link' | 'youtube' | 'interview' | 'ticker';
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
  | GiphyContent
  | NoteContent
  | ClipContent
  | LinkContent
  | YoutubeContent
  | InterviewContent
  | TickerContent;

export interface PhotoContent   { url: string; aspectRatio: number | null; caption: string | null }
export interface GifContent     { url: string; aspectRatio: number | null; caption: string | null }
export interface GiphyContent   {
  giphyId:     string;
  url:         string;    // direct .gif URL (media.giphy.com)
  mp4Url:      string;    // .mp4 version — prefer for <video> elements
  title:       string | null;
  aspectRatio: number | null;
  caption:     string | null;
}
export interface NoteContent    { text: string }
export interface ClipContent    { url: string; duration: number; mimeType: string; aspectRatio: number | null; caption: string | null }
export interface LinkContent    { url: string; title: string | null; description: string | null; thumbnail: string | null; siteName: string | null; caption: string | null }
export interface YoutubeContent { url: string; youtubeId: string; title: string; duration: number; thumbnail: string; aspectRatio: number | null; caption: string | null }
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

export const KNOWN_APPS = [
  'pre-jam-idle',
  'countdown-to-jam',
  'start-jam',
  'jam-mode',
  'countdown-to-end',
  'micro-trottoir',
  'end-of-countdown',
  'post-jam-idle',
] as const satisfies AppId[];

export interface GlobalState {
  jam: {
    status: JamStatus;
    startedAt: number | null;
    endsAt: number | null;
    timeRemaining: number | null;
  };
  broadcast: {
    activeApp:      AppId;
    transition:     'idle' | 'in_progress';
    panicState:     boolean;
    panicMessage:   string;        // message shown on TV panic overlay
    nextTriggerAt:  number | null; // absolute ms of next unfired schedule trigger
    activeItemIds:  string[];      // IDs of items currently displayed by jam-mode (0-3)
    regime:         'normal' | 'hold' | 'buffer'; // jam-mode fetch pipeline state
    activeLayout:   string | null; // current jam-mode layout (server-computed)
    nextPrediction: { layout: string; itemIds: string[] } | null; // next scene prediction
  };
  pool: {
    total:         number;
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

// ─── Scene ────────────────────────────────────────────────────────────────────

export type LayoutName =
  // ── Aspect-neutral (original) ──────────────────────────────────────────────
  | 'IDLE'
  | 'NOTE_CARD'
  | 'VISUAL_FULL'
  | 'VISUAL_WITH_CAPTION'
  | 'DUAL_VISUAL'
  | 'MEDIA_FULL'
  | 'MEDIA_WITH_CAPTION'
  | 'MEDIA_WITH_VISUAL'
  // ── Portrait visual (AR < 0.8) ─────────────────────────────────────────────
  | 'PORTRAIT_FULL'           // single portrait visual, pillarboxed
  | 'PORTRAIT_DUO'            // two portrait visuals side by side
  | 'PORTRAIT_WITH_NOTE'      // portrait visual left + note right
  // ── Vertical media (AR < 0.8 loud) ────────────────────────────────────────
  | 'VERTICAL_MEDIA'          // vertical clip/video centered
  | 'VERTICAL_MEDIA_WITH_NOTE'// vertical clip/video + note alongside
  // ── Wide / panoramic visual (AR > 1.8) ────────────────────────────────────
  | 'WIDE_VISUAL'             // ultra-wide visual full width
  | 'WIDE_VISUAL_WITH_NOTE'   // ultra-wide visual + note below
  // ── Special ───────────────────────────────────────────────────────────────
  | 'QR_CARD';                // periodic QR reminder (timer-forced, never auto-selected)

export interface LoudSlot {
  kind: 'loud';
  item: MediaItem;
  startedAt: number;
  maxEndsAt: number; // startedAt + min(duration, 10 min)
}

export interface FillerSlot {
  kind: 'filler';
}

export interface SilentSlot {
  item: MediaItem;
  startedAt: number;
  endsAt: number;
}

export interface ActiveScene {
  loud: LoudSlot | FillerSlot | null;
  silents: SilentSlot[]; // max 2
  layout: LayoutName;
}

// ─── JAM config (config/jam.json) ─────────────────────────────────────────────

export interface JamConfig {
  jam: Record<string, never>; // JAM timing is managed entirely via the schedule
  broadcast: {
    transitionFailsafeMs:   number; // ms — max wait for client ack before forcing transition
    statePersistIntervalMs: number; // ms — interval between state.json writes
    postJamIdleDelayMs:     number; // ms — delay after JAM end before switching to post-jam-idle
  };
  pool: {
    clipQuotaPerParticipant: number; // max clips per participant per JAM
  };
  jamMode: {
    photoDurationMs:     number; // ms — display duration for photo and gif slots
    noteDurationMs:      number; // ms — display duration for note slots
    liveStreamMaxMs:     number; // ms — fallback duration for YouTube live streams (duration = 0)
    enrichCheckMs:       number; // ms — when loud plays alone, poll for companions at this interval
    qrIntervalMs:        number; // ms — interval between QR_CARD displays
    qrHoldMs:            number; // ms — how long QR_CARD stays visible
  };
  client: {
    watchdogTimeoutMs: number; // ms — without server ping before broadcast client reloads
  };
}
