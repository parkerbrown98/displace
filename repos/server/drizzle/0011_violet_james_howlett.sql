CREATE TABLE "voice_rooms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"capacity" integer DEFAULT 25 NOT NULL,
	"listen_permission" text DEFAULT 'voice.join' NOT NULL,
	"speak_permission" text DEFAULT 'voice.join' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voice_rooms_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "voice_rooms_place_slug_unique" UNIQUE("place_id","slug"),
	CONSTRAINT "voice_rooms_slug_format_check" CHECK ("voice_rooms"."slug" = lower("voice_rooms"."slug") and "voice_rooms"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length("voice_rooms"."slug") between 1 and 80),
	CONSTRAINT "voice_rooms_name_length_check" CHECK (char_length(btrim("voice_rooms"."name")) between 1 and 120),
	CONSTRAINT "voice_rooms_position_check" CHECK ("voice_rooms"."position" >= 0),
	CONSTRAINT "voice_rooms_capacity_check" CHECK ("voice_rooms"."capacity" between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "voice_rooms" ADD CONSTRAINT "voice_rooms_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_rooms_place_position_id_idx" ON "voice_rooms" USING btree ("place_id","position","id");