import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { MediaContent, MediaType, MediaStatus, MediaEventType, BroadcastEventType } from '../../../shared/types.js';

export const participants = sqliteTable('participants', {
  id:            text('id').primaryKey(),           // uuid | 'system:admin' | 'system:narrator'
  oauthId:       text('oauth_id').unique(),         // null for system accounts
  oauthProvider: text('oauth_provider'),
  email:         text('email').unique(),
  displayName:   text('display_name').notNull(),
  team:          text('team').notNull().default(''),
  role:          text('role').notNull().default(''),
  avatarUrl:     text('avatar_url'),
  firstSeenAt:   integer('first_seen_at').notNull(),
  lastSeenAt:    integer('last_seen_at').notNull(),
  banned:        integer('banned', { mode: 'boolean' }).notNull().default(false),
  bannedAt:      integer('banned_at'),
  banReason:     text('ban_reason'),
});

export const mediaItems = sqliteTable('media_items', {
  id:          text('id').primaryKey(),
  type:        text('type').notNull().$type<MediaType>(),
  content:     text('content', { mode: 'json' }).notNull().$type<MediaContent>(),
  priority:    integer('priority').notNull(),
  status:      text('status').notNull().$type<MediaStatus>(),
  pinned:      integer('pinned', { mode: 'boolean' }).notNull().default(false),
  submittedAt: integer('submitted_at').notNull(),
  authorId:    text('author_id').notNull().references(() => participants.id),
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
