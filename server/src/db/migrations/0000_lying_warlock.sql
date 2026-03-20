CREATE TABLE `broadcast_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_events` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`type` text NOT NULL,
	`app_id` text,
	`payload` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`priority` integer NOT NULL,
	`status` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`author_id` text NOT NULL,
	`queue_position` integer,
	FOREIGN KEY (`author_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text,
	`password_hash` text,
	`display_name` text NOT NULL,
	`team` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`banned` integer DEFAULT false NOT NULL,
	`banned_at` integer,
	`ban_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_username_unique` ON `participants` (`username`);--> statement-breakpoint
CREATE TABLE `schedule_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`app` text NOT NULL,
	`label` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`fired_at` integer,
	`created_at` integer NOT NULL,
	`modified_at` integer NOT NULL
);
