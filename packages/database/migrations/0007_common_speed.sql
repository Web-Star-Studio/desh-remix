CREATE TABLE IF NOT EXISTS "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"gmail_id" text NOT NULL,
	"thread_id" text,
	"from_name" text DEFAULT '' NOT NULL,
	"from_email" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"snippet" text DEFAULT '' NOT NULL,
	"body_preview" text DEFAULT '' NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"is_unread" boolean DEFAULT true NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"has_attachment" boolean DEFAULT false NOT NULL,
	"label_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"folder" text DEFAULT 'inbox' NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"composio_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emails_workspace_gmail_unique" UNIQUE("workspace_id","gmail_id"),
	CONSTRAINT "emails_folder_check" CHECK ("emails"."folder" in ('inbox','sent','drafts','trash','spam','archive'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gmail_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"gmail_label_id" text NOT NULL,
	"name" text NOT NULL,
	"label_type" text DEFAULT 'user' NOT NULL,
	"color_bg" text,
	"color_text" text,
	"messages_total" integer DEFAULT 0 NOT NULL,
	"messages_unread" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gmail_labels_workspace_connection_label_unique" UNIQUE("workspace_id","connection_id","gmail_label_id"),
	CONSTRAINT "gmail_labels_type_check" CHECK ("gmail_labels"."label_type" in ('user','system'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_snoozes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"gmail_id" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"from_name" text DEFAULT '' NOT NULL,
	"snooze_until" timestamp with time zone NOT NULL,
	"original_labels" text[] DEFAULT '{}'::text[] NOT NULL,
	"restored" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_snoozes_workspace_gmail_unique" UNIQUE("workspace_id","gmail_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gmail_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"folder" text DEFAULT 'inbox' NOT NULL,
	"email_address" text,
	"history_id" bigint,
	"watch_expiration" timestamp with time zone,
	"next_page_token" text,
	"total_synced" integer DEFAULT 0 NOT NULL,
	"sync_completed" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "gmail_sync_state_workspace_connection_folder_unique" UNIQUE("workspace_id","connection_id","folder")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_send_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"user_id" uuid,
	"email_type" text NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_send_log_status_check" CHECK ("email_send_log"."status" in ('sent','failed','skipped'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_task_reminders" boolean DEFAULT true NOT NULL,
	"email_event_reminders" boolean DEFAULT true NOT NULL,
	"email_archive_notice" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_type" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "emails" ADD CONSTRAINT "emails_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "emails" ADD CONSTRAINT "emails_connection_id_composio_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."composio_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gmail_labels" ADD CONSTRAINT "gmail_labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gmail_labels" ADD CONSTRAINT "gmail_labels_connection_id_composio_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."composio_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_snoozes" ADD CONSTRAINT "email_snoozes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_snoozes" ADD CONSTRAINT "email_snoozes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gmail_sync_state" ADD CONSTRAINT "gmail_sync_state_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gmail_sync_state" ADD CONSTRAINT "gmail_sync_state_connection_id_composio_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."composio_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_rate_limits" ADD CONSTRAINT "email_rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emails_workspace_folder_date_idx" ON "emails" USING btree ("workspace_id","folder","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emails_connection_id_idx" ON "emails" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gmail_labels_workspace_id_idx" ON "gmail_labels" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_snoozes_due_idx" ON "email_snoozes" USING btree ("restored","snooze_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gmail_sync_state_expiration_idx" ON "gmail_sync_state" USING btree ("watch_expiration");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gmail_sync_state_email_address_idx" ON "gmail_sync_state" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_send_log_workspace_created_idx" ON "email_send_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_send_log_type_idx" ON "email_send_log" USING btree ("email_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_send_log_status_idx" ON "email_send_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_rate_limits_user_type_sent_idx" ON "email_rate_limits" USING btree ("user_id","email_type","sent_at");