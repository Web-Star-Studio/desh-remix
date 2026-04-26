ALTER TABLE "users" ADD COLUMN "cognito_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "icon" text DEFAULT '🏠' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "color" text DEFAULT 'hsl(220, 80%, 50%)' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_cognito_sub_unique" UNIQUE("cognito_sub");