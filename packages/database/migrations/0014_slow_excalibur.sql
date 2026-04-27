CREATE TABLE IF NOT EXISTS "finance_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"target" numeric(15, 2) DEFAULT '0' NOT NULL,
	"current" numeric(15, 2) DEFAULT '0' NOT NULL,
	"color" text DEFAULT 'hsl(220, 60%, 55%)' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"type" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"date" date NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"account_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_transactions_workspace_external_unique" UNIQUE("workspace_id","source","external_id"),
	CONSTRAINT "finance_transactions_type_check" CHECK ("finance_transactions"."type" in ('income','expense'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_recurring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"type" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"day_of_month" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_recurring_type_check" CHECK ("finance_recurring"."type" in ('income','expense')),
	CONSTRAINT "finance_recurring_day_of_month_check" CHECK ("finance_recurring"."day_of_month" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"category" text NOT NULL,
	"monthly_limit" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_budgets_workspace_category_unique" UNIQUE("workspace_id","category")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_goals" ADD CONSTRAINT "finance_goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_goals" ADD CONSTRAINT "finance_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_recurring" ADD CONSTRAINT "finance_recurring_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_recurring" ADD CONSTRAINT "finance_recurring_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_transactions_workspace_date_idx" ON "finance_transactions" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_transactions_workspace_category_idx" ON "finance_transactions" USING btree ("workspace_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_recurring_workspace_active_idx" ON "finance_recurring" USING btree ("workspace_id","active");