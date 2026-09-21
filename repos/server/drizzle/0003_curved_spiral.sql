CREATE TYPE "public"."forum_visibility" AS ENUM('public', 'members');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('open', 'locked');--> statement-breakpoint
CREATE TABLE "forum_groups" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_groups_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "forum_groups_name_length_check" CHECK (char_length(btrim("forum_groups"."name")) between 1 and 120),
	CONSTRAINT "forum_groups_position_check" CHECK ("forum_groups"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "forum_tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_tags_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "forum_tags_slug_format_check" CHECK ("forum_tags"."slug" = lower("forum_tags"."slug") and "forum_tags"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length("forum_tags"."slug") between 1 and 50),
	CONSTRAINT "forum_tags_name_length_check" CHECK (char_length(btrim("forum_tags"."name")) between 1 and 50),
	CONSTRAINT "forum_tags_color_check" CHECK ("forum_tags"."color" is null or "forum_tags"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "forums" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"visibility" "forum_visibility" DEFAULT 'public' NOT NULL,
	"read_permission" text,
	"write_permission" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forums_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "forums_name_length_check" CHECK (char_length(btrim("forums"."name")) between 1 and 120),
	CONSTRAINT "forums_position_check" CHECK ("forums"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "post_mentions" (
	"place_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"mentioned_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_mentions_pkey" PRIMARY KEY("place_id","post_id","mentioned_user_id")
);
--> statement-breakpoint
CREATE TABLE "post_reactions" (
	"place_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reaction" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_reactions_pkey" PRIMARY KEY("place_id","post_id","user_id","reaction"),
	CONSTRAINT "post_reactions_reaction_check" CHECK ("post_reactions"."reaction" ~ '^[a-z0-9_+-]{1,40}$')
);
--> statement-breakpoint
CREATE TABLE "post_revisions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"editor_user_id" uuid NOT NULL,
	"document" jsonb NOT NULL,
	"sanitized_html" text NOT NULL,
	"plain_text" text NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_revisions_version_check" CHECK ("post_revisions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"document" jsonb NOT NULL,
	"sanitized_html" text NOT NULL,
	"plain_text" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "posts_version_check" CHECK ("posts"."version" > 0),
	CONSTRAINT "posts_plain_text_length_check" CHECK (char_length("posts"."plain_text") between 1 and 50000)
);
--> statement-breakpoint
CREATE TABLE "saved_posts" (
	"place_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_posts_pkey" PRIMARY KEY("place_id","post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "saved_topics" (
	"place_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_topics_pkey" PRIMARY KEY("place_id","topic_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "topic_follows" (
	"place_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_follows_pkey" PRIMARY KEY("place_id","topic_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "topic_read_state" (
	"place_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_post_id" uuid,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_read_state_pkey" PRIMARY KEY("place_id","topic_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "topic_tags" (
	"place_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "topic_tags_pkey" PRIMARY KEY("place_id","topic_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"forum_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "topic_status" DEFAULT 'open' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"latest_post_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "topics_title_length_check" CHECK (char_length(btrim("topics"."title")) between 1 and 300),
	CONSTRAINT "topics_reply_count_check" CHECK ("topics"."reply_count" >= 0),
	CONSTRAINT "topics_view_count_check" CHECK ("topics"."view_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "forum_groups" ADD CONSTRAINT "forum_groups_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_tags" ADD CONSTRAINT "forum_tags_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forums" ADD CONSTRAINT "forums_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forums" ADD CONSTRAINT "forums_group_place_fkey" FOREIGN KEY ("place_id","group_id") REFERENCES "public"."forum_groups"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_mentions" ADD CONSTRAINT "post_mentions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_mentions" ADD CONSTRAINT "post_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_mentions" ADD CONSTRAINT "post_mentions_post_place_fkey" FOREIGN KEY ("place_id","post_id") REFERENCES "public"."posts"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_place_fkey" FOREIGN KEY ("place_id","post_id") REFERENCES "public"."posts"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_editor_user_id_users_id_fk" FOREIGN KEY ("editor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_place_fkey" FOREIGN KEY ("place_id","post_id") REFERENCES "public"."posts"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_topic_place_fkey" FOREIGN KEY ("place_id","topic_id") REFERENCES "public"."topics"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_post_place_fkey" FOREIGN KEY ("place_id","post_id") REFERENCES "public"."posts"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_topics" ADD CONSTRAINT "saved_topics_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_topics" ADD CONSTRAINT "saved_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_topics" ADD CONSTRAINT "saved_topics_topic_place_fkey" FOREIGN KEY ("place_id","topic_id") REFERENCES "public"."topics"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_topic_place_fkey" FOREIGN KEY ("place_id","topic_id") REFERENCES "public"."topics"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_read_state" ADD CONSTRAINT "topic_read_state_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_read_state" ADD CONSTRAINT "topic_read_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_read_state" ADD CONSTRAINT "topic_read_state_topic_place_fkey" FOREIGN KEY ("place_id","topic_id") REFERENCES "public"."topics"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_read_state" ADD CONSTRAINT "topic_read_state_last_read_post_fkey" FOREIGN KEY ("last_read_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_tags" ADD CONSTRAINT "topic_tags_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_tags" ADD CONSTRAINT "topic_tags_topic_place_fkey" FOREIGN KEY ("place_id","topic_id") REFERENCES "public"."topics"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_tags" ADD CONSTRAINT "topic_tags_tag_place_fkey" FOREIGN KEY ("place_id","tag_id") REFERENCES "public"."forum_tags"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_forum_place_fkey" FOREIGN KEY ("place_id","forum_id") REFERENCES "public"."forums"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forum_groups_place_id_name_unique" ON "forum_groups" USING btree ("place_id",lower("name"));--> statement-breakpoint
CREATE INDEX "forum_groups_place_id_position_id_idx" ON "forum_groups" USING btree ("place_id","position","id");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_tags_place_id_slug_unique" ON "forum_tags" USING btree ("place_id","slug");--> statement-breakpoint
CREATE INDEX "forum_tags_place_id_name_id_idx" ON "forum_tags" USING btree ("place_id","name","id");--> statement-breakpoint
CREATE UNIQUE INDEX "forums_group_id_name_unique" ON "forums" USING btree ("group_id",lower("name"));--> statement-breakpoint
CREATE INDEX "forums_place_id_group_id_position_id_idx" ON "forums" USING btree ("place_id","group_id","position","id");--> statement-breakpoint
CREATE INDEX "forums_group_id_idx" ON "forums" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "post_mentions_mentioned_user_id_created_at_idx" ON "post_mentions" USING btree ("mentioned_user_id","created_at");--> statement-breakpoint
CREATE INDEX "post_reactions_post_id_reaction_idx" ON "post_reactions" USING btree ("post_id","reaction");--> statement-breakpoint
CREATE INDEX "post_reactions_user_id_idx" ON "post_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_revisions_post_id_version_unique" ON "post_revisions" USING btree ("post_id","version");--> statement-breakpoint
CREATE INDEX "post_revisions_place_id_post_id_created_at_id_idx" ON "post_revisions" USING btree ("place_id","post_id","created_at","id");--> statement-breakpoint
CREATE INDEX "post_revisions_editor_user_id_idx" ON "post_revisions" USING btree ("editor_user_id");--> statement-breakpoint
CREATE INDEX "posts_topic_id_created_at_id_idx" ON "posts" USING btree ("topic_id","created_at","id");--> statement-breakpoint
CREATE INDEX "posts_author_user_id_idx" ON "posts" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "posts_deleted_by_user_id_idx" ON "posts" USING btree ("deleted_by_user_id");--> statement-breakpoint
CREATE INDEX "saved_posts_user_id_created_at_idx" ON "saved_posts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_topics_user_id_created_at_idx" ON "saved_topics" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "topic_follows_user_id_created_at_idx" ON "topic_follows" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "topic_read_state_user_id_read_at_idx" ON "topic_read_state" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "topic_read_state_last_read_post_id_idx" ON "topic_read_state" USING btree ("last_read_post_id");--> statement-breakpoint
CREATE INDEX "topic_tags_place_id_tag_id_topic_id_idx" ON "topic_tags" USING btree ("place_id","tag_id","topic_id");--> statement-breakpoint
CREATE INDEX "topics_forum_latest_post_at_id_idx" ON "topics" USING btree ("forum_id","latest_post_at","id");--> statement-breakpoint
CREATE INDEX "topics_place_latest_post_at_id_idx" ON "topics" USING btree ("place_id","latest_post_at","id");--> statement-breakpoint
CREATE INDEX "topics_place_created_at_id_idx" ON "topics" USING btree ("place_id","created_at","id");--> statement-breakpoint
CREATE INDEX "topics_author_user_id_idx" ON "topics" USING btree ("author_user_id");