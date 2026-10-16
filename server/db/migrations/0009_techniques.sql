CREATE TYPE "public"."technique_category" AS ENUM('takedown', 'guard', 'pass', 'sweep', 'control', 'submission', 'escape');--> statement-breakpoint
CREATE TYPE "public"."technique_position" AS ENUM('standing', 'closed_guard', 'open_guard', 'half_guard', 'side_control', 'mount', 'knee_on_belly', 'back', 'turtle', 'leg_entanglement');--> statement-breakpoint
CREATE TABLE "technique_links" (
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	CONSTRAINT "technique_links_from_id_to_id_pk" PRIMARY KEY("from_id","to_id")
);
--> statement-breakpoint
CREATE TABLE "techniques" (
	"id" text PRIMARY KEY NOT NULL,
	"academy_id" text NOT NULL,
	"author_id" text,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"category" "technique_category" NOT NULL,
	"position" "technique_position",
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "technique_links" ADD CONSTRAINT "technique_links_from_id_techniques_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."techniques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technique_links" ADD CONSTRAINT "technique_links_to_id_techniques_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."techniques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "techniques" ADD CONSTRAINT "techniques_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "techniques" ADD CONSTRAINT "techniques_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "technique_links_to_idx" ON "technique_links" USING btree ("to_id");--> statement-breakpoint
CREATE UNIQUE INDEX "techniques_academy_name_idx" ON "techniques" USING btree ("academy_id",lower("name"));