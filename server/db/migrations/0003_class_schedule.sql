CREATE TABLE "academy_classes" (
	"id" text PRIMARY KEY NOT NULL,
	"academy_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"duration_min" integer NOT NULL,
	"title" text NOT NULL,
	"kind" "session_kind" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"class_id" text NOT NULL,
	"date" text NOT NULL,
	"user_id" text NOT NULL,
	"marked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_class_id_date_user_id_pk" PRIMARY KEY("class_id","date","user_id")
);
--> statement-breakpoint
ALTER TABLE "academy_classes" ADD CONSTRAINT "academy_classes_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_class_id_academy_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."academy_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academy_classes_academy_idx" ON "academy_classes" USING btree ("academy_id","weekday","start_time");--> statement-breakpoint
CREATE INDEX "attendance_user_idx" ON "attendance" USING btree ("user_id","date");