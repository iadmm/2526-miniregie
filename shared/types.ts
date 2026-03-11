// ─── Media ───────────────────────────────────────────────────────────────────

export type MediaType = 'photo' | 'gif' | 'note' | 'clip' | 'link' | 'youtube' | 'interview' | 'ticker';
export type MediaStatus = 'pending' | 'ready' | 'evicted';
export type MediaEventType = 'displayed' | 'skipped' | 'held' | 'pinned' | 'evicted' | 'enriched';

export interface MediaItem {
  id: string;
  type: MediaType;
  content: MediaContent;
  priority: number;
  status: MediaStatus;
  pinned: boolean;
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
  participantId: string; // 'system:admin' | 'system:narrator' | uuid
  displayName: string;
  team: string;
  role: string;
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
  oauthId: string;
  oauthProvider: 'google';
  email: string;
  displayName: string;
  team: string;
  role: string;
  avatarUrl: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  banned: boolean;
  bannedAt: number | null;
  bannedBy: string | null;
  banReason: string | null;
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
    activeApp: AppId;
    transition: 'idle' | 'in_progress';
    panicState: boolean;
  };
  pool: {
    total: number;
    fresh: number;
    queueSnapshot: MediaItem[];
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
