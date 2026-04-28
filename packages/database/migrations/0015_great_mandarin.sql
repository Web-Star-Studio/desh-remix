CREATE TABLE IF NOT EXISTS "financial_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"provider" text DEFAULT 'pluggy' NOT NULL,
	"provider_connection_id" text NOT NULL,
	"institution_name" text,
	"institution_logo_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"raw_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_connections_ws_provider_conn_unique" UNIQUE("workspace_id","provider","provider_connection_id"),
	CONSTRAINT "financial_connections_provider_check" CHECK ("financial_connections"."provider" in ('pluggy','belvo')),
	CONSTRAINT "financial_connections_status_check" CHECK ("financial_connections"."status" in ('active','syncing','error','expired','awaiting_input','credentials_error'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"connection_id" uuid NOT NULL,
	"provider_account_id" text NOT NULL,
	"name" text,
	"type" text DEFAULT 'checking' NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"current_balance" numeric(15, 2),
	"available_balance" numeric(15, 2),
	"credit_limit" numeric(15, 2),
	"institution_name" text,
	"last_synced_at" timestamp with time zone,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_accounts_ws_provider_unique" UNIQUE("workspace_id","provider_account_id"),
	CONSTRAINT "financial_accounts_type_check" CHECK ("financial_accounts"."type" in ('checking','savings','credit_card','investment','loan','other'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_transactions_unified" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"amount" numeric(15, 2) NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"subcategory" text,
	"merchant_name" text,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_transactions_unified_ws_provider_unique" UNIQUE("workspace_id","provider_transaction_id"),
	CONSTRAINT "financial_transactions_unified_type_check" CHECK ("financial_transactions_unified"."type" in ('inflow','outflow')),
	CONSTRAINT "financial_transactions_unified_status_check" CHECK ("financial_transactions_unified"."status" in ('pending','posted'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"connection_id" uuid NOT NULL,
	"provider_investment_id" text NOT NULL,
	"name" text,
	"type" text DEFAULT 'other' NOT NULL,
	"ticker" text,
	"quantity" numeric(20, 6),
	"current_value" numeric(15, 2),
	"cost_basis" numeric(15, 2),
	"currency" text DEFAULT 'BRL' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_investments_ws_provider_unique" UNIQUE("workspace_id","provider_investment_id"),
	CONSTRAINT "financial_investments_type_check" CHECK ("financial_investments"."type" in ('stock','fund','fixed_income','crypto','other'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"connection_id" uuid NOT NULL,
	"provider_loan_id" text NOT NULL,
	"contract_number" text,
	"product_name" text,
	"loan_type" text,
	"contract_date" date,
	"contract_amount" numeric(15, 2),
	"outstanding_balance" numeric(15, 2),
	"currency" text DEFAULT 'BRL' NOT NULL,
	"due_date" date,
	"cet" numeric(10, 6),
	"installment_periodicity" text,
	"total_installments" integer,
	"paid_installments" integer,
	"due_installments" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_loans_ws_provider_unique" UNIQUE("workspace_id","provider_loan_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"connection_id" uuid NOT NULL,
	"provider" text DEFAULT 'pluggy' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"accounts_synced" integer DEFAULT 0 NOT NULL,
	"transactions_synced" integer DEFAULT 0 NOT NULL,
	"investments_synced" integer DEFAULT 0 NOT NULL,
	"loans_synced" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_sync_logs_status_check" CHECK ("financial_sync_logs"."status" in ('running','success','error'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_connections" ADD CONSTRAINT "financial_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_connections" ADD CONSTRAINT "financial_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_connection_id_financial_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."financial_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_transactions_unified" ADD CONSTRAINT "financial_transactions_unified_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_transactions_unified" ADD CONSTRAINT "financial_transactions_unified_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_investments" ADD CONSTRAINT "financial_investments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_investments" ADD CONSTRAINT "financial_investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_investments" ADD CONSTRAINT "financial_investments_connection_id_financial_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."financial_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_loans" ADD CONSTRAINT "financial_loans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_loans" ADD CONSTRAINT "financial_loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_loans" ADD CONSTRAINT "financial_loans_connection_id_financial_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."financial_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_sync_logs" ADD CONSTRAINT "financial_sync_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_sync_logs" ADD CONSTRAINT "financial_sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_sync_logs" ADD CONSTRAINT "financial_sync_logs_connection_id_financial_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."financial_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_connections_workspace_idx" ON "financial_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_accounts_workspace_idx" ON "financial_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_accounts_connection_idx" ON "financial_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_transactions_unified_ws_date_idx" ON "financial_transactions_unified" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_transactions_unified_account_idx" ON "financial_transactions_unified" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_investments_workspace_idx" ON "financial_investments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_loans_workspace_idx" ON "financial_loans" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_sync_logs_ws_created_idx" ON "financial_sync_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_sync_logs_conn_created_idx" ON "financial_sync_logs" USING btree ("connection_id","created_at");