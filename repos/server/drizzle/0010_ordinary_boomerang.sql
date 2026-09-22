CREATE TYPE "public"."chat_channel_visibility" AS ENUM('members', 'public');--> statement-breakpoint
CREATE TABLE "chat_channels" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"visibility" "chat_channel_visibility" DEFAULT 'members' NOT NULL,
	"read_permission" text,
	"send_permission" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_channels_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "chat_channels_place_slug_unique" UNIQUE("place_id","slug"),
	CONSTRAINT "chat_channels_slug_format_check" CHECK ("chat_channels"."slug" = lower("chat_channels"."slug") and "chat_channels"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length("chat_channels"."slug") between 1 and 80),
	CONSTRAINT "chat_channels_name_length_check" CHECK (char_length(btrim("chat_channels"."name")) between 1 and 120),
	CONSTRAINT "chat_channels_position_check" CHECK ("chat_channels"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chat_message_revisions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"editor_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_revisions_body_length_check" CHECK (char_length(btrim("chat_message_revisions"."body")) between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"client_command_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "chat_messages_author_command_unique" UNIQUE("author_user_id","client_command_id"),
	CONSTRAINT "chat_messages_body_length_check" CHECK (char_length(btrim("chat_messages"."body")) between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "chat_read_state" (
	"place_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_message_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_read_state_pkey" PRIMARY KEY("place_id","channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_type_length_check" CHECK (char_length(btrim("notifications"."type")) between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_revisions" ADD CONSTRAINT "chat_message_revisions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_revisions" ADD CONSTRAINT "chat_message_revisions_editor_user_id_users_id_fk" FOREIGN KEY ("editor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_revisions" ADD CONSTRAINT "chat_message_revisions_message_place_fkey" FOREIGN KEY ("place_id","message_id") REFERENCES "public"."chat_messages"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_place_fkey" FOREIGN KEY ("place_id","channel_id") REFERENCES "public"."chat_channels"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read_state" ADD CONSTRAINT "chat_read_state_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read_state" ADD CONSTRAINT "chat_read_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read_state" ADD CONSTRAINT "chat_read_state_channel_place_fkey" FOREIGN KEY ("place_id","channel_id") REFERENCES "public"."chat_channels"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read_state" ADD CONSTRAINT "chat_read_state_message_place_fkey" FOREIGN KEY ("place_id","last_read_message_id") REFERENCES "public"."chat_messages"("place_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_channels_place_position_id_idx" ON "chat_channels" USING btree ("place_id","position","id");--> statement-breakpoint
CREATE INDEX "chat_message_revisions_message_created_at_id_idx" ON "chat_message_revisions" USING btree ("message_id","created_at","id");--> statement-breakpoint
CREATE INDEX "chat_messages_channel_created_at_id_idx" ON "chat_messages" USING btree ("channel_id","created_at","id");--> statement-breakpoint
CREATE INDEX "chat_messages_author_user_id_idx" ON "chat_messages" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "chat_read_state_user_id_updated_at_idx" ON "chat_read_state" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_at_id_idx" ON "notifications" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","created_at","id") WHERE "notifications"."read_at" is null and "notifications"."dismissed_at" is null;