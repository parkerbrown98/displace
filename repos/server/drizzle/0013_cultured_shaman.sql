CREATE TYPE "public"."member_sanction_type" AS ENUM('warning', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'in_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('place', 'member', 'topic', 'post', 'chat_message');--> statement-breakpoint
CREATE TABLE "member_sanctions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "member_sanction_type" NOT NULL,
	"reason_code" text NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_sanctions_reason_code_check" CHECK ("member_sanctions"."reason_code" ~ '^[a-z][a-z0-9_]{1,49}$'),
	CONSTRAINT "member_sanctions_reason_length_check" CHECK (char_length(btrim("member_sanctions"."reason")) between 1 and 4000),
	CONSTRAINT "member_sanctions_expiry_check" CHECK (("member_sanctions"."type" = 'warning' and "member_sanctions"."expires_at" is null) or ("member_sanctions"."type" = 'timeout' and "member_sanctions"."expires_at" > "member_sanctions"."created_at")),
	CONSTRAINT "member_sanctions_revocation_check" CHECK (("member_sanctions"."revoked_at" is null and "member_sanctions"."revoked_by_user_id" is null) or ("member_sanctions"."revoked_at" is not null and "member_sanctions"."revoked_by_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid,
	"report_id" uuid,
	"actor_user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason_code" text NOT NULL,
	"reason" text NOT NULL,
	"before" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_actions_action_check" CHECK ("moderation_actions"."action" ~ '^[a-z][a-z0-9_]*(?:[.][a-z][a-z0-9_]*)+$'),
	CONSTRAINT "moderation_actions_reason_code_check" CHECK ("moderation_actions"."reason_code" ~ '^[a-z][a-z0-9_]{1,49}$'),
	CONSTRAINT "moderation_actions_reason_length_check" CHECK (char_length(btrim("moderation_actions"."reason")) between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "moderation_reports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"target_type" "report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"assigned_to_user_id" uuid,
	"resolved_by_user_id" uuid,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_reports_reason_code_check" CHECK ("moderation_reports"."reason_code" ~ '^[a-z][a-z0-9_]{1,49}$'),
	CONSTRAINT "moderation_reports_details_length_check" CHECK (char_length("moderation_reports"."details") <= 4000),
	CONSTRAINT "moderation_reports_resolution_check" CHECK ((
        "moderation_reports"."status" in ('resolved', 'dismissed')
        and "moderation_reports"."resolved_at" is not null
        and "moderation_reports"."resolved_by_user_id" is not null
        and char_length(btrim("moderation_reports"."resolution")) between 1 and 4000
      ) or (
        "moderation_reports"."status" in ('open', 'in_review')
        and "moderation_reports"."resolved_at" is null
        and "moderation_reports"."resolved_by_user_id" is null
        and "moderation_reports"."resolution" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "moderation_signals" (
	"report_id" uuid NOT NULL,
	"type" text NOT NULL,
	"value_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_signals_pkey" PRIMARY KEY("report_id","type","value_hash"),
	CONSTRAINT "moderation_signals_type_check" CHECK ("moderation_signals"."type" ~ '^[a-z][a-z0-9_]{1,49}$'),
	CONSTRAINT "moderation_signals_hash_check" CHECK (char_length("moderation_signals"."value_hash") between 32 and 128),
	CONSTRAINT "moderation_signals_expiry_check" CHECK ("moderation_signals"."expires_at" > "moderation_signals"."created_at")
);
--> statement-breakpoint
CREATE TABLE "moderator_notes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"report_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderator_notes_body_length_check" CHECK (char_length(btrim("moderator_notes"."body")) between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "member_sanctions" ADD CONSTRAINT "member_sanctions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_sanctions" ADD CONSTRAINT "member_sanctions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_sanctions" ADD CONSTRAINT "member_sanctions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_sanctions" ADD CONSTRAINT "member_sanctions_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_signals" ADD CONSTRAINT "moderation_signals_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_notes" ADD CONSTRAINT "moderator_notes_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_notes" ADD CONSTRAINT "moderator_notes_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_notes" ADD CONSTRAINT "moderator_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_sanctions_place_user_created_at_id_idx" ON "member_sanctions" USING btree ("place_id","user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "member_sanctions_active_timeout_idx" ON "member_sanctions" USING btree ("place_id","user_id","expires_at") WHERE "member_sanctions"."type" = 'timeout' and "member_sanctions"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "member_sanctions_created_by_user_id_idx" ON "member_sanctions" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "member_sanctions_revoked_by_user_id_idx" ON "member_sanctions" USING btree ("revoked_by_user_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_place_id_created_at_id_idx" ON "moderation_actions" USING btree ("place_id","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_actions_report_id_idx" ON "moderation_actions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_actor_user_id_idx" ON "moderation_actions" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_type","target_id","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_reports_place_status_created_at_id_idx" ON "moderation_reports" USING btree ("place_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_reports_assignee_status_created_at_id_idx" ON "moderation_reports" USING btree ("assigned_to_user_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_reports_target_idx" ON "moderation_reports" USING btree ("place_id","target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_reports_reporter_user_id_idx" ON "moderation_reports" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX "moderation_signals_hash_expires_at_idx" ON "moderation_signals" USING btree ("type","value_hash","expires_at");--> statement-breakpoint
CREATE INDEX "moderation_signals_expires_at_idx" ON "moderation_signals" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "moderator_notes_report_id_created_at_id_idx" ON "moderator_notes" USING btree ("report_id","created_at","id");--> statement-breakpoint
CREATE INDEX "moderator_notes_place_id_idx" ON "moderator_notes" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "moderator_notes_author_user_id_idx" ON "moderator_notes" USING btree ("author_user_id");