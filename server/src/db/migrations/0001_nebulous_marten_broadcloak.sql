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
