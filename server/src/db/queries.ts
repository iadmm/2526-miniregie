import { eq, and, inArray, notInArray, gte, lte, max, count, sql, asc } from 'drizzle-orm';
import { db } from './index.js';
import { mediaItems, mediaEvents, participants, broadcastEvents, scheduleEntries } from './schema.js';
import type { MediaItem, MediaEvent, MediaStatus, MediaType, Participant, BroadcastEvent, ScheduleEntry, ScheduleEntryStatus } from '../../../shared/types.js';

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
};

export interface AllItemsFilters {
  status?:   MediaStatus;
  authorId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToMediaItem(row: {
  id: string; type: string; content: unknown; queuePosition: number | null;
  status: string; submittedAt: number; authorId: string;
  authorDisplayName: string; authorTeam: string; authorRole: string;
}): MediaItem {
  return {
    id:            row.id,
    type:          row.type          as MediaType,
    content:       row.content       as MediaItem['content'],
    queuePosition: row.queuePosition ?? null,
    status:        row.status        as MediaStatus,
    submittedAt:   row.submittedAt,
    author: {
      participantId: row.authorId,
      displayName:   row.authorDisplayName,
      team:          row.authorTeam,
      role:          row.authorRole,
    },
  };
}

function rowToParticipant(row: typeof participants.$inferSelect): Participant {
  return {
    id:          row.id,
    username:    row.username ?? null,
    displayName: row.displayName,
    team:        row.team,
    role:        row.role,
    avatarUrl:   row.avatarUrl ?? null,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt:  row.lastSeenAt,
    banned:      row.banned,
    bannedAt:    row.bannedAt ?? null,
    banReason:   row.banReason ?? null,
  };
}

// ─── media_items ──────────────────────────────────────────────────────────────

export function insertItem(item: MediaItem): void {
  db.insert(mediaItems).values({
    id:            item.id,
    type:          item.type,
    content:       item.content,
    status:        item.status,
    submittedAt:   item.submittedAt,
    authorId:      item.author.participantId,
    queuePosition: item.queuePosition ?? undefined,
  }).run();
}

export function getItemById(id: string): MediaItem | null {
  const row = db.select({
    id:                mediaItems.id,
    type:              mediaItems.type,
    content:           mediaItems.content,
    queuePosition:     mediaItems.queuePosition,
    status:            mediaItems.status,
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

export function updateContent(id: string, content: MediaItem['content']): void {
  db.update(mediaItems).set({ content }).where(eq(mediaItems.id, id)).run();
}

export function updateQueuePosition(id: string, queuePosition: number | null): void {
  db.update(mediaItems).set({ queuePosition: queuePosition ?? undefined }).where(eq(mediaItems.id, id)).run();
}

export function getMaxQueuePosition(): number | null {
  const row = db.select({ value: max(mediaItems.queuePosition) })
    .from(mediaItems)
    .where(eq(mediaItems.status, 'ready'))
    .get();
  return row?.value ?? null;
}

export function batchUpdateQueuePositions(updates: Array<{ id: string; queuePosition: number }>): void {
  db.transaction(tx => {
    for (const { id, queuePosition } of updates) {
      tx.update(mediaItems).set({ queuePosition }).where(eq(mediaItems.id, id)).run();
    }
  });
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
    queuePosition:     mediaItems.queuePosition,
    status:            mediaItems.status,
    submittedAt:       mediaItems.submittedAt,
    authorId:          mediaItems.authorId,
    authorDisplayName: participants.displayName,
    authorTeam:        participants.team,
    authorRole:        participants.role,
    displayedCount: sql<number>`COALESCE(SUM(CASE WHEN ${mediaEvents.type} = 'displayed' THEN 1 ELSE 0 END), 0)`,
    skippedCount:   sql<number>`COALESCE(SUM(CASE WHEN ${mediaEvents.type} = 'skipped'  THEN 1 ELSE 0 END), 0)`,
  })
  .from(mediaItems)
  .innerJoin(participants, eq(mediaItems.authorId, participants.id))
  .leftJoin(mediaEvents, eq(mediaEvents.itemId, mediaItems.id))
  .where(and(...conditions))
  .groupBy(mediaItems.id)
  .orderBy(asc(mediaItems.queuePosition))
  .all();

  return rows.map(row => ({ ...rowToMediaItem(row), displayedCount: row.displayedCount, skippedCount: row.skippedCount }));
}

export type PlayedRow = MediaItem & { playedAt: number };

export function getPlayedItems(): PlayedRow[] {
  const rows = db.select({
    id:                mediaItems.id,
    type:              mediaItems.type,
    content:           mediaItems.content,
    queuePosition:     mediaItems.queuePosition,
    status:            mediaItems.status,
    submittedAt:       mediaItems.submittedAt,
    authorId:          mediaItems.authorId,
    authorDisplayName: participants.displayName,
    authorTeam:        participants.team,
    authorRole:        participants.role,
    playedAt:          sql<number>`MAX(CASE WHEN ${mediaEvents.type} = 'displayed' THEN ${mediaEvents.createdAt} END)`,
  })
  .from(mediaItems)
  .innerJoin(participants, eq(mediaItems.authorId, participants.id))
  .leftJoin(mediaEvents, eq(mediaEvents.itemId, mediaItems.id))
  .where(eq(mediaItems.status, 'played'))
  .groupBy(mediaItems.id)
  .all();

  return rows
    .map(row => ({ ...rowToMediaItem(row), playedAt: row.playedAt ?? row.submittedAt }))
    .sort((a, b) => b.playedAt - a.playedAt);
}

export function getAllItems(filters: AllItemsFilters = {}): MediaItem[] {
  const conditions: ReturnType<typeof eq>[] = [];
  if (filters.status)   conditions.push(eq(mediaItems.status, filters.status));
  if (filters.authorId) conditions.push(eq(mediaItems.authorId, filters.authorId));

  const baseQuery = db.select({
    id:                mediaItems.id,
    type:              mediaItems.type,
    content:           mediaItems.content,
    queuePosition:     mediaItems.queuePosition,
    status:            mediaItems.status,
    submittedAt:       mediaItems.submittedAt,
    authorId:          mediaItems.authorId,
    authorDisplayName: participants.displayName,
    authorTeam:        participants.team,
    authorRole:        participants.role,
  })
  .from(mediaItems)
  .innerJoin(participants, eq(mediaItems.authorId, participants.id));

  const rows = conditions.length > 0
    ? baseQuery.where(and(...conditions)).all()
    : baseQuery.all();

  return rows.map(rowToMediaItem);
}

export function deleteItem(id: string): void {
  db.delete(mediaEvents).where(eq(mediaEvents.itemId, id)).run();
  db.delete(mediaItems).where(eq(mediaItems.id, id)).run();
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

export function getParticipantById(id: string): Participant | null {
  const row = db.select().from(participants).where(eq(participants.id, id)).get();
  return row ? rowToParticipant(row) : null;
}

export function getParticipantByUsername(username: string): Participant | null {
  const row = db.select().from(participants).where(eq(participants.username, username)).get();
  return row ? rowToParticipant(row) : null;
}

/**
 * Returns the raw password hash for a participant by ID.
 * Used only by the auth route — not exposed on the Participant interface.
 */
export function getPasswordHash(participantId: string): string | null {
  const row = db.select({ passwordHash: participants.passwordHash })
    .from(participants)
    .where(eq(participants.id, participantId))
    .get();
  return row?.passwordHash ?? null;
}

export function createParticipant(data: {
  username:     string;
  passwordHash: string;
  displayName:  string;
  team:         string;
}): Participant {
  const now = Date.now();
  const row = db.insert(participants)
    .values({
      id:           crypto.randomUUID(),
      username:     data.username,
      passwordHash: data.passwordHash,
      displayName:  data.displayName,
      team:         data.team,
      role:         'participant',
      firstSeenAt:  now,
      lastSeenAt:   now,
    })
    .returning()
    .get();
  return rowToParticipant(row);
}

export function setAvatarUrl(id: string, avatarUrl: string): void {
  db.update(participants).set({ avatarUrl }).where(eq(participants.id, id)).run();
}

export function getTeams(): string[] {
  const rows = db
    .selectDistinct({ team: participants.team })
    .from(participants)
    .all();
  return rows
    .map(r => r.team)
    .filter((t): t is string => typeof t === 'string' && t.length > 0);
}

export function setParticipantLastSeen(id: string, at: number): void {
  db.update(participants).set({ lastSeenAt: at }).where(eq(participants.id, id)).run();
}

export function setBanned(id: string, banned: boolean, bannedAt: number | null, banReason: string | null): void {
  db.update(participants).set({ banned, bannedAt, banReason }).where(eq(participants.id, id)).run();
}

export function setParticipantRole(id: string, role: string): void {
  db.update(participants).set({ role }).where(eq(participants.id, id)).run();
}

export function searchParticipants(query?: string): Participant[] {
  const rows = query
    ? db.select().from(participants)
        .where(sql`${participants.displayName} LIKE ${'%' + query + '%'} OR ${participants.team} LIKE ${'%' + query + '%'}`)
        .all()
    : db.select().from(participants).all();
  return rows.map(rowToParticipant);
}

// ─── reset ────────────────────────────────────────────────────────────────────

/**
 * Deletes all media data and dev-seed participants for a full JAM reset.
 * Real participants and broadcast_events are preserved.
 */
export function resetAllMedia(): void {
  db.delete(mediaEvents).run();
  db.delete(mediaItems).run();
  db.delete(participants).where(eq(participants.role, 'seed:dev')).run();
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

// ─── schedule_entries ─────────────────────────────────────────────────────────

function rowToScheduleEntry(row: typeof scheduleEntries.$inferSelect): ScheduleEntry {
  return {
    id:         row.id,
    at:         row.at,
    app:        row.app,
    label:      row.label ?? null,
    status:     row.status as ScheduleEntryStatus,
    firedAt:    row.firedAt ?? null,
    createdAt:  row.createdAt,
    modifiedAt: row.modifiedAt,
  };
}

export function getScheduleEntries(): ScheduleEntry[] {
  return db.select().from(scheduleEntries).orderBy(asc(scheduleEntries.id)).all().map(rowToScheduleEntry);
}

export function insertScheduleEntry(at: string, app: string, label?: string): ScheduleEntry {
  const now = Date.now();
  const row = db.insert(scheduleEntries)
    .values({ at, app, label: label ?? null, createdAt: now, modifiedAt: now })
    .returning()
    .get();
  return rowToScheduleEntry(row);
}

export function updateScheduleEntry(
  id: number,
  patch: Partial<{ at: string; app: string; label: string | null; status: ScheduleEntryStatus }>,
): void {
  db.update(scheduleEntries)
    .set({ ...patch, modifiedAt: Date.now() })
    .where(eq(scheduleEntries.id, id))
    .run();
}

export function deleteScheduleEntry(id: number): void {
  db.delete(scheduleEntries).where(eq(scheduleEntries.id, id)).run();
}

export function markScheduleEntryFired(id: number, firedAt: number): void {
  db.update(scheduleEntries)
    .set({ status: 'fired', firedAt, modifiedAt: Date.now() })
    .where(eq(scheduleEntries.id, id))
    .run();
}

/**
 * Resets all schedule entries to pending — used on JAM reset so triggers can fire again.
 */
export function resetScheduleStatus(): void {
  db.update(scheduleEntries)
    .set({ status: 'pending', firedAt: null, modifiedAt: Date.now() })
    .run();
}
