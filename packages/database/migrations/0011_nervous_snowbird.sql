CREATE TABLE IF NOT EXISTS "social_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"zernio_profile_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_profiles_workspace_profile_unique" UNIQUE("workspace_id","zernio_profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"social_profile_id" uuid,
	"zernio_account_id" text NOT NULL,
	"platform" text NOT NULL,
	"username" text,
	"avatar_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_workspace_account_unique" UNIQUE("workspace_id","zernio_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_send_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"account_id" text NOT NULL,
	"contact_id" uuid,
	"to_phone" text NOT NULL,
	"message_type" text NOT NULL,
	"template_name" text,
	"template_language" text,
	"message_preview" text,
	"status" text NOT NULL,
	"zernio_message_id" text,
	"delivery_status" text,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"webhook_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_send_logs_message_type_check" CHECK ("whatsapp_send_logs"."message_type" in ('text','template')),
	CONSTRAINT "whatsapp_send_logs_status_check" CHECK ("whatsapp_send_logs"."status" in ('success','failed')),
	CONSTRAINT "whatsapp_send_logs_delivery_status_check" CHECK ("whatsapp_send_logs"."delivery_status" is null or "whatsapp_send_logs"."delivery_status" in ('sent','delivered','read','failed'))
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "zernio_profile_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_social_profile_id_social_profiles_id_fk" FOREIGN KEY ("social_profile_id") REFERENCES "public"."social_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_send_logs" ADD CONSTRAINT "whatsapp_send_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_send_logs" ADD CONSTRAINT "whatsapp_send_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_send_logs_workspace_created_idx" ON "whatsapp_send_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_send_logs_zernio_message_idx" ON "whatsapp_send_logs" USING btree ("zernio_message_id");