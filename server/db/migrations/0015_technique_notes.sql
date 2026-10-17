CREATE TABLE "technique_notes" (
	"user_id" text NOT NULL,
	"technique_id" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technique_notes_user_id_technique_id_pk" PRIMARY KEY("user_id","technique_id")
);
--> statement-breakpoint
ALTER TABLE "technique_notes" ADD CONSTRAINT "technique_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technique_notes" ADD CONSTRAINT "technique_notes_technique_id_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."techniques"("id") ON DELETE cascade ON UPDATE no action;