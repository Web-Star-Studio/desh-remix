CREATE TABLE IF NOT EXISTS "profile_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"doc_type" text DEFAULT 'other' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_documents_doc_type_check" CHECK ("profile_documents"."doc_type" in ('rg','cpf','passport','cnh','proof_of_address','other'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_documents" ADD CONSTRAINT "profile_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_documents" ADD CONSTRAINT "profile_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_documents" ADD CONSTRAINT "profile_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_documents_user_id_idx" ON "profile_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_documents_workspace_id_idx" ON "profile_documents" USING btree ("workspace_id");