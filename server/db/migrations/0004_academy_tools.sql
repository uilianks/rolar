CREATE TYPE "public"."event_kind" AS ENUM('competition', 'seminar', 'graduation', 'open_mat', 'social', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'mbway', 'transfer', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."competition_result" AS ENUM('gold', 'silver', 'bronze', 'participated');--> statement-breakpoint
CREATE TABLE "academy_events" (
	"id" text PRIMARY KEY NOT NULL,
	"academy_id" text NOT NULL,
	"kind" "event_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" text,
	"url" text,
	"signup_until" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"academy_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"class_id" text NOT NULL,
	"date" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkins_class_id_date_user_id_pk" PRIMARY KEY("class_id","date","user_id")
);
--> statement-breakpoint
CREATE TABLE "class_occurrences" (
	"class_id" text NOT NULL,
	"date" text NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"note" text,
	"topic" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_occurrences_class_id_date_pk" PRIMARY KEY("class_id","date")
);
--> statement-breakpoint
CREATE TABLE "event_attendees" (
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"category" text,
	"result" "competition_result",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_attendees_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"academy_id" text NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"period_months" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"academy_id" text NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_on" text NOT NULL,
	"covers_from" text NOT NULL,
	"months" integer DEFAULT 1 NOT NULL,
	"note" text,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "billing_due_day" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "academy_members" ADD COLUMN "plan_id" text;--> statement-breakpoint
ALTER TABLE "academy_events" ADD CONSTRAINT "academy_events_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_events" ADD CONSTRAINT "academy_events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_class_id_academy_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."academy_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_occurrences" ADD CONSTRAINT "class_occurrences_class_id_academy_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."academy_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_occurrences" ADD CONSTRAINT "class_occurrences_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_academy_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."academy_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academy_events_academy_idx" ON "academy_events" USING btree ("academy_id","starts_at");--> statement-breakpoint
CREATE INDEX "announcements_academy_idx" ON "announcements" USING btree ("academy_id","created_at");--> statement-breakpoint
CREATE INDEX "checkins_user_idx" ON "checkins" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "event_attendees_user_idx" ON "event_attendees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "membership_plans_academy_idx" ON "membership_plans" USING btree ("academy_id");--> statement-breakpoint
CREATE INDEX "payments_academy_user_idx" ON "payments" USING btree ("academy_id","user_id","covers_from");--> statement-breakpoint
ALTER TABLE "academy_members" ADD CONSTRAINT "academy_members_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE set null ON UPDATE no action;