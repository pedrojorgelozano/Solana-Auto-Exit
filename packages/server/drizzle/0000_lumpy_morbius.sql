CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`timestamp` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`event` text NOT NULL,
	`data` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`protocol` text NOT NULL,
	`network` text NOT NULL,
	`rpc_url` text NOT NULL,
	`position_id` text NOT NULL,
	`protocol_config` text NOT NULL,
	`take_profit_price` real,
	`stop_loss_price` real,
	`triggered_by` text,
	`slippage_bps` integer NOT NULL,
	`poll_ms` integer NOT NULL,
	`dry_run` integer NOT NULL,
	`exit_token_mint` text,
	`exit_swap_slippage_bps` integer NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`triggered_at` integer,
	`close_result` text,
	`swap_result` text,
	`last_error` text
);
