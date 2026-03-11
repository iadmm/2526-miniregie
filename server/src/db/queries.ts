import { eq, and, inArray, notInArray, gte, lte, max, count, sql } from 'drizzle-orm';
import { db } from './index.js';
import { mediaItems, mediaEvents, participants, broadcastEvents } from './schema.js';
import type { MediaItem, MediaEvent, MediaStatus, MediaType, Participant, BroadcastEvent } from '../../../shared/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReadyItemFilters {
  types?:           MediaType[];
  excludeTypes?:    MediaType[];
  submittedAfter?:  number;
  submittedBefore?: number;
}

export type ScoredRow = MediaItem & {
  displayedCount: number;
  skippedCount:   number;
  lastActivityAt: number | null; // used for 5min cooldown
};

interface OAuthData {
  oauthId:       string;
  oauthProvider: 'google';
  email:         string;
  displayName:   string;
  avatarUrl:     string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToMediaItem(row: {
  id: string; type: string; content: unknown; priority: number;
  status: string; pinned: boolean; submittedAt: number; authorId: string;
  authorDisplayName: string; authorTeam: string; authorRole: string;
}): MediaItem {
  return {
    id:          row.id,
    type:        row.type        as MediaType,
    content:     row.content     as MediaItem['content'],
    priority:    row.priority,
    status:      row.status      as MediaStatus,
    pinned:      row.pinned,
    submittedAt: row.submittedAt,
    author: {
      participantId: row.authorId,
      displayName:   row.authorDisplayName,
      team:          row.authorTeam,
      role:          row.authorRole,
    },
  };
}

// ─── media_items ──────────────────────────────────────────────────────────────

export function insertItem(item: MediaItem): void {
  db.insert(mediaItems).values({
    id:          item.id,
    type:        item.type,
    content:     item.content,
    priority:    item.priority,
    status:      item.status,
    pinned:      item.pinned,
    submittedAt: item.submittedAt,
    authorId:    item.author.participantId,
  }).run();
}

export function getItemById(id: string): MediaItem | null {
  const row = db.select({
    id:                mediaItems.id,
    type:              mediaItems.type,
    content:           mediaItems.content,
    priority:          mediaItems.priority,
    status:            mediaItems.status,
    pinned:            mediaItems.pinned,
    submittedAt:       mediaItems.submittedAt,
    authorId:          mediaItems.authorId,
    authorDisplayName: participants.displayName,
    authorTeam:        participants.team,
    authorRole:        participants.role,
  })
  .from(mediaItems)
  .innerJoin(participants, eq(mediaItems.authorId, participants.id))
  .where(eq(mediaItems.id, id))
  .get();

  return row ? rowToMediaItem(row) : null;
}

export function updateStatus(id: string, status: MediaStatus): void {
  db.update(mediaItems).set({ status }).where(eq(mediaItems.id, id)).run();
}

export function updatePriority(id: string, priority: number): void {
  db.update(mediaItems).set({ priority }).where(eq(mediaItems.id, id)).run();
}

export function updatePinned(id: string, pinned: boolean): void {
  db.update(mediaItems).set({ pinned }).where(eq(mediaItems.id, id)).run();
}

export function clearAllPinned(): void {
  db.update(mediaItems).set({ pinned: false }).where(eq(mediaItems.pinned, true)).run();
}

export function getReadyItems(filters: ReadyItemFilters = {}): ScoredRow[] {
  const conditions = [eq(mediaItems.status, 'ready')];

  if (filters.types)           conditions.push(inArray(mediaItems.type, filters.types));
  if (filters.excludeTypes)    conditions.push(notInArray(mediaItems.type, filters.excludeTypes));
  if (filters.submittedAfter)  conditions.push(gte(mediaItems.submittedAt, filters.submittedAfter));
  if (filters.submittedBefore) conditions.push(lte(mediaItems.submittedAt, filters.submittedBefore));

  const rows = db.select({
    id:                mediaItems.id,
    type:              mediaItems.type,
    content:           mediaItems.content,
    priority:          mediaItems.priority,
    status:            mediaItems.status,
    pinned:            mediaItems.pinned,
    submittedAt:       mediaItems.submittedAt,
    authorId:          mediaItems.authorId,
    authorDisplayName: participants.displayName,
    authorTeam:        participants.team,
    authorRole:        participants.role,
    displayedCount: sql<number>`COALESCE(SUM(CASE WHEN ${mediaEvents.type} = 'displayed' THEN 1 ELSE 0 END), 0)`,
    skippedCount:   sql<number>`COALESCE(SUM(CASE WHEN ${mediaEvents.type} = 'skipped'  THEN 1 ELSE 0 END), 0)`,
    lastActivityAt: sql<number | null>`MAX(CASE WHEN ${mediaEvents.type} IN ('displayed', 'skipped') THEN ${mediaEvents.createdAt} END)`,
  })
  .from(mediaItems)
  .innerJoin(participants, eq(mediaItems.authorId, participants.id))
  .leftJoin(mediaEvents, eq(mediaEvents.itemId, mediaItems.id))
  .where(and(...conditions))
  .groupBy(mediaItems.id)
  .all();

  return rows.map(row => ({ ...rowToMediaItem(row), displayedCount: row.displayedCount, skippedCount: row.skippedCount, lastActivityAt: row.lastActivityAt }));
}

export function getLastSubmissionAt(participantId: string): number | null {
  const row = db.select({ value: max(mediaItems.submittedAt) })
    .from(mediaItems)
    .where(eq(mediaItems.authorId, participantId))
    .get();
  return row?.value ?? null;
}

export function getClipCount(participantId: string): number {
  const row = db.select({ value: count() })
    .from(mediaItems)
    .where(and(
      eq(mediaItems.authorId, participantId),
      eq(mediaItems.type, 'clip'),
      notInArray(mediaItems.status, ['evicted']),
    ))
    .get();
  return row?.value ?? 0;
}

// ─── media_events ─────────────────────────────────────────────────────────────

export function insertEvent(event: MediaEvent): void {
  db.insert(mediaEvents).values({
    id:        event.id,
    itemId:    event.itemId,
    type:      event.type,
    appId:     event.appId,
    payload:   event.payload ?? undefined,
    createdAt: event.createdAt,
  }).run();
}

// ─── participants ─────────────────────────────────────────────────────────────

function rowToParticipant(row: typeof participants.$inferSelect): Participant {
  return {
    id:            row.id,
    oauthId:       row.oauthId!,
    oauthProvider: row.oauthProvider as 'google',
    email:         row.email!,
    displayName:   row.displayName,
    team:          row.team,
    role:          row.role,
    avatarUrl:     row.avatarUrl ?? null,
    firstSeenAt:   row.firstSeenAt,
    lastSeenAt:    row.lastSeenAt,
    banned:        row.banned,
    bannedAt:      row.bannedAt ?? null,
    banReason:     row.banReason ?? null,
  };
}

export function getParticipantById(id: string): Participant | null {
  const row = db.select().from(participants).where(eq(participants.id, id)).get();
  return row ? rowToParticipant(row) : null;
}

export function getParticipantByOauthId(oauthId: string, provider: string): Participant | null {
  const row = db.select().from(participants)
    .where(and(eq(participants.oauthId, oauthId), eq(participants.oauthProvider, provider)))
    .get();
  return row ? rowToParticipant(row) : null;
}

export function upsertParticipant(data: OAuthData): Participant {
  const now = Date.now();
  const row = db.insert(participants)
    .values({
      id:            crypto.randomUUID(),
      oauthId:       data.oauthId,
      oauthProvider: data.oauthProvider,
      email:         data.email,
      displayName:   data.displayName,
      avatarUrl:     data.avatarUrl,
      firstSeenAt:   now,
      lastSeenAt:    now,
    })
    .onConflictDoUpdate({
      target: participants.oauthId,
      set:    { displayName: data.displayName, avatarUrl: data.avatarUrl, lastSeenAt: now },
    })
    .returning()
    .get();
  return rowToParticipant(row);
}

export function setParticipantLastSeen(id: string, at: number): void {
  db.update(participants).set({ lastSeenAt: at }).where(eq(participants.id, id)).run();
}

export function setBanned(id: string, banned: boolean, bannedAt: number | null, banReason: string | null): void {
  db.update(participants).set({ banned, bannedAt, banReason }).where(eq(participants.id, id)).run();
}

export function searchParticipants(query?: string): Participant[] {
  const rows = query
    ? db.select().from(participants)
        .where(sql`${participants.displayName} LIKE ${'%' + query + '%'} OR ${participants.team} LIKE ${'%' + query + '%'}`)
        .all()
    : db.select().from(participants).all();
  return rows.map(rowToParticipant);
}

// ─── broadcast_events ─────────────────────────────────────────────────────────

export function insertBroadcastEvent(event: BroadcastEvent): void {
  db.insert(broadcastEvents).values({
    id:        event.id,
    type:      event.type,
    payload:   event.payload ?? undefined,
    createdAt: event.createdAt,
  }).run();
}
