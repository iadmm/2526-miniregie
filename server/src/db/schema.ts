import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { MediaContent, MediaType, MediaStatus, MediaEventType, BroadcastEventType, ScheduleEntryStatus } from "@shared/types";

export const participants = sqliteTable('participants', {
  id:           text('id').primaryKey(),       // uuid | 'system:admin'
  username:     text('username').unique(),      // null for phantom system accounts
  passwordHash: text('password_hash'),          // null for phantom system accounts
  displayName:  text('display_name').notNull(),
  team:         text('team').notNull().default(''),
  role:         text('role').notNull().default(''),
  avatarUrl:    text('avatar_url'),
  firstSeenAt:  integer('first_seen_at').notNull(),
  lastSeenAt:   integer('last_seen_at').notNull(),
  banned:       integer('banned', { mode: 'boolean' }).notNull().default(false),
  bannedAt:     integer('banned_at'),
  banReason:    text('ban_reason'),
});

export const mediaItems = sqliteTable('media_items', {
  id:            text('id').primaryKey(),
  type:          text('type').notNull().$type<MediaType>(),
  content:       text('content', { mode: 'json' }).notNull().$type<MediaContent>(),
  status:        text('status').notNull().$type<MediaStatus>(),
  submittedAt:   integer('submitted_at').notNull(),
  authorId:      text('author_id').notNull().references(() => participants.id),
  queuePosition: integer('queue_position'),     // explicit position in queue.main; null = pending or played
});

// Immutable event log — append only, never updated
export const mediaEvents = sqliteTable('media_events', {
  id:        text('id').primaryKey(),
  itemId:    text('item_id').notNull().references(() => mediaItems.id),
  type:      text('type').notNull().$type<MediaEventType>(),
  appId:     text('app_id'),
  payload:   text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at').notNull(),
});

// Black box — append only
export const broadcastEvents = sqliteTable('broadcast_events', {
  id:        text('id').primaryKey(),
  type:      text('type').notNull().$type<BroadcastEventType>(),
  payload:   text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at').notNull(),
});

// Live-editable broadcast schedule — seeded from config/schedule.json, source of truth at runtime
export const scheduleEntries = sqliteTable('schedule_entries', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  at:         text('at').notNull(),                                        // "H+00:10:00" | "T-04:00:00" | ISO 8601
  app:        text('app').notNull(),
  label:      text('label'),
  status:     text('status').notNull().$type<ScheduleEntryStatus>().default('pending'),
  firedAt:    integer('fired_at'),                                         // unix timestamp ms, null until fired
  createdAt:  integer('created_at').notNull().$defaultFn(() => Date.now()),
  modifiedAt: integer('modified_at').notNull().$defaultFn(() => Date.now()),
});
