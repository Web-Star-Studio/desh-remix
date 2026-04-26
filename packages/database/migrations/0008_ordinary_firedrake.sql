CREATE TABLE IF NOT EXISTS "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'transactional' NOT NULL,
	"subject_template" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_slug_unique" UNIQUE("slug"),
	CONSTRAINT "email_templates_type_check" CHECK ("email_templates"."type" in ('transactional','report','marketing','lifecycle'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"template_slug" text NOT NULL,
	"target_audience" text DEFAULT 'all' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_automations_trigger_check" CHECK ("email_automations"."trigger_type" in ('cron','threshold','manual')),
	CONSTRAINT "email_automations_audience_check" CHECK ("email_automations"."target_audience" in ('all','active','inactive','admins'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unsubscribe_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"user_id" uuid NOT NULL,
	"sender_name" text DEFAULT '' NOT NULL,
	"sender_email" text NOT NULL,
	"category" text DEFAULT 'outro' NOT NULL,
	"safety_score" integer DEFAULT 50 NOT NULL,
	"method" text NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"trashed" boolean DEFAULT false NOT NULL,
	"emails_affected" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unsubscribe_history_method_check" CHECK ("unsubscribe_history"."method" in ('GET','POST','mailto','trash_only'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_automations" ADD CONSTRAINT "email_automations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unsubscribe_history" ADD CONSTRAINT "unsubscribe_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unsubscribe_history" ADD CONSTRAINT "unsubscribe_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_templates_active_idx" ON "email_templates" USING btree ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_automations_active_idx" ON "email_automations" USING btree ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unsubscribe_history_user_created_idx" ON "unsubscribe_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unsubscribe_history_workspace_idx" ON "unsubscribe_history" USING btree ("workspace_id");