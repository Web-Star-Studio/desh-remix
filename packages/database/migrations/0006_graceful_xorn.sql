ALTER TABLE "contacts" ADD COLUMN "contact_type" text DEFAULT 'person' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "phones" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "emails" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "addresses" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "social_links" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "website" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "company_logo_url" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "company_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "company_industry" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "company_size" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "google_resource_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "google_etag" text;