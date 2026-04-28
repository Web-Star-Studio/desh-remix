CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid,
	"label" text NOT NULL,
	"day" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"category" text DEFAULT 'outro' NOT NULL,
	"recurrence" text DEFAULT 'none' NOT NULL,
	"color" text DEFAULT 'bg-muted-foreground' NOT NULL,
	"location" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_category_check" CHECK ("events"."category" in ('trabalho','pessoal','saúde','educação','lazer','outro')),
	CONSTRAINT "events_recurrence_check" CHECK ("events"."recurrence" in ('none','daily','weekly','monthly')),
	CONSTRAINT "events_day_check" CHECK ("events"."day" between 1 and 31),
	CONSTRAINT "events_month_check" CHECK ("events"."month" between 0 and 11),
	CONSTRAINT "events_year_check" CHECK ("events"."year" between 1900 and 2200)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_workspace_idx" ON "events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_workspace_month_idx" ON "events" USING btree ("workspace_id","year","month");